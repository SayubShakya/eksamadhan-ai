package io.eksamadhan.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * The Jev firewall's judgment of one inbound message, and the action it took — or, in shadow
 * mode, the action it would have taken while the existing pipeline answered as usual.
 *
 * The message is referenced by id rather than as an association, the same as
 * {@link MessageEmbedding}: nothing here is ever loaded from the message side.
 */
@Entity
@Table(name = "message_triage")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageTriage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "social_message_id", nullable = false, unique = true)
    private UUID socialMessageId;

    @Column(nullable = false, length = 10)
    private String mode;

    @Column(nullable = false, length = 32)
    private String intent;

    @Column(name = "intent_confidence", nullable = false)
    private Double intentConfidence;

    @Column(name = "wants_human", nullable = false)
    private Double wantsHuman;

    @Column(nullable = false)
    private Double injection;

    @Column(nullable = false, length = 16)
    private String sentiment;

    @Column(name = "sentiment_confidence", nullable = false)
    private Double sentimentConfidence;

    @Column(nullable = false, length = 32)
    private String action;

    @Column(name = "latency_ms", nullable = false)
    private Integer latencyMs;

    @Column(name = "input_tokens")
    private Integer inputTokens;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;
}
