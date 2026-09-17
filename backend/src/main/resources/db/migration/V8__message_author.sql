-- Which team member sent an outbound message.
--
-- Until now "outbound" meant only "from our side", so the inbox could not tell an agent's own
-- words from the AI's or from a colleague's. That is the difference between a message
-- belonging to you and one merely sent on your behalf, and it decides which side of the
-- thread a bubble sits on.
--
-- Null means the AI sent it (ai_generated is true) or it predates this column.
ALTER TABLE social_messages ADD COLUMN IF NOT EXISTS sent_by_user_id uuid;

ALTER TABLE social_messages
    ADD CONSTRAINT fk_messages_sent_by FOREIGN KEY (sent_by_user_id)
    REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_sent_by ON social_messages (sent_by_user_id);
