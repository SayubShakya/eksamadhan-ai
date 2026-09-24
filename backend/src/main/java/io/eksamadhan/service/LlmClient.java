package io.eksamadhan.service;

import lombok.extern.slf4j.Slf4j;
import io.eksamadhan.config.ChatProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;
import java.util.Base64;
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
    private final String visionModel;
    private final boolean local;
    private final int maxTokens;
    private final Duration timeout;
    private final int maxAttempts;

    /**
     * Thrown when the model ran out of output budget mid-sentence.
     *
     * Worth its own type because the JSON reply then loses its closing brace, the parser reads
     * that as a refusal, and the customer is handed to a person with the reason "not covered by
     * the knowledge base" — which is a lie, and points whoever reads it at the wrong fix.
     */
    public static class TruncatedReplyException extends IllegalStateException {
        public TruncatedReplyException(String message) { super(message); }
    }

    public LlmClient(ChatProvider.ChatSettings settings,
                     @Value("${app.ai.retry.max-attempts:3}") int maxAttempts,
                     @Value("${app.frontend-url}") String frontendUrl) {
        this.maxAttempts = Math.max(1, maxAttempts);
        this.apiKey = settings.apiKey();
        this.model = settings.model();
        this.visionModel = settings.visionModel();
        this.local = settings.local();
        this.maxTokens = settings.maxTokens();
        this.timeout = Duration.ofSeconds(settings.timeoutSeconds());
        this.webClient = WebClient.builder()
                .baseUrl(settings.baseUrl())
                .codecs(codecs -> codecs.defaultCodecs().maxInMemorySize(MAX_RESPONSE_BYTES))
                .defaultHeader("HTTP-Referer", frontendUrl)
                .defaultHeader("X-Title", "EkSamadhan AI")
                .build();
    }

    /**
     * One request to the model, retried when the failure is worth retrying.
     *
     * This is the project's only automatic feedback loop, and it sits deliberately underneath
     * the human one: without it a single 429 or 503 from the provider escalated a conversation
     * to a person permanently, because a momentary blip and "the AI cannot answer this" reach
     * {@code AiReplyService} as the same thing.
     *
     * A timeout is not retried. The local budget is two minutes, so a second attempt would
     * simply double what the customer waits for a model that is merely slow — that case wants a
     * person, not patience. Nor is 400/401/403: a misconfigured request fails identically
     * however many times it is sent.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> post(Map<String, Object> body) {
        RuntimeException failure = null;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return webClient.post()
                        .uri("/chat/completions")
                        .headers(h -> { if (!apiKey.isEmpty()) h.setBearerAuth(apiKey); })
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(body)
                        .retrieve()
                        .bodyToMono(Map.class)
                        // A customer is waiting: better to escalate to a human than to hang.
                        .timeout(timeout)
                        .block();

            } catch (WebClientResponseException e) {
                if (!worthRetrying(e.getStatusCode().value())) throw e;
                failure = e;
            } catch (WebClientRequestException e) {
                failure = e;   // refused, reset, DNS — the request never landed
            }

            if (attempt == maxAttempts) break;
            log.info("Model call failed ({}), retrying — attempt {} of {}",
                    failure.getMessage(), attempt + 1, maxAttempts);
            pause(attempt);
        }

        throw failure;
    }

    /** Overload, throttling and a provider falling over are all worth a second attempt. */
    private static boolean worthRetrying(int status) {
        return status == 429 || status == 500 || status == 502 || status == 503 || status == 504;
    }

    /**
     * Backs off between attempts, with jitter.
     *
     * The jitter matters when a provider throttles: several conversations fail together, and
     * without it they would all come back at the same instant and be throttled together again.
     */
    private void pause(int attempt) {
        long millis = 400L * attempt * attempt + (long) (Math.random() * 200);
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while waiting to retry the model", e);
        }
    }

    /** A local provider such as Ollama needs no key; a hosted one does. */
    /** Which chat model answers, for the conversation visualizer. */
    public String modelName() {
        return model;
    }

    public boolean isLocal() {
        return local;
    }

    public boolean isConfigured() {
        return !apiKey.isEmpty() || local;
    }

    public String model() {
        return model;
    }

    /**
     * Turns a picture into a sentence, so the rest of the pipeline can treat it as a
     * question: retrieve against it, ground the answer in the knowledge base, and apply the
     * same confidence gate. Describing and answering in one step would skip retrieval
     * entirely and invite the model to invent a policy to go with what it saw.
     *
     * @return a one-line description, or null when the image could not be read
     */
    @SuppressWarnings("unchecked")
    public String describeImage(byte[] image, String contentType) {
        return describeImage(image, contentType, DESCRIBE_PROMPT);
    }

    /** Describes a picture for the knowledge base rather than a customer's message. */
    public String describeForKnowledge(byte[] image, String contentType) {
        return describeImage(image, contentType, CATALOGUE_PROMPT);
    }

    private String describeImage(byte[] image, String contentType, String instruction) {
        if (!isConfigured() || image == null || image.length == 0) return null;

        String mime = (contentType == null || !contentType.startsWith("image/")) ? "image/jpeg" : contentType;
        String dataUrl = "data:" + mime + ";base64," + Base64.getEncoder().encodeToString(image);

        Map<String, Object> response = post(Map.of(
                "model", visionModel,
                "temperature", 0.1,
                "max_tokens", 120,
                "messages", List.of(Map.of("role", "user", "content", List.of(
                        Map.of("type", "text", "text", instruction),
                        Map.of("type", "image_url", "image_url", Map.of("url", dataUrl)))))));

        if (response == null || response.get("error") != null) return null;
        List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
        if (choices == null || choices.isEmpty()) return null;
        Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
        String content = message == null ? null : (String) message.get("content");
        return content == null || content.isBlank() ? null : content.strip();
    }

    private static final String DESCRIBE_PROMPT = """
            A customer sent this image to a support team, usually with no words.

            Write one short sentence describing what they are showing and what they are most
            likely asking about — as if turning the picture into their question. Describe only
            what is visible; do not guess at an order number, a price or a policy.

            Example: "The customer is showing a cracked phone screen, probably asking whether             it is covered."
            """;

    /**
     * Note the explicit "never a question" and the example. An earlier version asked for the
     * description "in the words a customer would use", and the model wrote the customer's
     * question instead of a caption — "Can you tell me more about this black circle?".
     */
    private static final String CATALOGUE_PROMPT = """
            This picture is a business's own reference material — a product photo, a diagram,
            a screenshot.

            Write a caption of one or two sentences describing what is visible: the object,
            its colour, and anything someone might ask about. Write it as a plain statement.
            Never write a question, never address anyone, and never say a customer sent it.

            Do not guess a brand, price or model number that is not readable in the image.

            Example: "A pair of black wireless earbuds beside their closed charging case, \
            with a small LED on the front."
            """;

    /**
     * Turns a voice note into text, so the rest of the pipeline can treat it as a question.
     *
     * Only some models accept audio at all; one that does not returns an error and the caller
     * falls back to handing the conversation to a person, which is what used to happen to
     * every voice message.
     *
     * @param mp3 audio as MP3 — Meta sends AAC, so it is transcoded first
     * @return what was said, or null when it could not be read
     */
    @SuppressWarnings("unchecked")
    public String transcribe(byte[] mp3) {
        if (!isConfigured() || mp3 == null || mp3.length == 0) return null;
        try {
            Map<String, Object> response = post(Map.of(
                    "model", model,
                    "max_tokens", 500,
                    "messages", List.of(Map.of("role", "user", "content", List.of(
                            Map.of("type", "text", "text", TRANSCRIBE_PROMPT),
                            Map.of("type", "input_audio", "input_audio", Map.of(
                                    "data", Base64.getEncoder().encodeToString(mp3),
                                    "format", "mp3")))))));

            if (response == null || response.get("error") != null) return null;
            List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
            if (choices == null || choices.isEmpty()) return null;
            Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
            String text = message == null ? null : (String) message.get("content");
            if (text == null || text.isBlank() || text.strip().equalsIgnoreCase("NO SPEECH")) return null;
            return text.strip();
        } catch (Exception e) {
            log.debug("Could not transcribe audio: {}", e.getMessage());
            return null;
        }
    }

    private static final String TRANSCRIBE_PROMPT = """
            Transcribe this voice message exactly as spoken, in the language it was spoken in.
            Write only the words. If there is no speech, reply NO SPEECH.
            """;

    /**
     * One completion. {@code temperature} is low by default because this answers from
     * supplied context — invention is the failure mode, not dullness.
     */
    @SuppressWarnings("unchecked")
    /**
     * A reasoning model spends its budget thinking before it writes anything, so a limit
     * tuned for a hosted model returns an empty answer rather than a short one — which the
     * caller reads as a refusal. Raise app.ai.chat.max-tokens when pointing at one.
     */
    public String complete(String systemPrompt, String userPrompt) {
        if (!isConfigured()) {
            throw new IllegalStateException("No OpenRouter API key configured");
        }

        Map<String, Object> response = post(Map.of(
                "model", model,
                "temperature", 0.2,
                "max_tokens", maxTokens,
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user", "content", userPrompt))));

        if (response == null) throw new IllegalStateException("No response from the model");
        if (response.get("error") != null) {
            throw new IllegalStateException("OpenRouter error: " + response.get("error"));
        }

        List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
        if (choices == null || choices.isEmpty()) {
            throw new IllegalStateException("The model returned no choices");
        }
        Map<String, Object> choice = choices.get(0);
        Map<String, Object> message = (Map<String, Object>) choice.get("message");
        String content = message == null ? null : (String) message.get("content");

        // The provider says outright when it stopped because the budget ran out, and until now
        // that was read and thrown away. The half-written JSON that follows fails the parser
        // and is reported as a refusal, so the one fact that explains it has to be kept.
        if ("length".equals(choice.get("finish_reason"))) {
            throw new TruncatedReplyException(
                    "The model hit its " + maxTokens + "-token limit before finishing. "
                    + "Raise app.ai.chat.max-tokens, or shorten the context.");
        }

        if (content == null || content.isBlank()) {
            throw new IllegalStateException("The model returned an empty reply");
        }
        return content.strip();
    }
}
