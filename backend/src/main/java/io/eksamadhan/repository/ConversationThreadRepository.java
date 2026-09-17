package io.eksamadhan.repository;

import io.eksamadhan.model.ConversationThread;
import io.eksamadhan.model.SocialPage;
import io.eksamadhan.model.ThreadStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConversationThreadRepository extends JpaRepository<ConversationThread, UUID> {

    Optional<ConversationThread> findBySocialPageAndCustomerId(SocialPage page, String customerId);

    List<ConversationThread> findByTenantIdOrderByLastMessageAtDesc(String tenantId);

    List<ConversationThread> findByTenantIdAndStatusOrderByLastMessageAtDesc(String tenantId, ThreadStatus status);

    long countByTenantIdAndStatus(String tenantId, ThreadStatus status);
}
