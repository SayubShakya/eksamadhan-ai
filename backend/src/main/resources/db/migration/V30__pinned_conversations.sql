-- Pinned conversations: personal, one row per person per conversation. A pin keeps a
-- conversation at the top of that person's list only; colleagues' lists are unaffected.
CREATE TABLE pinned_conversations (
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    thread_id  uuid        NOT NULL REFERENCES conversation_threads (id) ON DELETE CASCADE,
    pinned_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, thread_id)
);
CREATE INDEX idx_pinned_conversations_thread ON pinned_conversations (thread_id);
