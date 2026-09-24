package io.eksamadhan.repository;

import io.eksamadhan.model.MessageTriage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MessageTriageRepository extends JpaRepository<MessageTriage, UUID> {

    Optional<MessageTriage> findBySocialMessageId(UUID socialMessageId);

    /**
     * Whether anyone in this conversation has asked the business for something real. A
     * conversation with a genuine request in it is never flagged as spam, however the next
     * message reads: a customer who asked about delivery and then sent "asdf" is still a
     * customer, and silencing them is the mistake worth never making.
     */
    @org.springframework.data.jpa.repository.Query(value = """
            SELECT EXISTS (
                SELECT 1 FROM message_triage mt
                JOIN social_messages m ON m.id = mt.social_message_id
                WHERE m.thread_id = :threadId
                  AND mt.intent IN ('business_question', 'complaint', 'wants_human')
                  AND (mt.spam IS NULL OR mt.spam < :spamThreshold))
            """, nativeQuery = true)
    boolean threadHasCustomerRequest(UUID threadId, double spamThreshold);

    /**
     * Customer messages in open conversations that were never judged, or judged before the
     * spam and urgency questions existed — so conversations already in the inbox get a
     * priority too, not only ones that start after this shipped. Oldest first, a batch at a
     * time, because the sync that calls it runs every thirty seconds.
     */
    @org.springframework.data.jpa.repository.Query(value = """
            SELECT m.id FROM social_messages m
            JOIN conversation_threads t ON t.id = m.thread_id
            LEFT JOIN message_triage mt ON mt.social_message_id = m.id
            WHERE m.tenant_id = :tenantId AND m.direction = 'inbound'
              AND COALESCE(m.text, '') <> '' AND t.status <> 'RESOLVED'
              AND (mt.id IS NULL OR mt.urgency IS NULL)
            ORDER BY m.timestamp
            LIMIT 25
            """, nativeQuery = true)
    java.util.List<UUID> findNeedingTriage(String tenantId);

    /**
     * Spam probability of the conversation's latest customer messages with text, newest first —
     * null for one never judged. How many in a row were spam decides whether spam after a real
     * question is one odd message or the conversation turning into spam again.
     */
    @org.springframework.data.jpa.repository.Query(value = """
            SELECT mt.spam FROM social_messages m
            LEFT JOIN message_triage mt ON mt.social_message_id = m.id
            WHERE m.thread_id = :threadId AND m.direction = 'inbound' AND COALESCE(m.text, '') <> ''
            ORDER BY m.timestamp DESC
            LIMIT :limit
            """, nativeQuery = true)
    java.util.List<Double> recentSpamScores(UUID threadId, int limit);
}
