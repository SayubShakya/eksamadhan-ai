package io.eksamadhan.repository;

import io.eksamadhan.model.SocialMessage;
import io.eksamadhan.model.SocialPage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
import java.util.List;
import java.util.Optional;

public interface SocialMessageRepository extends JpaRepository<SocialMessage, UUID> {
    List<SocialMessage> findBySocialPageOrderByTimestampDesc(SocialPage socialPage);
    Optional<SocialMessage> findByExternalMessageId(String externalMessageId);
    
    // For de-duplication during sync
    boolean existsByMetaMessageId(String metaMessageId);
    Optional<SocialMessage> findByMetaMessageId(String metaMessageId);
    
    // Find messages for a organization, sorted for chat UI
    List<SocialMessage> findByTenantIdOrderByTimestampAsc(String tenantId);
    
    // Alias for the column we added
    List<SocialMessage> findByPageId(String pageId);

    // For read status tracking
    List<SocialMessage> findByRecipientId(String recipientId);

    // For cleanup during logout
    /**
     * Fetch-joined: the AI reply path reads the thread's status on an async thread, where
     * `open-in-view: false` means a lazy proxy cannot initialise. LEFT so a message that
     * predates threading still comes back.
     */
    @org.springframework.data.jpa.repository.Query(
            "SELECT m FROM SocialMessage m LEFT JOIN FETCH m.thread WHERE m.id = :id")
    java.util.Optional<SocialMessage> findWithThreadById(java.util.UUID id);

    /** The message with its page and that page's organisation — the triage needs all three. */
    @org.springframework.data.jpa.repository.Query(
            "SELECT m FROM SocialMessage m LEFT JOIN FETCH m.thread "
          + "LEFT JOIN FETCH m.socialPage p LEFT JOIN FETCH p.organization WHERE m.id = :id")
    java.util.Optional<SocialMessage> findWithPageById(java.util.UUID id);

    /**
     * The newest customer messages across every workspace, for the system admin's
     * conversation visualizer. Page, workspace and thread are fetched with them: the list
     * shows all three, and nothing lazy can load once the query returns.
     */
    @org.springframework.data.jpa.repository.Query(
            "SELECT m FROM SocialMessage m LEFT JOIN FETCH m.thread "
          + "LEFT JOIN FETCH m.socialPage p LEFT JOIN FETCH p.organization "
          + "WHERE m.direction = 'inbound' ORDER BY m.timestamp DESC")
    java.util.List<SocialMessage> findRecentInbound(org.springframework.data.domain.Pageable page);

    /**
     * Which of these Meta ids we already hold.
     *
     * The sync used to ask that one message at a time, so a poll over four conversations ran a
     * hundred queries to discover it had nothing to do. One query answers the same question.
     */
    @org.springframework.data.jpa.repository.Query(
            "SELECT m.metaMessageId FROM SocialMessage m WHERE m.metaMessageId IN :ids")
    java.util.List<String> findKnownMetaIds(java.util.Collection<String> ids);

    /**
     * Messages still missing their conversation-memory vector.
     *
     * The backfill used to read every message in the workspace on every sync and check each one
     * in Java. Asking the database the actual question means a quiet workspace costs one
     * indexed lookup that returns nothing.
     */
    @org.springframework.data.jpa.repository.Query(
            "SELECT m FROM SocialMessage m WHERE m.tenantId = :tenantId "
          + "AND NOT EXISTS (SELECT e FROM MessageEmbedding e WHERE e.socialMessageId = m.id) "
          + "ORDER BY m.timestamp")
    java.util.List<SocialMessage> findWithoutEmbedding(String tenantId);

    /** Inbound messages whose sentiment has never been read. Same reasoning as above. */
    @org.springframework.data.jpa.repository.Query(
            "SELECT m FROM SocialMessage m WHERE m.tenantId = :tenantId AND m.sentiment IS NULL "
          + "AND m.direction = 'inbound' AND m.text IS NOT NULL AND m.text <> '' "
          + "ORDER BY m.timestamp")
    java.util.List<SocialMessage> findWithoutSentiment(String tenantId);

    /** The tail of a conversation, newest first — see {@code AiReplyService.outstanding}. */
    @org.springframework.data.jpa.repository.Query(
            "SELECT m FROM SocialMessage m WHERE m.thread = :thread ORDER BY m.timestamp DESC")
    java.util.List<SocialMessage> findRecent(io.eksamadhan.model.ConversationThread thread,
                                             org.springframework.data.domain.Pageable page);

    /** The customer's most recent message in a conversation — what the AI owes an answer to. */
    @org.springframework.data.jpa.repository.Query(
            "SELECT m FROM SocialMessage m WHERE m.thread = :thread AND m.direction = 'inbound' "
          + "ORDER BY m.timestamp DESC")
    java.util.List<SocialMessage> findLatestInbound(io.eksamadhan.model.ConversationThread thread,
                                                    org.springframework.data.domain.Pageable page);

    /**
     * Writes just the transcript.
     *
     * A targeted update rather than saving the whole entity: the message is loaded detached,
     * outside a transaction, and relying on merge to write one field back is both opaque and
     * easy to lose to a concurrent write of the same row.
     */
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query(
            "UPDATE SocialMessage m SET m.transcript = :transcript WHERE m.id = :id")
    int saveTranscript(java.util.UUID id, String transcript);

    void deleteByTenantId(String tenantId);

    /** Every message a page brought in; their traces, triage and embeddings go with them (ON DELETE CASCADE). */
    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("DELETE FROM SocialMessage m WHERE m.socialPage = :page")
    int deleteBySocialPage(io.eksamadhan.model.SocialPage page);

    /** Replies this person sent to customers: kept on deletion, their name no longer attached. */
    long countBySentByUserId(java.util.UUID userId);

    java.util.List<SocialMessage> findBySentByUserIdOrderByTimestampAsc(java.util.UUID userId);
}
