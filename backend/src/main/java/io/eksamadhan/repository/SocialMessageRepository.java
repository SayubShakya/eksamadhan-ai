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
    
    // Find messages for a tenant, sorted for chat UI
    List<SocialMessage> findByTenantIdOrderByTimestampAsc(String tenantId);
    
    // Alias for the column we added
    List<SocialMessage> findByPageId(String pageId);

    // For read status tracking
    List<SocialMessage> findByRecipientId(String recipientId);

    // For cleanup during logout
    void deleteByTenantId(String tenantId);
}


