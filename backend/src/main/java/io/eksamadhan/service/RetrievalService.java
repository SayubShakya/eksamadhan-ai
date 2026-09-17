package io.eksamadhan.service;

import io.eksamadhan.model.Organization;
import io.eksamadhan.repository.KnowledgeChunkRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Semantic search over one organization's knowledge base.
 *
 * This is the retrieval half of RAG, kept separate and independently callable on purpose:
 * retrieval quality has to be provable on its own, before an LLM is put in front of it.
 * Otherwise a bad answer is impossible to attribute to the right half.
 */
@Service
@Slf4j
public class RetrievalService {

    private final KnowledgeChunkRepository chunkRepository;
    private final EmbeddingClient embeddingClient;
    private final int defaultTopK;

    public RetrievalService(KnowledgeChunkRepository chunkRepository,
                            EmbeddingClient embeddingClient,
                            @Value("${app.ai.top-k:5}") int defaultTopK) {
        this.chunkRepository = chunkRepository;
        this.embeddingClient = embeddingClient;
        this.defaultTopK = defaultTopK;
    }

    /**
     * One retrieved passage and how close it was, 1.0 being identical.
     *
     * {@code imagePath} is set when the passage stands for a picture rather than text, which
     * is what lets an answer attach the picture instead of only describing it.
     */
    public record Passage(String id, String sourceId, String sourceTitle,
                          int ordinal, String content, double similarity, String imagePath) {

        public boolean isImage() {
            return imagePath != null && !imagePath.isBlank();
        }
    }

    /** Whether an API key is present; without one nothing can be embedded or searched. */
    public boolean isConfigured() {
        return embeddingClient.isConfigured();
    }

    public List<Passage> search(Organization organization, String query, Integer topK) {
        if (query == null || query.isBlank()) return List.of();

        int limit = topK == null || topK < 1 ? defaultTopK : Math.min(topK, 50);
        float[] queryVector = embeddingClient.embed(query);

        List<Object[]> rows = chunkRepository.searchNearest(
                organization.getId(), VectorFormat.toLiteral(queryVector), limit);

        return rows.stream().map(row -> new Passage(
                String.valueOf(row[0]),
                String.valueOf(row[4]),
                (String) row[3],
                ((Number) row[2]).intValue(),
                (String) row[1],
                ((Number) row[6]).doubleValue(),
                (String) row[5]
        )).toList();
    }
}
