package io.eksamadhan.controller;

import io.eksamadhan.service.MetaMessageParser;
import io.github.cdimascio.dotenv.Dotenv;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/webhook")
@Slf4j
public class WebhookController {

    private final MetaMessageParser messageParser;
    private final String verifyToken;

    public WebhookController(MetaMessageParser messageParser) {
        this.messageParser = messageParser;
        Dotenv dotenv = Dotenv.load();
        this.verifyToken = dotenv.get("WEBHOOK_VERIFY_TOKEN", "eksamadhan_verify_token");
    }

    @GetMapping(produces = "text/plain")
    public ResponseEntity<String> verifyWebhook(
            @RequestParam("hub.mode") String mode,
            @RequestParam("hub.verify_token") String token,
            @RequestParam("hub.challenge") String challenge) {

        log.info("Webhook verification request: mode={}, token={}", mode, token);

        if ("subscribe".equals(mode) && verifyToken.equals(token)) {
            log.info("Webhook verified successfully!");
            return ResponseEntity.ok(challenge);
        } else {
            log.warn("Webhook verification failed. Mode: {}, Token: {}", mode, token);
            return ResponseEntity.status(403).build();
        }
    }

    @PostMapping
    public ResponseEntity<Void> handleWebhook(@RequestBody Map<String, Object> payload) {
        log.info("Received Webhook Payload: {}", payload);
        
        // Process messages using MetaMessageParser
        messageParser.processWebhookPayload(payload);
        
        return ResponseEntity.ok().build();
    }
}
