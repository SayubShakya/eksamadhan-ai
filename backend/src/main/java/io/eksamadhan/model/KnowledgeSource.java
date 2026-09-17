package io.eksamadhan.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

/** A document the AI is allowed to answer from. Owned by one organization. */
@Entity
@Table(name = "knowledge_sources", indexes = {
        @Index(name = "idx_knowledge_sources_org", columnList = "organization_id")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KnowledgeSource {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Organization organization;

    @Column(nullable = false)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 20)
    private KnowledgeSourceType sourceType;

    @Column(name = "original_filename")
    private String originalFilename;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private KnowledgeSourceStatus status;

    /** Why indexing failed, shown to the admin. Null unless {@code status} is FAILED. */
    @Column(columnDefinition = "TEXT")
    private String error;

    @Column(name = "chunk_count", nullable = false)
    private int chunkCount;

    @Column(name = "character_count", nullable = false)
    private int characterCount;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "indexed_at")
    private OffsetDateTime indexedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
        if (status == null) status = KnowledgeSourceStatus.PENDING;
    }
}
