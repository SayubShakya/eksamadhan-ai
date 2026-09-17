package io.eksamadhan.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Array;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * The embedding of a single message, giving a long conversation a semantic memory.
 *
 * The point is to recall the few earlier messages that actually relate to what the customer
 * just asked, instead of sending a whole thread to the model — which the contextual report
 * identifies as the token-cost problem to solve.
 */
@Entity
@Table(name = "message_embeddings", indexes = {
        @Index(name = "idx_message_embeddings_thread", columnList = "thread_id"),
        @Index(name = "idx_message_embeddings_tenant", columnList = "tenant_id")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageEmbedding {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Unique: Meta redelivers webhooks, so this keeps re-ingestion idempotent. */
    @Column(name = "social_message_id", nullable = false, unique = true)
    private UUID socialMessageId;

    @Column(name = "thread_id", nullable = false)
    private UUID threadId;

    /** The organization api-key, matching social_messages and conversation_threads. */
    @Column(name = "tenant_id", nullable = false)
    private String tenantId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @JdbcTypeCode(SqlTypes.VECTOR)
    @Array(length = KnowledgeChunk.DIMENSIONS)
    @Column(columnDefinition = "vector(1536)")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private float[] embedding;

    @Column(name = "embedding_model", nullable = false, length = 100)
    private String embeddingModel;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }
}
