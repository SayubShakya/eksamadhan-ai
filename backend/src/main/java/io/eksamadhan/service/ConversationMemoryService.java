package io.eksamadhan.service;

import io.eksamadhan.model.MessageEmbedding;
import io.eksamadhan.model.SocialMessage;
import io.eksamadhan.repository.MessageEmbeddingRepository;
import io.eksamadhan.repository.SocialMessageRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * Gives a conversation a semantic memory by embedding every message.
 *
 * The purpose is recall, not search: when a customer asks something after fifty messages,
 * the few earlier messages that actually bear on it can be retrieved instead of sending the
 * whole thread to the model. The contextual report identifies exactly this as the token-cost
 * problem to solve.
 *
 * Nothing here may break message ingestion. An embedding that fails is a degraded feature;
 * a customer message that fails to save is a lost customer.
 */
@Service
@Slf4j
public class ConversationMemoryService {

    private final MessageEmbeddingRepository embeddingRepository;
    private final SocialMessageRepository messageRepository;
    private final EmbeddingClient embeddingClient;

    public ConversationMemoryService(MessageEmbeddingRepository embeddingRepository,
                                     SocialMessageRepository messageRepository,
                                     EmbeddingClient embeddingClient) {
        this.embeddingRepository = embeddingRepository;
        this.messageRepository = messageRepository;
        this.embeddingClient = embeddingClient;
    }

    /**
     * Embed one message. Called by {@link MessageIngestedListener} after commit, since the
     * row must be visible to the thread doing the work.
     */
    public void remember(UUID messageId) {
        if (!embeddingClient.isConfigured()) return;
        // Meta redelivers webhooks, so check before spending an API call. The unique
        // constraint is the real guarantee; this just avoids the cost.
        if (embeddingRepository.existsBySocialMessageId(messageId)) return;

        SocialMessage message = messageRepository.findById(messageId).orElse(null);
        if (message == null || message.getThread() == null) return;

        String content = message.getText();
        if (content == null || content.isBlank()) return;   // an image or voice note

        embeddingRepository.save(MessageEmbedding.builder()
                .socialMessageId(messageId)
                .threadId(message.getThread().getId())
                .tenantId(message.getTenantId())
                .content(content)
                .embedding(embeddingClient.embed(content))
                .embeddingModel(embeddingClient.model())
                .createdAt(OffsetDateTime.now())
                .build());
    }

    /** A remembered message and how closely it bears on the query. */
    public record Recalled(String id, String content, OffsetDateTime at, double similarity) {}

    /** The earlier messages in this conversation closest in meaning to {@code query}. */
    public List<Recalled> recallForThread(UUID threadId, String query, int limit) {
        if (query == null || query.isBlank() || !embeddingClient.isConfigured()) return List.of();

        float[] queryVector = embeddingClient.embed(query);
        return embeddingRepository
                .recallForThread(threadId, VectorFormat.toLiteral(queryVector), Math.max(1, limit))
                .stream()
                .map(row -> new Recalled(
                        String.valueOf(row[0]),
                        (String) row[1],
                        toOffsetDateTime(row[2]),
                        ((Number) row[3]).doubleValue()))
                .toList();
    }

    /**
     * A native query's timestamp comes back as whatever the driver chooses — the PostgreSQL
     * driver gives an Instant for timestamptz, not the java.sql.Timestamp one might expect —
     * so accept any of them rather than casting and hoping.
     */
    private static OffsetDateTime toOffsetDateTime(Object value) {
        return switch (value) {
            case null -> null;
            case OffsetDateTime odt -> odt;
            case java.time.Instant instant -> instant.atOffset(java.time.ZoneOffset.UTC);
            case java.sql.Timestamp ts -> ts.toInstant().atOffset(java.time.ZoneOffset.UTC);
            default -> null;
        };
    }

    /**
     * Embeds messages that arrived before this feature existed, so the memory is usable
     * immediately rather than only for conversations that happen from now on.
     */
    @Async("taskExecutor")
    public CompletableFuture<Void> backfillAsync(String tenantId) {
        if (!embeddingClient.isConfigured()) return CompletableFuture.completedFuture(null);

        // Only what is actually missing. This runs on every sync — every thirty seconds while a
        // dashboard is open — and used to read every message in the workspace and check each one
        // in Java, which is why it reported "touched 135 messages" over and over on a workspace
        // where nothing had changed. Asked properly, a settled workspace costs one indexed query
        // that returns no rows.
        List<SocialMessage> pending = messageRepository.findWithoutEmbedding(tenantId);
        if (pending.isEmpty()) return CompletableFuture.completedFuture(null);

        int embedded = 0;
        for (SocialMessage message : pending) {
            try {
                remember(message.getId());
                embedded++;
            } catch (Exception e) {
                log.debug("Backfill skipped message {}: {}", message.getId(), e.getMessage());
            }
        }
        log.info("Conversation memory backfill for {} embedded {} messages", tenantId, embedded);
        return CompletableFuture.completedFuture(null);
    }
}
