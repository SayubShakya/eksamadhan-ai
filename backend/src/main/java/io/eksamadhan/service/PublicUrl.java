package io.eksamadhan.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;

/**
 * The address people open the dashboard at: what invite, password and handover emails link
 * to, what the Team page shares, and where Facebook sends someone back after connecting.
 *
 * A Cloudflare quick tunnel gets a new random address every time it starts. When one is running
 * on this machine it reports that address on its local status port, so this reads it from there
 * (at most every 30 seconds) and the links follow the tunnel without editing .env or restarting.
 * With no tunnel running, or the lookup switched off (TUNNEL_STATUS_URL empty), it is
 * app.frontend-url, as before.
 */
@Service
@Slf4j
public class PublicUrl {

    private static final Duration FRESH_FOR = Duration.ofSeconds(30);
    private static final ObjectMapper JSON = new ObjectMapper();

    private final String configured;
    /** Where to ask, in order: cloudflared uses the first free port from 20241 to 20245. */
    private final java.util.List<String> tunnelStatusUrls;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofMillis(500)).build();

    private volatile String cached;
    private volatile Instant checkedAt = Instant.EPOCH;

    public PublicUrl(@Value("${app.frontend-url}") String configured,
                     @Value("${app.tunnel-status-url:}") String tunnelStatusUrl) {
        this.configured = trim(configured);
        this.tunnelStatusUrls = tunnelStatusUrl == null ? java.util.List.of()
                : java.util.Arrays.stream(tunnelStatusUrl.split(",")).map(String::trim).filter(u -> !u.isEmpty()).toList();
    }

    /** The current public address, without a trailing slash. */
    public String get() {
        if (tunnelStatusUrls.isEmpty()) return configured;
        if (Instant.now().isBefore(checkedAt.plus(FRESH_FOR)) && cached != null) return cached;
        String tunnel = readTunnel();
        String next = tunnel != null ? tunnel : configured;
        if (!next.equals(cached)) log.info("Public address is now {}", next);
        cached = next;
        checkedAt = Instant.now();
        return next;
    }

    /** The configured address, ignoring any tunnel. */
    public String configured() {
        return configured;
    }

    private String readTunnel() {
        for (String url : tunnelStatusUrls) {
            try {
                HttpResponse<String> res = http.send(HttpRequest.newBuilder(URI.create(url))
                        .timeout(Duration.ofSeconds(1)).GET().build(), HttpResponse.BodyHandlers.ofString());
                if (res.statusCode() != 200) continue;
                String found = fromStatus(res.body());
                if (found != null) return found;
            } catch (Exception e) {
                // nothing listening there: try the next port
            }
        }
        return null;                                      // no tunnel running here: the usual case
    }

    /** cloudflared answers {"hostname":"xyz.trycloudflare.com"}; anything else is not a tunnel. */
    static String fromStatus(String body) {
        try {
            JsonNode host = JSON.readTree(body).get("hostname");
            if (host == null || !host.isString()) return null;
            String h = host.asString().trim();
            return h.matches("[a-z0-9.-]+\\.[a-z]{2,}") ? "https://" + h : null;
        } catch (Exception e) {
            return null;
        }
    }

    private static String trim(String url) {
        return url == null ? "" : url.trim().replaceAll("/+$", "");
    }
}
