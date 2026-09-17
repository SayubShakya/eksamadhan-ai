-- Conversations that are not about the business at all.
--
-- The AI escalates what it cannot answer, which is right for a real customer and wrong for
-- someone using the page as a free chatbot: every off-topic message then costs a model call
-- and puts a conversation in front of an agent. Counting consecutive unrelated messages lets
-- the AI stop answering and close the conversation itself, rather than handing the cost to a
-- person.
ALTER TABLE conversation_threads
    ADD COLUMN IF NOT EXISTS off_topic_streak integer NOT NULL DEFAULT 0;

-- Closed by the AI as unrelated, rather than resolved by anyone. Kept separate from status so
-- the deflection figure can exclude it: a conversation nobody wanted is neither a success for
-- the AI nor work avoided.
ALTER TABLE conversation_threads
    ADD COLUMN IF NOT EXISTS unrelated boolean NOT NULL DEFAULT false;

-- Analytics reads these constantly; the tenant index alone leaves it scanning every thread.
CREATE INDEX IF NOT EXISTS idx_thread_escalated ON conversation_threads (tenant_id, escalated_at);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_time ON social_messages (tenant_id, "timestamp");
