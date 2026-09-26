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

    /** Per connected page: conversations, how many are with a person now, and the latest message. */
    @org.springframework.data.jpa.repository.Query(
            "SELECT t.socialPage.id, COUNT(t), "
          + "SUM(CASE WHEN t.status IN (io.eksamadhan.model.ThreadStatus.OPEN_FOR_AGENT, "
          + "io.eksamadhan.model.ThreadStatus.AGENT_HANDLING) THEN 1 ELSE 0 END), MAX(t.lastMessageAt) "
          + "FROM ConversationThread t WHERE t.tenantId = :tenantId AND t.socialPage IS NOT NULL "
          + "GROUP BY t.socialPage.id")
    List<Object[]> statsPerPage(String tenantId);

    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("DELETE FROM ConversationThread t WHERE t.socialPage = :page")
    int deleteBySocialPage(io.eksamadhan.model.SocialPage page);

    /** Handed to a person but nobody was available: the queue, oldest first. */
    @org.springframework.data.jpa.repository.Query(
            "SELECT t FROM ConversationThread t WHERE t.tenantId = :tenantId "
          + "AND t.status = io.eksamadhan.model.ThreadStatus.OPEN_FOR_AGENT "
          + "AND t.assignedAgentId IS NULL AND t.spam = false "
          + "ORDER BY t.escalatedAt ASC NULLS FIRST")
    List<ConversationThread> findUnassignedWaiting(String tenantId);

    /**
     * Take a waiting conversation for someone, only if nobody took it first. Two people coming
     * online at the same moment must not both be told the same customer is theirs.
     */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(
            "UPDATE ConversationThread t SET t.assignedAgentId = :agentId "
          + "WHERE t.id = :id AND t.assignedAgentId IS NULL")
    int claimUnassigned(java.util.UUID id, String agentId);

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
          + "AND t.unanswered > 0 AND t.lastMessageDirection = 'inbound' AND t.spam = false "
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

    /** Only ever raises it: the conversation is as urgent as its most urgent message. */
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(
            "UPDATE ConversationThread t SET t.priority = :priority "
          + "WHERE t.id = :id AND (t.priority IS NULL OR t.priority > :priority)")
    int raisePriority(UUID id, int priority);

    /** A no-op, returning 0, if it is already spam or a person has said it is not. */
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(
            "UPDATE ConversationThread t SET t.spam = true, t.spamKind = :kind, t.spamScore = :score, "
          + "t.spamMessageId = :messageId, t.spamAt = :at "
          + "WHERE t.id = :id AND t.spam = false AND t.spamCleared = false")
    int markSpam(UUID id, String kind, double score, UUID messageId, java.time.ZonedDateTime at);

    /** A spam message ignored on its own: it is not waiting for a reply. */
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(
            "UPDATE ConversationThread t SET t.unanswered = t.unanswered - 1 WHERE t.id = :id AND t.unanswered > 0")
    int forgetOneWaiting(UUID id);

    /** A person says it is not spam: out of the Spam tab, and never flagged automatically again. */
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(
            "UPDATE ConversationThread t SET t.spam = false, t.spamCleared = true WHERE t.id = :id")
    int clearSpam(UUID id);

    /** The customer's own genuine request brought it back. Returns 0 if it was not spam. */
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(
            "UPDATE ConversationThread t SET t.spam = false WHERE t.id = :id AND t.spam = true")
    int restoreFromSpam(UUID id);

    long countByAssignedAgentId(String agentId);

    /**
     * A person leaving (deactivated or deleted) hands their open conversations back to the queue,
     * so no customer is left with someone who is gone; routing then gives them to whoever is here.
     */
    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("UPDATE ConversationThread t SET t.assignedAgentId = NULL, "
          + "t.status = io.eksamadhan.model.ThreadStatus.OPEN_FOR_AGENT "
          + "WHERE t.assignedAgentId = :agentId AND t.status IN "
          + "(io.eksamadhan.model.ThreadStatus.OPEN_FOR_AGENT, io.eksamadhan.model.ThreadStatus.AGENT_HANDLING)")
    int releaseToQueue(String agentId);
}
