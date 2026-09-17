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

    /** For an IMAGE source: the stored file, served at /api/media/{imagePath}. */
    @Column(name = "image_path")
    private String imagePath;

    /** For a URL source: the page it was crawled from. */
    @Column(name = "source_url", columnDefinition = "TEXT")
    private String sourceUrl;

    /** What the admin said the image shows. Embedded alongside the title. */
    @Column(columnDefinition = "TEXT")
    private String caption;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private KnowledgeSourceStatus status;

    /**
     * The text this source was read as, before chunking — a crawled page's readable content,
     * a PDF's extracted text, the pasted text itself. Kept so the reading can be inspected
     * and so re-indexing does not mean fetching everything again.
     */
    @Column(columnDefinition = "TEXT")
    private String content;

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
