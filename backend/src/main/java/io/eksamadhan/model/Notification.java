package io.eksamadhan.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One alert an agent was given.
 *
 * Recorded as well as pushed. A browser notification vanishes when it is dismissed and never
 * appears at all on a device that declined permission, so without this the only evidence an
 * agent was ever told something is that they answered — which is no use to whoever is asking
 * why a conversation sat unread.
 */
@Entity
@Table(name = "notifications")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification {

    /** Why it was sent, so the bell can show the urgent ones differently. */
    public enum Kind { ESCALATED, ASSIGNED, CUSTOMER_REPLIED, TEST, MEMBER_LEFT, NEW_TENANT }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User user;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String title;

    @Column(columnDefinition = "TEXT")
    private String body;

    /** Where clicking it goes — the same address the push notification carries. */
    @Column(columnDefinition = "TEXT")
    private String url;

    @Column(name = "thread_id")
    private UUID threadId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Kind kind;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "read_at")
    private OffsetDateTime readAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }
}
