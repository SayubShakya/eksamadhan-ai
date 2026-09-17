package io.eksamadhan.repository;

import io.eksamadhan.model.KnowledgeChunk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

public interface KnowledgeChunkRepository extends JpaRepository<KnowledgeChunk, UUID> {

    /** Transactional here because the caller runs outside one, on the async indexer. */
    @Transactional
    @org.springframework.data.jpa.repository.Modifying
    void deleteBySourceId(UUID sourceId);

    long countBySourceId(UUID sourceId);

    /**
     * Top-k nearest passages by cosine distance.
     *
     * `&lt;=&gt;` is pgvector's cosine distance: 0 means identical, so the order is ascending and
     * similarity is 1 - distance. The organization filter is not optional — it is what stops
     * one workspace retrieving another's knowledge.
     *
     * Native because `&lt;=&gt;` has no JPQL equivalent; the vector is passed as pgvector's text
     * form (`[1.0, 2.0, …]`) and cast, which avoids a JDBC type registration.
     */
    @Query(value = """
            SELECT c.id,
                   c.content,
                   c.ordinal,
                   s.title AS source_title,
                   s.id    AS source_id,
                   s.image_path AS image_path,
                   1 - (c.embedding <=> CAST(:vector AS vector)) AS similarity
              FROM knowledge_chunks c
              JOIN knowledge_sources s ON s.id = c.knowledge_source_id
             WHERE c.organization_id = :organizationId
               AND c.embedding IS NOT NULL
             ORDER BY c.embedding <=> CAST(:vector AS vector)
             LIMIT :limit
            """, nativeQuery = true)
    List<Object[]> searchNearest(@Param("organizationId") UUID organizationId,
                                 @Param("vector") String vector,
                                 @Param("limit") int limit);
}
