-- What a voice note actually said.
--
-- The AI transcribes one to answer it, then had nothing to do with the transcript — so an
-- agent taking over a conversation saw an audio player and no idea what was asked. Kept
-- separate from `text`, which holds what the customer literally sent: a transcript is our
-- reading of the message, not the message.
ALTER TABLE social_messages ADD COLUMN IF NOT EXISTS transcript text;
