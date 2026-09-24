package io.eksamadhan.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.ZonedDateTime;
import java.util.UUID;

/**
 * One conversation with one customer on one channel.
 *
 * Messages used to hang off a page, which meant there was nowhere to record whether the
 * AI or a human was answering. Escalation, routing and the agent takeover all need a
 * per-conversation state, so they hang off this instead.
 *
 * Named ConversationThread rather than Thread to avoid colliding with java.lang.Thread.
 */
@Entity
@Table(
    name = "conversation_threads",
    // No unique constraint here: a customer may have many conversations over time, and only
    // the live one is unique. That is a partial index (uk_thread_active in V11), which JPA
    // cannot express — so the database owns the rule and this annotation must not restate it.
    indexes = {
        @Index(name = "idx_thread_tenant", columnList = "tenant_id"),
        @Index(name = "idx_thread_status", columnList = "status"),
        @Index(name = "idx_thread_last_message", columnList = "last_message_at")
    }
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConversationThread {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Meta's page-scoped id for the customer. Unique per page, not globally. */
    @Column(name = "customer_id", nullable = false)
    private String customerId;

    private String customerName;

    @Column(columnDefinition = "TEXT")
    private String customerAvatarUrl;

    @Column(nullable = false)
    private String platform;            // "facebook", "instagram", "web"

    @Column(name = "tenant_id", nullable = false)
    private String tenantId;

    /** Denormalised from the page: the DTO must not touch a lazy association. */
    @Column(name = "page_id", nullable = false)
    private String pageId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "social_page_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private SocialPage socialPage;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private ThreadStatus status = ThreadStatus.AI_HANDLING;

    /** Set when an agent takes over. Null until the user model exists (Phase 1). */
    private String assignedAgentId;

    /** Sentiment of the most recent customer message, once Phase 2 populates it. */
    private String sentiment;

    /** When the conversation's mood was last assessed. */
    @Column(name = "sentiment_at")
    private ZonedDateTime sentimentAt;

    /** Why this was handed to a human. Null while the AI is still handling it. */
    @Column(name = "escalation_reason")
    private String escalationReason;

    /**
     * How many unrelated messages have arrived in a row. Reset by anything the AI can answer,
     * so a customer who asks one odd question is not treated as a nuisance.
     */
    @Column(name = "off_topic_streak", nullable = false)
    @Builder.Default
    private int offTopicStreak = 0;

    /** Closed by the AI as nothing to do with the business. Excluded from deflection. */
    @Column(nullable = false)
    @Builder.Default
    private boolean unrelated = false;

    /**
     * 1 urgent, 2 normal, 3 low — the most urgent customer message in the conversation, as
     * judged by Jev. Null until a message has been judged.
     */
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.SMALLINT)
    private Integer priority;

    /** Judged spam: kept off the Active tab, and the AI does not answer it. */
    @Column(nullable = false)
    @Builder.Default
    private boolean spam = false;

    /** Why it was flagged: promotion, scam or gibberish. Kept after a person clears it. */
    @Column(name = "spam_kind", length = 16)
    private String spamKind;

    /** How sure Jev was, 0–1. */
    @Column(name = "spam_score")
    private Double spamScore;

    /** The message that decided it. */
    @Column(name = "spam_message_id")
    private UUID spamMessageId;

    @Column(name = "spam_at")
    private ZonedDateTime spamAt;

    /** A person said it is not spam; it is never flagged automatically again. */
    @Column(name = "spam_cleared", nullable = false)
    @Builder.Default
    private boolean spamCleared = false;

    /** A short brief for whoever picks this up, so they need not read the whole thread. */
    @Column(columnDefinition = "TEXT")
    private String summary;

    @Column(name = "summary_at")
    private ZonedDateTime summaryAt;

    /** How many messages the summary covered, so the UI can tell when it has gone stale. */
    @Column(name = "summary_message_count")
    private Integer summaryMessageCount;

    /** Denormalised so the inbox can sort and preview without loading every message. */
    private ZonedDateTime lastMessageAt;

    @Column(columnDefinition = "TEXT")
    private String lastMessagePreview;

    private String lastMessageDirection;

    /** Customer messages since the agent or AI last replied. */
    @Builder.Default
    private int unanswered = 0;

    private ZonedDateTime createdAt;
    private ZonedDateTime escalatedAt;
    private ZonedDateTime resolvedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = ZonedDateTime.now();
    }
}
