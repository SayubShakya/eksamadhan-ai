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
}


