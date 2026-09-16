package io.eksamadhan.service;

import io.github.cdimascio.dotenv.Dotenv;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.List;

@Service
@Slf4j
public class MetaService {

    private final WebClient webClient;
    private final String appId;
    private final String appSecret;
    private final String redirectUri;

    public MetaService() {
        Dotenv dotenv = Dotenv.load();
        this.webClient = WebClient.builder().baseUrl("https://graph.facebook.com/v18.0").build();
        this.appId = dotenv.get("FACEBOOK_APP_ID");
        this.appSecret = dotenv.get("FACEBOOK_APP_SECRET");
        this.redirectUri = dotenv.get("FACEBOOK_REDIRECT_URI");
    }

    public Mono<Map> exchangeCodeForToken(String code, String redirectUri) {
        return webClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/oauth/access_token")
                        .queryParam("client_id", appId)
                        .queryParam("client_secret", appSecret)
                        .queryParam("redirect_uri", redirectUri)
                        .queryParam("code", code)
                        .build())
                .retrieve()
                .bodyToMono(Map.class)
                .doOnSuccess(res -> log.info("Successfully exchanged Facebook code for token"))
                .doOnError(err -> log.error("Failed to exchange Facebook code: {}", err.getMessage()));
    }

    /**
     * Get pages with Instagram Business Account info and permissions (tasks)
     * This matches the Node.js implementation that requests additional fields
     */
    public Mono<Map> getPagesWithInstagram(String userAccessToken) {
        return webClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/me/accounts")
                        .queryParam("access_token", userAccessToken)
                        .queryParam("fields", "name,access_token,instagram_business_account,tasks")
                        .build())
                .retrieve()
                .bodyToMono(Map.class)
                .doOnSuccess(res -> log.info("Successfully fetched Facebook pages with Instagram info"))
                .doOnError(err -> log.error("Failed to fetch Facebook pages: {}", err.getMessage()));
    }

    /**
     * Validate page token by attempting to fetch conversations
     * This is the "health check" that Node.js implementation performs
     */
    public Mono<Boolean> validatePageToken(String pageId, String pageAccessToken) {
        return webClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/{pageId}/conversations")
                        .queryParam("access_token", pageAccessToken)
                        .queryParam("limit", 1)
                        .build(pageId))
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> true)
                .doOnSuccess(valid -> log.info("✅ Token VALID for pageId: {}", pageId))
                .onErrorResume(err -> {
                    log.warn("⚠️ Token INVALID for pageId: {} - {}", pageId, err.getMessage());
                    return Mono.just(false);
                });
    }

    /**
     * Subscribe page to webhook for real-time message updates
     * Subscribes to: messages, messaging_postbacks, message_echoes
     */
    public Mono<Map> subscribeToWebhooks(String pageId, String pageAccessToken) {
        return webClient.post()
                .uri(uriBuilder -> uriBuilder
                        .path("/{pageId}/subscribed_apps")
                        .queryParam("access_token", pageAccessToken)
                        .queryParam("subscribed_fields", "messages,messaging_postbacks,message_echoes")
                        .build(pageId))
                .retrieve()
                .bodyToMono(Map.class)
                .doOnSuccess(res -> log.info("✅ Subscribed pageId {} to webhooks", pageId))
                .doOnError(err -> log.error("❌ Failed to subscribe pageId {} to webhooks: {}", pageId, err.getMessage()));
    }

    /**
     * Fetch conversations for a page
     */
    public Mono<Map> getConversations(String pageId, String pageAccessToken, String platform, int limit) {
        String uri = String.format("/%s/conversations?access_token=%s&limit=%d&fields=id,updated_time,participants%s",
                pageId, (pageAccessToken != null ? "MASKED" : "NULL"), limit, 
                (platform != null && platform.equalsIgnoreCase("INSTAGRAM") ? "&platform=instagram" : ""));
        
        log.info("📡 Requesting Meta (Conversations): {}", uri);
        
        return webClient.get()
                .uri(uriBuilder -> {
                    uriBuilder.path("/{pageId}/conversations")
                            .queryParam("access_token", pageAccessToken)
                            .queryParam("limit", limit)
                            .queryParam("fields", "id,updated_time,participants");
                    
                    if (platform != null && platform.equalsIgnoreCase("INSTAGRAM")) {
                        uriBuilder.queryParam("platform", "instagram");
                    }
                    
                    return uriBuilder.build(pageId);
                })
                .retrieve()
                .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(), 
                        clientResponse -> clientResponse.bodyToMono(String.class)
                                .flatMap(errorBody -> {
                                    log.error("❌ Meta API Error (Conversations) for pageId {}: {}", pageId, errorBody);
                                    return Mono.error(new RuntimeException("Meta API Error: " + errorBody));
                                }))
                .bodyToMono(Map.class)
                .doOnSuccess(res -> {
                    log.info("Fetched {} conversations for pageId: {}", limit, pageId);
                    log.info("🔍 RAW Conversations Sample: {}", res.toString().substring(0, Math.min(res.toString().length(), 200)));
                })
                .doOnError(err -> log.error("Failed to fetch conversations for pageId {}: {}", pageId, err.getMessage()));
    }

    /**
     * Fetch messages for a specific conversation
     */
    public Mono<Map> getMessages(String conversationId, String pageAccessToken, int limit) {
        String uri = String.format("/%s/messages?access_token=%s&limit=%d&fields=id,from,to,message,created_time",
                conversationId, (pageAccessToken != null ? "MASKED" : "NULL"), limit);

        log.info("📡 Requesting Meta (Messages): {}", uri);

        return webClient.get()
                .uri(uriBuilder -> uriBuilder.path("/{conversationId}/messages")
                        .queryParam("access_token", pageAccessToken)
                        .queryParam("limit", limit)
                        .queryParam("fields", "id,from,to,message,created_time")
                        .build(conversationId))
                .retrieve()
                .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(), 
                        clientResponse -> clientResponse.bodyToMono(String.class)
                                .flatMap(errorBody -> {
                                    log.error("❌ Meta API Error (Messages) for conversationId {}: {}", conversationId, errorBody);
                                    return Mono.error(new RuntimeException("Meta API Error: " + errorBody));
                                }))
                .bodyToMono(Map.class)
                .doOnSuccess(res -> {
                    List data = (List) res.get("data");
                    log.info("Fetched {} messages for conversation: {}", (data != null ? data.size() : 0), conversationId);
                    if (data != null && !data.isEmpty()) {
                        log.info("🔍 RAW Message Sample: {}", data.get(0).toString());
                    }
                })
                .doOnError(err -> log.error("Failed to fetch messages for conversation {}: {}", conversationId, err.getMessage()));
    }

    /**
     * Send a message to a recipient
     */
    public Mono<Map> sendMessage(String recipientId, String text, String pageAccessToken) {
        return sendMessage(recipientId, text, pageAccessToken, null);
    }

    /**
     * @param replyToMid when set, Meta threads this as a reply to that message, so the
     *                   customer sees the quoted original in Messenger or Instagram.
     *
     * `reply_to` is a top-level field, not part of `message` — nesting it returns
     * "(#100) Invalid keys \"reply_to\" were found in param \"message\"".
     *
     * Not every conversation accepts it (it depends on the channel and the age of the
     * message), so a rejection falls back to sending the text on its own: losing the
     * quote is better than losing the reply.
     */
    public Mono<Map> sendMessage(String recipientId, String text, String pageAccessToken, String replyToMid) {
        if (replyToMid == null || replyToMid.isBlank()) {
            return post(buildBody(recipientId, text, null), pageAccessToken);
        }

        return post(buildBody(recipientId, text, replyToMid), pageAccessToken)
                .onErrorResume(err -> {
                    log.warn("Reply-to rejected by Meta, resending without the quote: {}", err.getMessage());
                    return post(buildBody(recipientId, text, null), pageAccessToken);
                });
    }

    private Map<String, Object> buildBody(String recipientId, String text, String replyToMid) {
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("recipient", Map.of("id", recipientId));
        body.put("message", Map.of("text", text));
        if (replyToMid != null && !replyToMid.isBlank()) {
            body.put("reply_to", Map.of("mid", replyToMid));
        }
        return body;
    }

    /**
     * Sends an audio file as an attachment. Meta accepts the file directly as multipart,
     * which avoids having to host it on a publicly reachable URL first.
     */
    public Mono<Map> sendAudio(String recipientId, java.io.File file, String pageAccessToken) {
        return sendAttachment(recipientId, file, "audio", "audio/mp4", pageAccessToken);
    }

    /**
     * Fetches a customer's public profile. Meta only exposes this for people who have
     * messaged the page, and it can fail (deleted account, or the permission not yet
     * granted), so callers treat an empty result as normal.
     */
    public Mono<Map> getUserProfile(String psid, String pageAccessToken) {
        return webClient.get()
                .uri(uriBuilder -> uriBuilder.path("/{psid}")
                        .queryParam("fields", "first_name,last_name,profile_pic")
                        .queryParam("access_token", pageAccessToken)
                        .build(psid))
                .retrieve()
                .bodyToMono(Map.class)
                .onErrorResume(err -> {
                    log.debug("Could not fetch profile for {}: {}", psid, err.getMessage());
                    return Mono.empty();
                });
    }

    public Mono<Map> sendAttachment(String recipientId, java.io.File file, String type,
                                    String contentType, String pageAccessToken) {
        var builder = new org.springframework.http.client.MultipartBodyBuilder();
        builder.part("recipient", "{\"id\":\"" + recipientId + "\"}");
        builder.part("message", "{\"attachment\":{\"type\":\"" + type + "\",\"payload\":{\"is_reusable\":false}}}");
        builder.part("filedata", new org.springframework.core.io.FileSystemResource(file))
               .header("Content-Type", contentType);
        var parts = builder.build();

        return webClient.post()
                .uri(uriBuilder -> uriBuilder.path("/me/messages")
                        .queryParam("access_token", pageAccessToken)
                        .build())
                .contentType(org.springframework.http.MediaType.MULTIPART_FORM_DATA)
                .bodyValue(parts)
                .retrieve()
                .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                        clientResponse -> clientResponse.bodyToMono(String.class)
                                .flatMap(errorBody -> {
                                    log.error("❌ Meta API Error (audio): {}", errorBody);
                                    return Mono.error(new RuntimeException("Meta API Error: " + errorBody));
                                }))
                .bodyToMono(Map.class)
                .doOnSuccess(res -> log.info("📎 {} attachment sent: {}", type, res != null ? res.get("message_id") : "?"));
    }

    private Mono<Map> post(Map<String, Object> body, String pageAccessToken) {
        return webClient.post()
                .uri(uriBuilder -> uriBuilder
                        .path("/me/messages")
                        .queryParam("access_token", pageAccessToken)
                        .build())
                .bodyValue(body)
                .retrieve()
                .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(), 
                        clientResponse -> clientResponse.bodyToMono(String.class)
                                .flatMap(errorBody -> {
                                    log.error("❌ Meta API Error Response: {}", errorBody);
                                    return Mono.error(new RuntimeException("Meta API Error: " + errorBody));
                                }))
                .bodyToMono(Map.class)
                .doOnSuccess(res -> log.info("✅ Message sent: {}", res != null ? res.get("message_id") : "?"))
                .doOnError(err -> log.error("❌ Failed to send message: {}", err.getMessage()));
    }
}

