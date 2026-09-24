-- Two more of Jev's judgments per customer message: whether it is spam (and what kind), and
-- how urgently the customer needs the business to act. Null on rows judged before these
-- questions existed; those are re-judged once, by the sync's backfill.
ALTER TABLE message_triage
    ADD COLUMN spam double precision,
    ADD COLUMN spam_kind varchar(16),
    ADD COLUMN urgency smallint,
    ADD COLUMN urgency_confidence double precision;

-- What those judgments mean for the conversation.
--
-- priority      1 urgent, 2 normal, 3 low: the most urgent message in the conversation, so a
--               "thanks" after "my order never came" does not hide it. Null until judged.
-- spam          the conversation is kept out of the Active tab and the AI does not answer it.
-- spam_*        why: the kind Jev chose, how sure it was, and the message that decided it.
--               Kept after a person clears the flag, so the record shows what was overruled.
-- spam_cleared  a person said it is not spam; it is never flagged automatically again.
ALTER TABLE conversation_threads
    ADD COLUMN priority smallint,
    ADD COLUMN spam boolean NOT NULL DEFAULT false,
    ADD COLUMN spam_kind varchar(16),
    ADD COLUMN spam_score double precision,
    ADD COLUMN spam_message_id uuid REFERENCES social_messages (id) ON DELETE SET NULL,
    ADD COLUMN spam_at timestamp(6) with time zone,
    ADD COLUMN spam_cleared boolean NOT NULL DEFAULT false,
    ADD CONSTRAINT conversation_threads_priority_check CHECK (priority BETWEEN 1 AND 3);
