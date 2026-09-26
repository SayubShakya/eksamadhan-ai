package io.eksamadhan.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * A person's pinned conversations. Two columns and a key, so plain SQL rather than an entity:
 * nothing reads a pin except as "is this one pinned for me".
 */
@Repository
public class PinnedConversationRepository {

    private final JdbcTemplate jdbc;

    public PinnedConversationRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Set<UUID> threadIdsFor(UUID userId) {
        return new HashSet<>(jdbc.queryForList(
                "SELECT thread_id FROM pinned_conversations WHERE user_id = ?", UUID.class, userId));
    }

    /** Pinning twice is not an error: the second one changes nothing. */
    public void pin(UUID userId, UUID threadId) {
        jdbc.update("INSERT INTO pinned_conversations (user_id, thread_id) VALUES (?, ?) "
                + "ON CONFLICT (user_id, thread_id) DO NOTHING", userId, threadId);
    }

    public void unpin(UUID userId, UUID threadId) {
        jdbc.update("DELETE FROM pinned_conversations WHERE user_id = ? AND thread_id = ?", userId, threadId);
    }

    public int deleteAllFor(UUID userId) {
        return jdbc.update("DELETE FROM pinned_conversations WHERE user_id = ?", userId);
    }
}
