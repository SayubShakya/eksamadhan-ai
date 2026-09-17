package io.eksamadhan.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Where chat completions come from, decided in one place.
 *
 * A local model and a hosted one differ in more than a URL: a local reasoning model needs a
 * far larger token budget and a far longer timeout, and needs no API key. Setting those four
 * things by hand every time you switch is how a demo ends up half-switched — pointing at
 * Ollama with a 20-second timeout, so every reply escalates.
 *
 * So {@code AI_CHAT_PROVIDER} picks a whole set of defaults, and any individual value can
 * still be overridden if you want something the defaults do not cover.
 */
@Configuration
@Slf4j
public class ChatProvider {

    /** Everything a chat client needs, already resolved. */
    public record ChatSettings(String baseUrl, String apiKey, String model, String visionModel,
                               int maxTokens, int timeoutSeconds, boolean local) {}

    @Bean
    public ChatSettings chatSettings(
            @Value("${app.ai.chat.provider:openrouter}") String provider,
            @Value("${app.ai.chat.api-key:}") String apiKey,
            @Value("${app.ai.chat.base-url:}") String baseUrl,
            @Value("${app.ai.chat.model:}") String model,
            @Value("${app.ai.chat.vision-model:}") String visionModel,
            @Value("${app.ai.chat.max-tokens:0}") int maxTokens,
            @Value("${app.ai.chat.timeout-seconds:0}") int timeoutSeconds,
            @Value("${app.ai.chat.local.base-url:http://localhost:11434/v1}") String localUrl,
            @Value("${app.ai.chat.local.model:qwen3.5:9b}") String localModel,
            @Value("${app.ai.openrouter-url:https://openrouter.ai/api/v1}") String hostedUrl,
            @Value("${app.ai.chat.hosted.model:openai/gpt-4o-mini}") String hostedModel) {

        boolean local = "local".equalsIgnoreCase(provider.trim())
                || "ollama".equalsIgnoreCase(provider.trim());

        // Blank means "whatever this provider normally wants", so switching provider is one
        // variable rather than four.
        String url = blank(baseUrl) ? (local ? localUrl : hostedUrl) : baseUrl;
        String chatModel = blank(model) ? (local ? localModel : hostedModel) : model;

        // A local reasoning model spends its budget thinking before it writes, and runs
        // roughly two minutes on consumer hardware; the hosted defaults would time out on
        // every reply and escalate the lot.
        int tokens = maxTokens > 0 ? maxTokens : (local ? 2500 : 600);
        int timeout = timeoutSeconds > 0 ? timeoutSeconds : (local ? 180 : 20);

        log.info("Chat provider: {} ({}), model {}, {} tokens, {}s timeout",
                local ? "local" : "hosted", url, chatModel, tokens, timeout);

        if (local) {
            log.info("Embeddings stay on {} — the schema stores vector(1536), so a local "
                    + "embedding model would need a migration and a full re-index.", hostedUrl);
        }

        return new ChatSettings(url, apiKey == null ? "" : apiKey.trim(), chatModel,
                blank(visionModel) ? chatModel : visionModel, tokens, timeout, local);
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
