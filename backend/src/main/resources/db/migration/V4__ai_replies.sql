-- Marks which outbound messages the AI wrote, and how sure it was.
--
-- The inbox has to show an AI answer differently from an agent's own words (design.md), and
-- the deflection rate the report is graded on (60-65%) is measured from exactly this flag.
-- Confidence is kept per message so a threshold can be tuned against real traffic rather
-- than guessed.

ALTER TABLE social_messages ADD COLUMN IF NOT EXISTS ai_generated  boolean NOT NULL DEFAULT false;
ALTER TABLE social_messages ADD COLUMN IF NOT EXISTS ai_confidence double precision;

-- Why a conversation was handed to a human. Null while the AI is still handling it.
ALTER TABLE conversation_threads ADD COLUMN IF NOT EXISTS escalation_reason varchar(255);

CREATE INDEX IF NOT EXISTS idx_messages_ai_generated ON social_messages (ai_generated);
