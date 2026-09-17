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

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }
}
