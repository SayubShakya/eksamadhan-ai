-- A short brief on the conversation, written for whoever picks it up.
--
-- Stored rather than generated on view: an agent opening a handed-over conversation should
-- not wait on a model call, and the summary should describe the conversation at the moment
-- it was handed over. summary_message_count is what makes staleness visible — if more
-- messages have arrived since, the brief is out of date and the UI offers to refresh it.
ALTER TABLE conversation_threads ADD COLUMN IF NOT EXISTS summary               text;
ALTER TABLE conversation_threads ADD COLUMN IF NOT EXISTS summary_at            timestamptz(6);
ALTER TABLE conversation_threads ADD COLUMN IF NOT EXISTS summary_message_count integer;
