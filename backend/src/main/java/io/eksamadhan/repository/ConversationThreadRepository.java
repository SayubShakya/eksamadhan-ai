package io.eksamadhan.repository;

import io.eksamadhan.model.ConversationThread;
import io.eksamadhan.model.SocialPage;
import io.eksamadhan.model.ThreadStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConversationThreadRepository extends JpaRepository<ConversationThread, UUID> {

    /**
     * The customer's live conversation, if they have one. A resolved conversation is history:
     * the next message they send starts a new one rather than reopening it.
     *
     * A list rather than an Optional so that rows predating the partial unique index cannot
     * throw; the newest wins.
     */
    @org.springframework.data.jpa.repository.Query(
            "SELECT t FROM ConversationThread t WHERE t.socialPage = :page "
          + "AND t.customerId = :customerId "
          + "AND t.status <> io.eksamadhan.model.ThreadStatus.RESOLVED "
          + "ORDER BY t.lastMessageAt DESC")
    List<ConversationThread> findActive(SocialPage page, String customerId);

    List<ConversationThread> findByTenantIdOrderByLastMessageAtDesc(String tenantId);

    List<ConversationThread> findByTenantIdAndStatusOrderByLastMessageAtDesc(String tenantId, ThreadStatus status);

    long countByTenantIdAndStatus(String tenantId, ThreadStatus status);

    /**
     * How many live conversations each agent is already holding — the load that routing
     * balances. Only OPEN_FOR_AGENT and AGENT_HANDLING count: a resolved thread is not work.
     */
    @org.springframework.data.jpa.repository.Query(
            "SELECT t.assignedAgentId, COUNT(t) FROM ConversationThread t "
          + "WHERE t.tenantId = :tenantId AND t.assignedAgentId IS NOT NULL "
          + "AND t.status IN (io.eksamadhan.model.ThreadStatus.OPEN_FOR_AGENT, "
          + "                 io.eksamadhan.model.ThreadStatus.AGENT_HANDLING) "
          + "GROUP BY t.assignedAgentId")
    List<Object[]> countOpenPerAgent(String tenantId);

    @org.springframework.data.jpa.repository.Modifying
    void deleteByTenantId(String tenantId);
}
