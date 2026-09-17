package io.eksamadhan.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Turns text into vectors, through OpenRouter.
 *
 * OpenRouter is an OpenAI-compatible gateway, and the model used is OpenAI's own
 * text-embedding-3-small — so this satisfies the contextual report's choice of OpenAI
 * embeddings while needing only the one API key the project already has.
 */
@Service
@Slf4j
public class EmbeddingClient {

    /** OpenRouter accepts batches; this bounds one request's size. */
    private static final int MAX_BATCH = 64;

    /**
     * WebClient buffers a response in memory and defaults to 256 KB, which is nowhere near
     * enough here: one embedding is 1536 floats, and serialised as JSON that is roughly
     * 30 KB, so even a handful of chunks overflows it. A full batch is a few megabytes.
     */
    private static final int MAX_RESPONSE_BYTES = 32 * 1024 * 1024;

    private final WebClient webClient;
    private final String apiKey;
    private final String model;
    private final boolean local;
    private boolean warnedAboutMissingKey;

    private final int dimensions;

    public EmbeddingClient(@Value("${app.ai.embeddings.api-key:}") String apiKey,
                           @Value("${app.ai.embeddings.base-url}") String baseUrl,
                           @Value("${app.ai.embeddings.model}") String model,
                           @Value("${app.ai.embeddings.dimensions:1536}") int dimensions,
                           @Value("${app.frontend-url}") String frontendUrl) {
        this.dimensions = dimensions;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model;
        this.local = baseUrl.contains("localhost") || baseUrl.contains("127.0.0.1");
        this.webClient = WebClient.builder()
                .baseUrl(baseUrl)
                .codecs(codecs -> codecs.defaultCodecs().maxInMemorySize(MAX_RESPONSE_BYTES))
                // Optional, and purely attribution: OpenRouter shows these on its
                // public app listings.
                .defaultHeader("HTTP-Referer", frontendUrl)
                .defaultHeader("X-Title", "EkSamadhan AI")
                .build();
    }

    public String model() {
        return model;
    }

    /**
     * A local provider such as Ollama needs no key, so requiring one would make it look
     * unconfigured. Anything else does need one: a hosted endpoint reached without a key
     * fails per request, which is a worse way to find out.
     */
    public boolean isConfigured() {
        return !apiKey.isEmpty() || local;
    }

    /** Convenience for the single-text case, such as a search query. */
    public float[] embed(String text) {
        return embedAll(List.of(text)).get(0);
    }

    /**
     * Embeds in input order, batching to keep requests a sane size.
     *
     * @throws IllegalStateException if no API key is configured — refusing outright is
     *         better than writing half-indexed sources that silently never match.
     */
    public List<float[]> embedAll(List<String> texts) {
        if (!isConfigured()) {
            if (!warnedAboutMissingKey) {
                log.error("No embeddings API key is set, so nothing can be embedded. "
                        + "Set OPEN_ROUTER_KEY (or EMBEDDINGS_API_KEY) in backend/.env and restart.");
                warnedAboutMissingKey = true;
            }
            throw new IllegalStateException("No OpenRouter API key configured");
        }

        List<float[]> vectors = new ArrayList<>(texts.size());
        for (int start = 0; start < texts.size(); start += MAX_BATCH) {
            vectors.addAll(embedBatch(texts.subList(start, Math.min(start + MAX_BATCH, texts.size()))));
        }
        return vectors;
    }

    @SuppressWarnings("unchecked")
    private List<float[]> embedBatch(List<String> batch) {
        Map<String, Object> response = webClient.post()
                .uri("/embeddings")
                .headers(h -> { if (!apiKey.isEmpty()) h.setBearerAuth(apiKey); })
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("model", model, "input", batch))
                .retrieve()
                .bodyToMono(Map.class)
                // Embedding a large document should not hang a background thread forever.
                .timeout(Duration.ofSeconds(60))
                .block();

        if (response == null || !(response.get("data") instanceof List<?> data)) {
            throw new IllegalStateException("OpenRouter returned no embedding data");
        }
        if (data.size() != batch.size()) {
            throw new IllegalStateException(
                    "OpenRouter returned " + data.size() + " embeddings for " + batch.size() + " inputs");
        }

        // The API may return items out of order; each carries its own index.
        float[][] ordered = new float[batch.size()][];
        for (Object item : data) {
            Map<String, Object> entry = (Map<String, Object>) item;
            int index = ((Number) entry.getOrDefault("index", 0)).intValue();
            List<Number> values = (List<Number>) entry.get("embedding");
            float[] vector = new float[values.size()];
            for (int i = 0; i < values.size(); i++) {
                vector[i] = values.get(i).floatValue();
            }
            // The schema fixes the column at a set width, so a model of a different width
            // would fail at the database with an opaque error. Say what is actually wrong.
            if (vector.length != dimensions) {
                throw new IllegalStateException(("Model %s returns %d-dimension vectors, but the "
                        + "schema stores %d. Changing embedding model needs a migration and a "
                        + "full re-index.").formatted(model, vector.length, dimensions));
            }
            ordered[index] = vector;
        }
        return List.of(ordered);
    }
}
