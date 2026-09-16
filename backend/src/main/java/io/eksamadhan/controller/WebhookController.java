package io.eksamadhan.controller;

import tools.jackson.databind.ObjectMapper;
import io.eksamadhan.service.MetaMessageParser;
import io.eksamadhan.service.WebhookSignatureVerifier;
import io.github.cdimascio.dotenv.Dotenv;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/webhook")
@Slf4j
public class WebhookController {

    private final MetaMessageParser messageParser;
    private final WebhookSignatureVerifier signatureVerifier;
    private final ObjectMapper objectMapper;
    private final String verifyToken;

    public WebhookController(MetaMessageParser messageParser,
                             WebhookSignatureVerifier signatureVerifier,
                             ObjectMapper objectMapper) {
        this.messageParser = messageParser;
        this.signatureVerifier = signatureVerifier;
        this.objectMapper = objectMapper;
        Dotenv dotenv = Dotenv.load();
        this.verifyToken = dotenv.get("WEBHOOK_VERIFY_TOKEN", "eksamadhan_verify_token");
    }

    @GetMapping(produces = "text/plain")
    public ResponseEntity<String> verifyWebhook(
            @RequestParam("hub.mode") String mode,
            @RequestParam("hub.verify_token") String token,
            @RequestParam("hub.challenge") String challenge) {

        log.info("Webhook verification request: mode={}", mode);

        if ("subscribe".equals(mode) && verifyToken.equals(token)) {
            log.info("Webhook verified successfully!");
            return ResponseEntity.ok(challenge);
        }
        log.warn("Webhook verification failed for mode={}", mode);
        return ResponseEntity.status(403).build();
    }

    /**
     * Takes the body as raw bytes rather than a parsed Map: the signature is an HMAC
     * over exactly what Meta sent, so the payload must not be re-serialised first.
     */
    @PostMapping
    public ResponseEntity<Void> handleWebhook(
            @RequestBody byte[] rawBody,
            @RequestHeader(value = "X-Hub-Signature-256", required = false) String signature) {

        if (!signatureVerifier.isValid(rawBody, signature)) {
            // 403, not 401: Meta does not retry on 403, and a forged request should not
            // be queued for redelivery.
            return ResponseEntity.status(403).build();
        }

        try {
            Map<String, Object> payload = objectMapper.readValue(rawBody, Map.class);
            log.info("Received Webhook Payload: {}", payload);
            messageParser.processWebhookPayload(payload);
        } catch (Exception e) {
            log.error("Failed to parse webhook payload", e);
            // Still 200: Meta retries on failure, and a malformed payload will never
            // parse on a retry either.
        }

        return ResponseEntity.ok().build();
    }
}
