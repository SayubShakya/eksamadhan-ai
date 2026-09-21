-- How long an AI answer took, recorded on the reply itself.
--
-- Two numbers, because they fail for different reasons and the difference is the whole
-- diagnosis. generated_ms is the AI's own work: retrieval, the model, and sending. waited_ms
-- is how long the customer's message sat before that work started — zero-ish when the webhook
-- delivers, a minute or more when the message was only found by the catch-up sync.
--
-- Without the split, "the reply took four minutes" says nothing about whether the model is
-- slow or the message never arrived, which is exactly the question that came up in testing.
ALTER TABLE social_messages ADD COLUMN IF NOT EXISTS ai_generated_ms integer;
ALTER TABLE social_messages ADD COLUMN IF NOT EXISTS ai_waited_ms integer;
