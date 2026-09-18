package io.eksamadhan.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One browser that has agreed to be notified (FR-06).
 *
 * Granted per browser and per device, not per account: permission given on a laptop says
 * nothing about a phone, so an agent has as many of these as they have places they work.
 *
 * {@code p256dh} and {@code auth} are generated inside the browser and given only to us. They
 * are what a push message is encrypted against, so nothing readable passes through Google's or
 * Mozilla's servers on the way — which matters here, because a notification carries a
 * customer's name and the opening of what they wrote.
 */
@Entity
@Table(name = "push_subscriptions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PushSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User user;

    /** Where the push service wants the message posted. Unique: one row per browser. */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String endpoint;

    @Column(nullable = false, columnDefinition = "TEXT")
    @ToString.Exclude
    private String p256dh;

    @Column(nullable = false, columnDefinition = "TEXT")
    @ToString.Exclude
    private String auth;

    /** Only so a person can tell their own devices apart when revoking one. */
    @Column(name = "user_agent", columnDefinition = "TEXT")
    private String userAgent;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "last_used_at")
    private OffsetDateTime lastUsedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }
}
