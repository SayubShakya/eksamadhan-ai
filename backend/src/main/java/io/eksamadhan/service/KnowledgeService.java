package io.eksamadhan.service;

import io.eksamadhan.model.*;
import io.eksamadhan.repository.KnowledgeChunkRepository;
import io.eksamadhan.repository.KnowledgeSourceRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * Ingesting the business knowledge the AI is allowed to answer from (PRD 4.3, FR-02).
 *
 * Indexing runs off the request thread: embedding a document means a network round trip per
 * batch of chunks, far too slow to hold an HTTP request open. The source is created
 * immediately as PENDING and the admin watches it reach READY.
 *
 * Note there is deliberately no transaction spanning the embedding call — a transaction
 * held open across the network would pin a database connection for the whole upload. Each
 * repository write is its own unit, so a crash mid-index leaves the source FAILED or
 * INDEXING with no chunks, which the admin can simply delete and re-add.
 */
@Service
@Slf4j
public class KnowledgeService {

    private final KnowledgeSourceRepository sourceRepository;
    private final KnowledgeChunkRepository chunkRepository;
    private final TextChunker chunker;
    private final EmbeddingClient embeddingClient;

    public KnowledgeService(KnowledgeSourceRepository sourceRepository,
                            KnowledgeChunkRepository chunkRepository,
                            TextChunker chunker,
                            EmbeddingClient embeddingClient) {
        this.sourceRepository = sourceRepository;
        this.chunkRepository = chunkRepository;
        this.chunker = chunker;
        this.embeddingClient = embeddingClient;
    }

    public List<KnowledgeSource> forOrganization(Organization organization) {
        return sourceRepository.findByOrganization(organization);
    }

    /** Creates the source as PENDING and returns at once. Call {@link #indexAsync} next. */
    @Transactional
    public KnowledgeSource create(Organization organization, String title,
                                  KnowledgeSourceType type, String originalFilename, String text) {
        return sourceRepository.save(KnowledgeSource.builder()
                .organization(organization)
                .title(title)
                .sourceType(type)
                .originalFilename(originalFilename)
                .status(KnowledgeSourceStatus.PENDING)
                .characterCount(text == null ? 0 : text.length())
                .build());
    }

    /**
     * Chunk, embed and store.
     *
     * Follows the codebase's async convention of taking an id and re-fetching inside, since
     * `open-in-view: false` means a detached entity's lazy associations are not readable on
     * another thread. The text comes along as a parameter because it is immutable and is not
     * worth a second trip to storage.
     */
    @Async("taskExecutor")
    public CompletableFuture<Void> indexAsync(UUID sourceId, String text) {
        try {
            index(sourceId, text);
        } catch (Exception e) {
            log.error("Indexing knowledge source {} failed", sourceId, e);
            markFailed(sourceId, e.getMessage());
        }
        return CompletableFuture.completedFuture(null);
    }

    private void index(UUID sourceId, String text) {
        KnowledgeSource source = sourceRepository.findWithOrganizationById(sourceId)
                .orElseThrow(() -> new IllegalStateException("Knowledge source " + sourceId + " is gone"));

        List<String> passages = chunker.chunk(text);
        if (passages.isEmpty()) {
            throw new IllegalStateException("There was no readable text in that source");
        }

        source.setStatus(KnowledgeSourceStatus.INDEXING);
        sourceRepository.save(source);

        List<float[]> vectors = embeddingClient.embedAll(passages);

        // Re-indexing replaces rather than appends, so ordinals stay contiguous.
        chunkRepository.deleteBySourceId(sourceId);

        List<KnowledgeChunk> chunks = new ArrayList<>(passages.size());
        for (int i = 0; i < passages.size(); i++) {
            String passage = passages.get(i);
            chunks.add(KnowledgeChunk.builder()
                    .source(source)
                    .organization(source.getOrganization())
                    .ordinal(i)
                    .content(passage)
                    .characterCount(passage.length())
                    .embedding(vectors.get(i))
                    .embeddingModel(embeddingClient.model())
                    .build());
        }
        chunkRepository.saveAll(chunks);

        source.setChunkCount(chunks.size());
        source.setCharacterCount(text.length());
        source.setStatus(KnowledgeSourceStatus.READY);
        source.setIndexedAt(OffsetDateTime.now());
        source.setError(null);
        sourceRepository.save(source);

        log.info("Indexed knowledge source {} into {} chunks", sourceId, chunks.size());
    }

    private void markFailed(UUID sourceId, String message) {
        sourceRepository.findById(sourceId).ifPresent(source -> {
            source.setStatus(KnowledgeSourceStatus.FAILED);
            source.setError(message == null ? "Indexing failed" : message);
            sourceRepository.save(source);
        });
    }

    /** Chunks go with it: the database cascades, so no vectors are left orphaned. */
    @Transactional
    public void delete(KnowledgeSource source) {
        sourceRepository.delete(source);
    }
}
