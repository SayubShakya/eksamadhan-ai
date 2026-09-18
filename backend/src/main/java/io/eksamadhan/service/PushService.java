package io.eksamadhan.service;

import io.eksamadhan.model.PushSubscription;
import io.eksamadhan.model.User;
import io.eksamadhan.repository.PushSubscriptionRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Browser notifications for the people answering conversations (FR-06).
 *
 * Web Push rather than Firebase Cloud Messaging, which is what the report named. FCM would mean
 * a Google project, a service account key in the repository's environment, and a vendor in the
 * path of every notification; Web Push is the browser standard underneath it, so the same
 * notification reaches Chrome, Firefox, Edge and an installed app on Android through each
 * browser's own push service, with VAPID as the only credential. Record it as a deviation.
 *
 * Sending is best-effort and always off the request thread. A notification that fails must
 * never fail the escalation that triggered it — an agent who misses a buzz still has the
 * conversation waiting in their inbox, and an email besides.
 */
@Service
@Slf4j
public class PushService {

    /**
     * How long a push service should hold the message for a browser that is offline. Four
     * hours: a support conversation is stale long before that, and a buzz the next morning
     * about something already answered is worse than no buzz at all.
     */
    private static final int TTL_SECONDS = 4 * 3600;

    private final PushSubscriptionRepository subscriptions;
    private final WebClient webClient;
    private final String publicKey;
    private final String privateKey;
    private final String subject;

    public PushService(PushSubscriptionRepository subscriptions,
                       @Value("${app.push.public-key:}") String publicKey,
                       @Value("${app.push.private-key:}") String privateKey,
                       @Value("${app.push.subject:}") String subject) {
        this.subscriptions = subscriptions;
        this.publicKey = publicKey == null ? "" : publicKey.trim();
        this.privateKey = privateKey == null ? "" : privateKey.trim();
        this.subject = subject == null || subject.isBlank() ? "mailto:support@example.com" : subject.trim();
        this.webClient = WebClient.builder()
                .codecs(c -> c.defaultCodecs().maxInMemorySize(64 * 1024))
                .build();
    }

    /** Without a key pair there is nothing to sign with, so the browser is never asked. */
    public boolean isConfigured() {
        return !publicKey.isEmpty() && !privateKey.isEmpty();
    }

    /** The application server key the browser needs to subscribe. Public by design. */
    public String getPublicKey() {
        return publicKey;
    }

    /** What a notification says, and where clicking it goes. */
    public record Notification(String title, String body, String url, String tag) {}

    /**
     * Notifies every browser this person has registered.
     *
     * Asynchronous because it is one HTTPS request per device to a service that may be slow,
     * and nothing waits on the result.
     */
    @Async("taskExecutor")
    @Transactional
    public void notify(User user, Notification notification) {
        if (!isConfigured() || user == null) return;

        List<PushSubscription> devices = subscriptions.findForUser(user);
        if (devices.isEmpty()) {
            log.debug("{} has no push subscriptions", user.getEmail());
            return;
        }

        String payload = json(notification);
        int delivered = 0;
        for (PushSubscription device : devices) {
            if (send(device, payload)) delivered++;
        }
        log.info("🔔 Pushed \"{}\" to {} of {} device(s) for {}",
                notification.title(), delivered, devices.size(), user.getEmail());
    }

    /** @return true when the push service accepted the message */
    private boolean send(PushSubscription device, String payload) {
        try {
            byte[] body = WebPushCrypto.encrypt(
                    WebPushCrypto.decode(device.getP256dh()),
                    WebPushCrypto.decode(device.getAuth()),
                    payload.getBytes(StandardCharsets.UTF_8));

            webClient.post()
                    .uri(device.getEndpoint())
                    .header(HttpHeaders.AUTHORIZATION,
                            WebPushCrypto.vapidHeader(device.getEndpoint(), subject, publicKey, privateKey))
                    .header("Content-Encoding", "aes128gcm")
                    .header("TTL", String.valueOf(TTL_SECONDS))
                    .header("Urgency", "high")
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .bodyValue(body)
                    .retrieve()
                    .toBodilessEntity()
                    .timeout(Duration.ofSeconds(10))
                    .block();

            device.setLastUsedAt(OffsetDateTime.now());
            subscriptions.save(device);
            return true;

        } catch (WebClientResponseException e) {
            // 404 and 410 are the push service saying this browser is gone for good — the
            // person cleared their site data, or revoked permission. Keeping the row would
            // mean a failed request on every future notification, forever.
            if (e.getStatusCode().value() == 404 || e.getStatusCode().value() == 410) {
                log.info("Removing a dead push subscription for {}", device.getUser().getEmail());
                subscriptions.delete(device);
            } else {
                log.warn("Push rejected ({}): {}", e.getStatusCode(), e.getResponseBodyAsString());
            }
            return false;
        } catch (Exception e) {
            log.warn("Could not push to a device: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Hand-written rather than a serialiser: the payload has four fields and is read by one
     * service worker, and a customer's name arriving with a quote in it must not produce
     * something the browser refuses to parse.
     */
    private String json(Notification notification) {
        return "{\"title\":%s,\"body\":%s,\"url\":%s,\"tag\":%s}".formatted(
                quote(notification.title()), quote(notification.body()),
                quote(notification.url()), quote(notification.tag()));
    }

    private static String quote(String value) {
        if (value == null) return "null";
        StringBuilder out = new StringBuilder("\"");
        for (char c : value.toCharArray()) {
            switch (c) {
                case '"'  -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default   -> {
                    if (c < 0x20) out.append(String.format("\\u%04x", (int) c));
                    else out.append(c);
                }
            }
        }
        return out.append('"').toString();
    }
}
