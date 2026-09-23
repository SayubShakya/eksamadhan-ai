package io.eksamadhan.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

import java.time.Duration;
import java.util.Map;

/**
 * TypeSafe's System One endpoint — Jev — which returns typed judgments (a choice, a score, a
 * yes/no probability) rather than generated text.
 *
 * Kept deliberately thin: one POST, one retry on throttling. It sits in front of the reply,
 * so a slow or failing call must cost the customer as little as possible; the caller falls
 * back to the existing pipeline on any failure rather than waiting here.
 */
@Service
@Slf4j
public class TypeSafeClient {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String model;
    private final Duration timeout;

    public TypeSafeClient(@Value("${app.triage.api-key:}") String apiKey,
                          @Value("${app.triage.base-url:https://api.typesafe.ai/v1}") String baseUrl,
                          @Value("${app.triage.model:jev-latest}") String model,
                          @Value("${app.triage.timeout-ms:3000}") long timeoutMs,
                          ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
        this.model = model;
        this.timeout = Duration.ofMillis(timeoutMs);
        this.webClient = WebClient.builder().baseUrl(baseUrl).build();
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    /**
     * Asks every question against the same state in one request — they are evaluated in
     * parallel, so asking four costs little more than asking one.
     *
     * @return the response's {@code answers} and {@code usage}
     * @throws IllegalStateException when the call fails, so the caller can fall back
     */
    public JsonNode evaluate(Object state, Map<String, Object> questions) {
        try {
            return evaluateAsync(state, questions).block(timeout);
        } catch (IllegalStateException e) {
            throw e;
        } catch (RuntimeException e) {
            throw new IllegalStateException("TypeSafe call failed: " + e.getMessage(), e);
        }
    }

    /**
     * The same call, not yet made — so two requests over different state can run side by
     * side and cost one round trip between them.
     */
    public Mono<JsonNode> evaluateAsync(Object state, Map<String, Object> questions) {
        if (!isConfigured()) return Mono.error(new IllegalStateException("TypeSafe is not configured"));
        Map<String, Object> body = Map.of("model", model, "state", state, "questions", questions);
        return webClient.post()
                .uri("/systemone")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve()
                // Decoded as a Map like every other client here, then read as a tree.
                .bodyToMono(Map.class)
                .map(raw -> (JsonNode) objectMapper.valueToTree(raw))
                .flatMap(response -> response.has("answers")
                        ? Mono.just(response)
                        : Mono.error(new IllegalStateException("TypeSafe returned no answers")))
                // 429 throttled and 529 overloaded are the two the API documents as
                // retryable. One retry only: the customer is waiting on the other side.
                .retryWhen(Retry.fixedDelay(1, Duration.ofMillis(400)).filter(TypeSafeClient::retryable))
                .onErrorMap(WebClientResponseException.class, e -> new IllegalStateException(
                        "TypeSafe returned HTTP " + e.getStatusCode().value(), e));
    }

    public Duration timeout() {
        return timeout;
    }

    private static boolean retryable(Throwable e) {
        return e instanceof WebClientResponseException r
                && (r.getStatusCode().value() == 429 || r.getStatusCode().value() == 529);
    }
}
