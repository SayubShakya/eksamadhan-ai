package io.eksamadhan.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Array;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One embedded passage of a knowledge source — the unit that semantic search returns.
 *
 * The vector lives here in PostgreSQL (pgvector) rather than in a separate vector service,
 * so deleting a source deletes its vectors in the same transaction.
 */
@Entity
@Table(name = "knowledge_chunks", indexes = {
        @Index(name = "idx_knowledge_chunks_org", columnList = "organization_id")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KnowledgeChunk {

    /** Dimensions of openai/text-embedding-3-small. Changing this means re-indexing. */
    public static final int DIMENSIONS = 1536;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "knowledge_source_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private KnowledgeSource source;

    /**
     * Denormalised from the source so a similarity search filters by workspace without a
     * join. Retrieval must never cross an organization boundary.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Organization organization;

    /** Position within the source, so retrieved passages can be shown in reading order. */
    @Column(nullable = false)
    private int ordinal;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "character_count", nullable = false)
    private int characterCount;

    @JdbcTypeCode(SqlTypes.VECTOR)
    @Array(length = DIMENSIONS)
    @Column(columnDefinition = "vector(1536)")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private float[] embedding;

    /**
     * Similarity scores from two different models are not comparable, so a model change
     * means re-indexing. Recording it per row is what makes that detectable.
     */
    @Column(name = "embedding_model", nullable = false, length = 100)
    private String embeddingModel;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }
}
