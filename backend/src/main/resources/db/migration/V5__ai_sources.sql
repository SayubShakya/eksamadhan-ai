-- Which knowledge passages an AI reply was drawn from.
--
-- Recorded at reply time rather than recomputed on demand: re-running retrieval to show this
-- would cost an embedding call every time someone opened a conversation, and would answer a
-- slightly different question anyway — what the knowledge base says *now*, rather than what
-- the AI actually used. This is the audit trail behind an answer.
ALTER TABLE social_messages ADD COLUMN IF NOT EXISTS ai_sources text;
