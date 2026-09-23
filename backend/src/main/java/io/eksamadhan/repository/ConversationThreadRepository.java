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

    /**
     * Conversations the AI still owes an answer on — see {@code SyncService.answerMissed}.
     *
     * The window has both ends. The recent end gives the live webhook time to do its job, so a
     * reply already being written is not written twice; the far end keeps a history import from
     * answering conversations that ended weeks ago.
     */
    @org.springframework.data.jpa.repository.Query(
            "SELECT t FROM ConversationThread t WHERE t.socialPage = :page "
          + "AND t.status = io.eksamadhan.model.ThreadStatus.AI_HANDLING "
          + "AND t.unanswered > 0 AND t.lastMessageDirection = 'inbound' "
          + "AND t.lastMessageAt < :settled AND t.lastMessageAt > :oldest")
    List<ConversationThread> findAwaitingAi(SocialPage page,
                                            java.time.ZonedDateTime settled,
                                            java.time.ZonedDateTime oldest);

    @org.springframework.data.jpa.repository.Modifying
    void deleteByTenantId(String tenantId);

    // Narrow writes. Each background path that annotates a conversation — sentiment, the
    // handover brief, the off-topic count — writes only its own columns. Saving the whole
    // entity instead merged a copy loaded before a slow model call back over the row, and
    // silently undid an escalation that had happened in the meantime: the conversation went
    // back to "AI is handling" with nobody assigned, after the handover had been announced.

    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(
            "UPDATE ConversationThread t SET t.sentiment = :sentiment, t.sentimentAt = :at WHERE t.id = :id")
    int updateSentiment(UUID id, String sentiment, java.time.ZonedDateTime at);

    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(
            "UPDATE ConversationThread t SET t.summary = :summary, t.summaryAt = :at, "
          + "t.summaryMessageCount = :messageCount WHERE t.id = :id")
    int updateSummary(UUID id, String summary, java.time.ZonedDateTime at, Integer messageCount);

    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(
            "UPDATE ConversationThread t SET t.offTopicStreak = :streak, t.unrelated = :unrelated WHERE t.id = :id")
    int updateOffTopic(UUID id, int streak, boolean unrelated);
}
