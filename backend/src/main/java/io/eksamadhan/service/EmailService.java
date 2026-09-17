package io.eksamadhan.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Outbound email, through Resend.
 *
 * Every caller treats sending as best-effort. An invitation whose email bounces is still a
 * valid invitation — the link is shown in the dashboard to copy — and a notification that
 * fails must never roll back the thing it was notifying about.
 *
 * Note the free-tier constraint: until a domain is verified at resend.com/domains, Resend
 * refuses to deliver to anyone but the account owner's own address. {@link Result#error()}
 * carries that message through so the UI can say so plainly rather than silently failing.
 */
@Service
@Slf4j
public class EmailService {

    private final WebClient webClient;
    private final String apiKey;
    private final String from;
    private final boolean enabled;

    public EmailService(@Value("${app.email.resend-key:}") String apiKey,
                        @Value("${app.email.from}") String from,
                        @Value("${app.email.enabled:true}") boolean enabled) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.from = from;
        this.enabled = enabled;
        this.webClient = WebClient.builder().baseUrl("https://api.resend.com").build();
    }

    /** Whether an email could be sent at all. */
    public boolean isConfigured() {
        return enabled && !apiKey.isEmpty();
    }

    /**
     * @param sent  true when Resend accepted the message
     * @param error a human-readable reason when it did not, otherwise null
     */
    public record Result(boolean sent, String error) {
        public static Result ok() { return new Result(true, null); }
        public static Result failed(String reason) { return new Result(false, reason); }
    }

    public Result send(String to, String subject, String html, String text) {
        if (!isConfigured()) {
            return Result.failed("Email is not configured on the server.");
        }
        try {
            webClient.post()
                    .uri("/emails")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(Map.of("from", from, "to", List.of(to),
                            "subject", subject, "html", html, "text", text))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .timeout(Duration.ofSeconds(15))
                    .block();
            log.info("Emailed \"{}\" to {}", subject, to);
            return Result.ok();
        } catch (WebClientResponseException e) {
            String reason = extractMessage(e.getResponseBodyAsString(), e.getMessage());
            log.warn("Could not email {}: {}", to, reason);
            return Result.failed(reason);
        } catch (Exception e) {
            log.warn("Could not email {}: {}", to, e.getMessage());
            return Result.failed(e.getMessage());
        }
    }

    /** Resend puts the useful part in a "message" field; the raw body is noise to a user. */
    private String extractMessage(String body, String fallback) {
        if (body == null || body.isBlank()) return fallback;
        int key = body.indexOf("\"message\":\"");
        if (key < 0) return fallback;
        int start = key + 11;
        int end = body.indexOf('"', start);
        return end > start ? body.substring(start, end) : fallback;
    }

    /**
     * A plain, readable shell. Deliberately inline-styled and table-free: email clients strip
     * stylesheets, and anything cleverer renders badly somewhere.
     */
    public String layout(String heading, String bodyHtml) {
        return """
                <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
                            max-width:520px;margin:0 auto;padding:24px;color:#1a1d23;">
                  <p style="font-size:13px;color:#667085;margin:0 0 20px;">EkSamadhan AI</p>
                  <h1 style="font-size:20px;margin:0 0 12px;">%s</h1>
                  %s
                  <p style="font-size:12px;color:#667085;margin-top:28px;border-top:1px solid #e2e6ec;padding-top:14px;">
                    Sent by EkSamadhan AI, the support inbox for your workspace.
                  </p>
                </div>
                """.formatted(heading, bodyHtml);
    }

    public String button(String href, String label) {
        return """
                <p style="margin:20px 0;">
                  <a href="%s" style="background:#2563eb;color:#ffffff;text-decoration:none;
                     padding:11px 18px;border-radius:8px;display:inline-block;font-weight:600;">%s</a>
                </p>
                <p style="font-size:12px;color:#667085;">Or paste this into your browser:<br>%s</p>
                """.formatted(href, label, href);
    }
}
