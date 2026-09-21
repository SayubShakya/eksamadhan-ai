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

    public SentimentService(SocialMessageRepository messageRepository,
                            ConversationThreadRepository threadRepository,
                            LlmClient llmClient) {
        this.messageRepository = messageRepository;
        this.threadRepository = threadRepository;
        this.llmClient = llmClient;
    }

    /**
     * Classifies one inbound message and updates its conversation's mood.
     *
     * @return the sentiment, or null when it could not be determined — never throws, since a
     *         missing reading must not cost the message it was reading.
     */
    public Sentiment analyse(UUID messageId) {
        if (!llmClient.isConfigured()) return null;

        SocialMessage message = messageRepository.findWithThreadById(messageId).orElse(null);
        if (message == null || !"inbound".equals(message.getDirection())) return null;

        String text = message.getText();
        if (text == null || text.isBlank()) return null;

        try {
            Sentiment sentiment = parse(llmClient.complete(SYSTEM_PROMPT, text));
            if (sentiment == null) return null;

            message.setSentiment(sentiment);
            messageRepository.save(message);

            ConversationThread thread = message.getThread();
            if (thread != null) {
                thread.setSentiment(sentiment.name());
                thread.setSentimentAt(ZonedDateTime.now());
                threadRepository.save(thread);
            }

            log.info("Sentiment {} for \"{}\"", sentiment, abbreviate(text));
            return sentiment;
        } catch (Exception e) {
            log.debug("Could not read sentiment for message {}: {}", messageId, e.getMessage());
            return null;
        }
    }

    /**
     * Reads messages that arrived before this existed, so a conversation shows a mood
     * immediately rather than only after the customer writes again.
     *
     * Skips anything already classified, so repeated syncs cost nothing.
     */
    @org.springframework.scheduling.annotation.Async("taskExecutor")
    public java.util.concurrent.CompletableFuture<Void> backfillAsync(String tenantId) {
        if (llmClient.isConfigured()) {
            // Only the messages that have never been read — the same reasoning as the memory
            // backfill: this runs on every sync, so it must cost nothing when there is nothing
            // to do, rather than scanning the whole workspace to discover that.
            int read = 0;
            for (SocialMessage message : messageRepository.findWithoutSentiment(tenantId)) {
                if (analyse(message.getId()) != null) read++;
            }
            if (read > 0) log.info("Sentiment backfill for {} read {} messages", tenantId, read);
        }
        return java.util.concurrent.CompletableFuture.completedFuture(null);
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
