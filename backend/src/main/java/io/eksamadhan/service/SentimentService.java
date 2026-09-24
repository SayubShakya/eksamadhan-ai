package io.eksamadhan.service;

import io.eksamadhan.model.ConversationThread;
import io.eksamadhan.model.Sentiment;
import io.eksamadhan.model.SocialMessage;
import io.eksamadhan.repository.ConversationThreadRepository;
import io.eksamadhan.repository.SocialMessageRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.ZonedDateTime;
import java.util.Locale;
import java.util.UUID;

/**
 * Reads how a customer's message feels (report §1.2, "emotion detection analysis").
 *
 * A model rather than a keyword list, for three reasons this project actually hits: customers
 * here write in English, Nepali and romanised Nepali, and no lexicon covers all three;
 * sarcasm and negation ("great, another delay") invert a word list; and emoji carry the mood
 * on their own, often as the entire message. A model handles all of that without a dictionary
 * to maintain.
 *
 * Which model: Jev (TypeSafe System One) whenever it is configured, and then only Jev — the
 * mood is read in the same call that triages the message, so it costs nothing extra, where
 * the generative model was a second call on a local model that serves one request at a time.
 * If Jev cannot be reached the message is left unread and the sync's backfill tries again.
 * The generative model reads it only when there is no TypeSafe key at all.
 */
@Service
@Slf4j
public class SentimentService {

    private static final String SYSTEM_PROMPT = """
            Classify how a customer's message to a support team feels. The message may be in
            English, Nepali, or romanised Nepali, and may be only emoji.

            Answer with exactly one word:

            POSITIVE — pleased, grateful, satisfied. 😊 🙏 ❤️ 👍 count as positive.
            NEUTRAL  — a plain question, a fact, a greeting, or anything with no clear feeling.
            NEGATIVE — unhappy, disappointed, frustrated, complaining. 😞 😔 👎 count here.
            ANGRY    — abusive, insulting, swearing, threatening, or demanding a manager or
                       escalation. 😡 🤬 count here.

            Judge the feeling, not the topic: a calm question about a refund is NEUTRAL.
            Reply with the single word and nothing else.
            """;

    private final SocialMessageRepository messageRepository;
    private final ConversationThreadRepository threadRepository;
    private final LlmClient llmClient;
    private final MessageTriageService triageService;
    private final TraceRecorder trace;
    private final java.util.Set<UUID> inFlight = java.util.concurrent.ConcurrentHashMap.newKeySet();
    private final java.util.Set<String> backfilling = java.util.concurrent.ConcurrentHashMap.newKeySet();

    public SentimentService(SocialMessageRepository messageRepository,
                            ConversationThreadRepository threadRepository,
                            LlmClient llmClient,
                            MessageTriageService triageService,
                            TraceRecorder trace) {
        this.messageRepository = messageRepository;
        this.threadRepository = threadRepository;
        this.llmClient = llmClient;
        this.triageService = triageService;
        this.trace = trace;
    }

    /**
     * Classifies one inbound message and updates its conversation's mood.
     *
     * @return the sentiment, or null when it could not be determined — never throws, since a
     *         missing reading must not cost the message it was reading.
     */
    public Sentiment analyse(UUID messageId) {
        // One reading per message. The reply path and the sync's backfill both reach every new
        // message, and two syncs can overlap, so the same "Hello" was once sent to the local
        // model three times at once — each run a model call that customers queue behind.
        if (!inFlight.add(messageId)) return null;
        try {
            return analyseOnce(messageId);
        } finally {
            inFlight.remove(messageId);
        }
    }

