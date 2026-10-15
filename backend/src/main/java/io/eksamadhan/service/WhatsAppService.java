package io.eksamadhan.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.io.File;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * The WhatsApp Cloud API (13 October 2026). A business's WhatsApp number is reached through its
 * phone number ID and a token from Meta; customers are addressed by their WhatsApp number (wa_id).
 *
 * WhatsApp allows a free-form reply only within 24 hours of the customer's last message; after
 * that Meta refuses it (error 131047) and only a pre-approved template may be sent. That refusal
 * is turned into a sentence an agent can act on, rather than a raw Graph error.
 */
@Service
@Slf4j
public class WhatsAppService {

    static final String GRAPH = "https://graph.facebook.com/v23.0";
    static final String OUTSIDE_WINDOW =
            "WhatsApp only allows replies within 24 hours of the customer's last message. They need to message you first.";

    private final WebClient web = WebClient.builder()
            .baseUrl(GRAPH)
            .codecs(c -> c.defaultCodecs().maxInMemorySize(20 * 1024 * 1024))
            .build();

    /** The number's details, which also proves the phone number ID and token belong together. */
    public record NumberInfo(String displayPhoneNumber, String verifiedName) {}

    public NumberInfo numberInfo(String phoneNumberId, String token) {
        Map<?, ?> body = web.get()
                .uri(u -> u.path("/{id}").queryParam("fields", "display_phone_number,verified_name").build(phoneNumberId))
                .headers(h -> h.setBearerAuth(token))
                .retrieve().bodyToMono(Map.class)
                .onErrorMap(WebClientResponseException.class, e -> new IllegalArgumentException(graphError(e)))
                .block(Duration.ofSeconds(20));
        if (body == null) throw new IllegalArgumentException("Meta did not answer. Please try again.");
        return new NumberInfo(String.valueOf(body.get("display_phone_number")), String.valueOf(body.get("verified_name")));
    }

    /** Has Meta send this WhatsApp Business account's messages to our webhook. */
    public void subscribeApp(String businessAccountId, String token) {
        web.post().uri("/{id}/subscribed_apps", businessAccountId)
                .headers(h -> h.setBearerAuth(token))
                .retrieve().bodyToMono(Map.class)
                .onErrorMap(WebClientResponseException.class, e -> new IllegalArgumentException(graphError(e)))
                .block(Duration.ofSeconds(20));
    }

    public Mono<Map> sendText(String phoneNumberId, String to, String text, String token, String replyToId) {
        Map<String, Object> body = base(to, "text");
        body.put("text", Map.of("body", text, "preview_url", false));
        if (replyToId != null && replyToId.startsWith("wamid.")) body.put("context", Map.of("message_id", replyToId));
        return post(phoneNumberId, body, token);
    }

    /** A photo or voice note: uploaded to Meta first, then sent by its media id. */
    public Mono<Map> sendMedia(String phoneNumberId, String to, File file, String type, String mimeType, String token) {
        return upload(phoneNumberId, file, mimeType, token).flatMap(mediaId -> {
            Map<String, Object> body = base(to, type);
            body.put(type, Map.of("id", mediaId));
            return post(phoneNumberId, body, token);
        });
    }

    public Mono<Map> sendReaction(String phoneNumberId, String to, String messageId, String emoji, String token) {
        Map<String, Object> body = base(to, "reaction");
        body.put("reaction", Map.of("message_id", messageId, "emoji", emoji == null ? "" : emoji));
        return post(phoneNumberId, body, token);
    }

    /** The bytes and type of a photo or voice note a customer sent, or null if it cannot be fetched. */
    public record Media(byte[] bytes, String mimeType) {}

    public Media download(String mediaId, String token) {
        try {
            Map<?, ?> meta = web.get().uri("/{id}", mediaId).headers(h -> h.setBearerAuth(token))
                    .retrieve().bodyToMono(Map.class).block(Duration.ofSeconds(20));
            if (meta == null || meta.get("url") == null) return null;
            byte[] bytes = WebClient.builder().codecs(c -> c.defaultCodecs().maxInMemorySize(20 * 1024 * 1024)).build()
                    .get().uri(java.net.URI.create(String.valueOf(meta.get("url"))))
                    .headers(h -> h.setBearerAuth(token))
                    .retrieve().bodyToMono(byte[].class).block(Duration.ofSeconds(30));
            return bytes == null ? null : new Media(bytes, String.valueOf(meta.get("mime_type")));
        } catch (Exception e) {
            log.warn("Could not download WhatsApp media {}: {}", mediaId, e.getMessage());
            return null;
        }
    }

    // ----- helpers -----

    private static Map<String, Object> base(String to, String type) {
        Map<String, Object> body = new HashMap<>();
        body.put("messaging_product", "whatsapp");
        body.put("recipient_type", "individual");
        body.put("to", to);
        body.put("type", type);
        return body;
    }

    private Mono<String> upload(String phoneNumberId, File file, String mimeType, String token) {
        MultipartBodyBuilder parts = new MultipartBodyBuilder();
        parts.part("messaging_product", "whatsapp");
        parts.part("type", mimeType);
        parts.part("file", new FileSystemResource(file)).header("Content-Type", mimeType);
        return web.post().uri("/{id}/media", phoneNumberId)
                .headers(h -> h.setBearerAuth(token))
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(BodyInserters.fromMultipartData(parts.build()))
                .retrieve().bodyToMono(Map.class)
                .onErrorMap(WebClientResponseException.class, e -> new RuntimeException(graphError(e)))
                .map(m -> String.valueOf(m.get("id")));
    }

    /** Sends, and hands back {"message_id": wamid} in the shape the Messenger path returns. */
    private Mono<Map> post(String phoneNumberId, Map<String, Object> body, String token) {
        return web.post().uri("/{id}/messages", phoneNumberId)
                .headers(h -> h.setBearerAuth(token))
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve().bodyToMono(Map.class)
                .onErrorMap(WebClientResponseException.class, e -> new RuntimeException(graphError(e)))
                .map(WhatsAppService::messageId);
    }

    @SuppressWarnings("unchecked")
    static Map messageId(Map response) {
        Object list = response == null ? null : response.get("messages");
        if (list instanceof java.util.List<?> l && !l.isEmpty() && l.get(0) instanceof Map<?, ?> first) {
            return Map.of("message_id", String.valueOf(first.get("id")));
        }
        return Map.of();
    }

    /** A Graph error as a sentence; the 24-hour rule gets its own. */
    static String graphError(WebClientResponseException e) {
        String raw = e.getResponseBodyAsString();
        if (raw.contains("131047") || raw.contains("Re-engagement message")) return OUTSIDE_WINDOW;
        if (e.getStatusCode().value() == 401 || raw.contains("\"code\":190")) {
            return "Meta refused the access token. Check it, or generate a new one.";
        }
        if (raw.contains("\"code\":100")) return "Meta does not recognise that ID. Check the phone number ID and the WhatsApp Business account ID.";
        return "WhatsApp error: " + (raw.length() > 300 ? raw.substring(0, 300) : raw);
    }
}
