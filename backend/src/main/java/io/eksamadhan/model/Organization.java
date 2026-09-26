package io.eksamadhan.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A workspace. One organization owns its connected pages, conversations and users.
 *
 * {@code apiKey} is the organization's handle inside the service layer: it is denormalised
 * into the {@code tenant_id} column of conversation_threads and social_messages, which
 * predate this entity. It is never accepted from a client — the caller's organization comes
 * from their token.
 */
@Entity
@Table(name = "organizations")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Organization {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(unique = true, nullable = false)
    private String apiKey;

    @Column(nullable = false)
    private OffsetDateTime createdAt;

    /** Settings page: off hands every new customer message to staff instead of the AI. */
    @Builder.Default
    @Column(name = "ai_replies_enabled", nullable = false)
    private boolean aiRepliesEnabled = true;

    /** What the customer is told when a person takes over; null means the built-in default. */
    @Column(name = "handover_message", columnDefinition = "TEXT")
    private String handoverMessage;

    /** What the customer is told when an off-topic conversation is closed; null means the default. */
    @Column(name = "closing_message", columnDefinition = "TEXT")
    private String closingMessage;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }
}
