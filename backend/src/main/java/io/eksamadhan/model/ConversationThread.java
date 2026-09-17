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
    uniqueConstraints = @UniqueConstraint(columnNames = {"social_page_id", "customer_id"}),
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
