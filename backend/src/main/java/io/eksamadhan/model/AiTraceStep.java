package io.eksamadhan.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One step the AI took on a customer message, with what went into it and what came out.
 * Written once and never updated, so no two paths can ever overwrite each other's steps.
 */
@Entity
@Table(name = "ai_trace_steps")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiTraceStep {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "social_message_id", nullable = false)
    private UUID socialMessageId;

    @Column(nullable = false)
    private Long seq;

    @Column(nullable = false, length = 20)
    private String kind;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String title;

    @Column(columnDefinition = "TEXT")
    private String outcome;

    @Column(columnDefinition = "TEXT")
    private String input;

    @Column(columnDefinition = "TEXT")
    private String output;

    @Column(name = "duration_ms")
    private Integer durationMs;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;
}
