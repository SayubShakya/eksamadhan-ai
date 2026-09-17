-- Sentiment per inbound message, and the conversation's current mood.
--
-- Per message as well as per thread because "the customer is angry" is only actionable if an
-- agent can see which message turned, and because the deflection and satisfaction figures the
-- report is graded on are counted over messages.
ALTER TABLE social_messages ADD COLUMN IF NOT EXISTS sentiment varchar(20);

ALTER TABLE conversation_threads ADD COLUMN IF NOT EXISTS sentiment_at timestamptz(6);

ALTER TABLE social_messages
    ADD CONSTRAINT ck_messages_sentiment
    CHECK (sentiment IS NULL OR sentiment IN ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'ANGRY'));

CREATE INDEX IF NOT EXISTS idx_messages_sentiment ON social_messages (sentiment);