    private Sentiment analyseOnce(UUID messageId) {
        boolean jev = triageService.mode() != MessageTriageService.Mode.OFF;
        if (!jev && !llmClient.isConfigured()) return null;

        SocialMessage message = messageRepository.findWithThreadById(messageId).orElse(null);
        if (message == null || !"inbound".equals(message.getDirection())) return null;

        String text = message.getText();
        if (text == null || text.isBlank()) return null;
        // Already read by whichever path got here first.
        if (message.getSentiment() != null) return message.getSentiment();

        try {
            // With Jev configured the sentiment was read in the same call that triaged the
            // message, before the reply. Only Jev: no generative fallback, so the local model is
            // never asked for it — an unread message is picked up again by the backfill.
            long started = System.nanoTime();
            boolean byJev = jev;
            String raw = null;
            Sentiment sentiment;
            if (jev) {
                sentiment = fromTriage(messageId);
            } else {
                raw = llmClient.complete(SYSTEM_PROMPT, text);
                sentiment = parse(raw);
            }
            if (sentiment == null) return null;
            trace.step(messageId, byJev ? TraceRecorder.Kind.JEV : TraceRecorder.Kind.MODEL,
                    "Read the customer's mood", sentiment.name(),
                    byJev ? TraceRecorder.of("model", "jev (TypeSafe System One)", "text", text,
                                    "note", "read in the same Jev call as the triage")
                          : TraceRecorder.of("model", llmClient.modelName(), "system prompt", SYSTEM_PROMPT, "text", text),
                    TraceRecorder.of("sentiment", sentiment.name(), "raw reply", raw),
                    TraceRecorder.since(started));

            message.setSentiment(sentiment);
            messageRepository.save(message);

            // Only the sentiment columns: this thread was loaded before the model call, and
            // saving all of it would put back whatever status it had then.
            ConversationThread thread = message.getThread();
            if (thread != null) {
                threadRepository.updateSentiment(thread.getId(), sentiment.name(), ZonedDateTime.now());
            }

            log.info("Sentiment {} for \"{}\"", sentiment, abbreviate(text));
            return sentiment;
        } catch (Exception e) {
            log.debug("Could not read sentiment for message {}: {}", messageId, e.getMessage());
            return null;
        }
    }

    private Sentiment fromTriage(UUID messageId) {
        return triageService.triage(messageId)
                .map(t -> {
                    try {
                        return Sentiment.valueOf(t.getSentiment());
                    } catch (RuntimeException e) {
                        return null;
                    }
                })
                .orElse(null);
    }

    /**
     * Reads messages that arrived before this existed, so a conversation shows a mood
     * immediately rather than only after the customer writes again.
     *
     * Skips anything already classified, so repeated syncs cost nothing.
     */
    @org.springframework.scheduling.annotation.Async("taskExecutor")
    public java.util.concurrent.CompletableFuture<Void> backfillAsync(String tenantId) {
        // A backfill already running for this workspace covers these messages too.
        if (!backfilling.add(tenantId)) return java.util.concurrent.CompletableFuture.completedFuture(null);
        try {
            backfill(tenantId);
        } finally {
            backfilling.remove(tenantId);
        }
        return java.util.concurrent.CompletableFuture.completedFuture(null);
    }

    private void backfill(String tenantId) {
        // Open conversations' messages Jev never judged get a priority and a spam check first;
        // their mood then comes from the same judgment.
        try {
            triageService.backfill(tenantId);
        } catch (RuntimeException e) {
            log.debug("Triage backfill for {} failed: {}", tenantId, e.getMessage());
        }
        if (llmClient.isConfigured() || triageService.mode() != MessageTriageService.Mode.OFF) {
            // Only the messages that have never been read — the same reasoning as the memory
            // backfill: this runs on every sync, so it must cost nothing when there is nothing
            // to do, rather than scanning the whole workspace to discover that.
            int read = 0;
            for (SocialMessage message : messageRepository.findWithoutSentiment(tenantId)) {
                if (analyse(message.getId()) != null) read++;
            }
            if (read > 0) log.info("Sentiment backfill for {} read {} messages", tenantId, read);
        }
    }

    /** Models add punctuation or a sentence around the word often enough to be tolerant. */
    private Sentiment parse(String raw) {
        if (raw == null) return null;
        String upper = raw.toUpperCase(Locale.ROOT);
        for (Sentiment candidate : Sentiment.values()) {
            if (upper.contains(candidate.name())) return candidate;
        }
        return null;
    }

    private static String abbreviate(String text) {
        String flat = text.replace('\n', ' ').strip();
        return flat.length() <= 50 ? flat : flat.substring(0, 50) + "…";
    }
}
