package io.eksamadhan.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Chat completions through OpenRouter — the generation half of RAG.
 *
 * Deliberately thin. The prompt, the grounding rules and the confidence handling live in
 * {@link AiReplyService}, because those are product decisions; this class only knows how to
 * get text out of a model.
 */
@Service
@Slf4j
public class LlmClient {

    /** Same reason as EmbeddingClient: WebClient's 256 KB default is not a sane ceiling. */
    private static final int MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

    private final WebClient webClient;
    private final String apiKey;
    private final String model;
    private final Duration timeout;

    public LlmClient(@Value("${app.ai.openrouter-key:}") String apiKey,
                     @Value("${app.ai.openrouter-url}") String baseUrl,
                     @Value("${app.ai.chat-model}") String model,
                     @Value("${app.ai.reply-timeout-seconds:20}") int timeoutSeconds,
                     @Value("${app.frontend-url}") String frontendUrl) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model;
        this.timeout = Duration.ofSeconds(timeoutSeconds);
        this.webClient = WebClient.builder()
                .baseUrl(baseUrl)
                .codecs(codecs -> codecs.defaultCodecs().maxInMemorySize(MAX_RESPONSE_BYTES))
                .defaultHeader("HTTP-Referer", frontendUrl)
                .defaultHeader("X-Title", "EkSamadhan AI")
                .build();
    }

    public boolean isConfigured() {
        return !apiKey.isEmpty();
    }

    public String model() {
        return model;
    }

    /**
     * One completion. {@code temperature} is low by default because this answers from
     * supplied context — invention is the failure mode, not dullness.
     */
    @SuppressWarnings("unchecked")
    public String complete(String systemPrompt, String userPrompt) {
        if (!isConfigured()) {
            throw new IllegalStateException("No OpenRouter API key configured");
        }

        Map<String, Object> response = webClient.post()
                .uri("/chat/completions")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of(
                        "model", model,
                        "temperature", 0.2,
                        "max_tokens", 600,
                        "messages", List.of(
                                Map.of("role", "system", "content", systemPrompt),
                                Map.of("role", "user", "content", userPrompt))))
                .retrieve()
                .bodyToMono(Map.class)
                // A customer is waiting: better to escalate to a human than to hang.
                .timeout(timeout)
                .block();

        if (response == null) throw new IllegalStateException("No response from the model");
        if (response.get("error") != null) {
            throw new IllegalStateException("OpenRouter error: " + response.get("error"));
        }

        List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
        if (choices == null || choices.isEmpty()) {
            throw new IllegalStateException("The model returned no choices");
        }
        Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
        String content = message == null ? null : (String) message.get("content");
        if (content == null || content.isBlank()) {
            throw new IllegalStateException("The model returned an empty reply");
        }
        return content.strip();
    }
}
