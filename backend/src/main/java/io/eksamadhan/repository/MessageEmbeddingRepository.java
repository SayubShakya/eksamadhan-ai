package io.eksamadhan.repository;

import io.eksamadhan.model.MessageEmbedding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface MessageEmbeddingRepository extends JpaRepository<MessageEmbedding, UUID> {

    boolean existsBySocialMessageId(UUID socialMessageId);

    void deleteByTenantId(String tenantId);

    long countByTenantId(String tenantId);

    /**
     * The earlier messages in one conversation that are semantically closest to a query —
     * the thread's memory, so a long history need not be sent to the model wholesale.
     */
    @Query(value = """
            SELECT m.id,
                   m.content,
                   m.created_at,
                   1 - (m.embedding <=> CAST(:vector AS vector)) AS similarity
              FROM message_embeddings m
             WHERE m.thread_id = :threadId
               AND m.embedding IS NOT NULL
             ORDER BY m.embedding <=> CAST(:vector AS vector)
             LIMIT :limit
            """, nativeQuery = true)
    List<Object[]> recallForThread(@Param("threadId") UUID threadId,
                                   @Param("vector") String vector,
                                   @Param("limit") int limit);
}
