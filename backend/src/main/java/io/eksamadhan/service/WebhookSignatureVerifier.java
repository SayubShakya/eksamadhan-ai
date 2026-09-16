package io.eksamadhan.service;

import io.github.cdimascio.dotenv.Dotenv;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

/**
 * Verifies the X-Hub-Signature-256 header Meta sends with every webhook POST.
 *
 * Without this, the webhook endpoint accepts anything: the URL is public, so anyone
 * who finds it can inject fabricated customer messages into the inbox.
 */
@Service
@Slf4j
public class WebhookSignatureVerifier {

    private static final String PREFIX = "sha256=";
    private final String appSecret;

    public WebhookSignatureVerifier() {
        this.appSecret = Dotenv.load().get("FACEBOOK_APP_SECRET", "");
        if (appSecret.isBlank()) {
            log.warn("FACEBOOK_APP_SECRET is not set — webhook signatures cannot be verified");
        }
    }

    /**
     * @param rawBody   the exact bytes received, before any JSON parsing
     * @param signature value of the X-Hub-Signature-256 header, e.g. "sha256=ab12..."
     */
    public boolean isValid(byte[] rawBody, String signature) {
        if (appSecret.isBlank()) {
            return false;
        }
        if (signature == null || !signature.startsWith(PREFIX)) {
            log.warn("Webhook rejected: missing or malformed X-Hub-Signature-256 header");
            return false;
        }

        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(appSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            String expected = HexFormat.of().formatHex(mac.doFinal(rawBody));

            // Constant-time comparison: a byte-by-byte compare leaks, through timing,
            // how much of a forged signature was correct.
            boolean ok = MessageDigest.isEqual(
                    expected.getBytes(StandardCharsets.UTF_8),
                    signature.substring(PREFIX.length()).getBytes(StandardCharsets.UTF_8));

            if (!ok) {
                log.warn("Webhook rejected: signature mismatch");
            }
            return ok;
        } catch (Exception e) {
            log.error("Failed to verify webhook signature", e);
            return false;
        }
    }
}
