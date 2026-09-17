-- Remove the fabricated "[Media or No Text]" text from media messages.
--
-- The history sync used to substitute that literal string when a message had no words, so an
-- agent saw it as though the customer had typed it, and the AI treated it as the question to
-- answer. Nulling it lets the attachment speak for itself. The attachment URL itself cannot
-- be recovered for these rows — the sync never asked Meta for it — but new ones now carry it.
UPDATE social_messages
   SET text = NULL, content = NULL
 WHERE text = '[Media or No Text]';
