-- Settings a workspace controls itself (the Settings page, 2026-09-26).
--   ai_replies_enabled: off hands every new customer message to staff; nobody is left unanswered.
--   handover_message / closing_message: what the customer is told when a person takes over, and
--   when an off-topic conversation is closed. NULL means the built-in default (app.ai.*).
ALTER TABLE organizations ADD COLUMN ai_replies_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE organizations ADD COLUMN handover_message text;
ALTER TABLE organizations ADD COLUMN closing_message text;

-- Per person: whether a handover is also sent by email (push and the bell are unaffected).
ALTER TABLE users ADD COLUMN email_alerts boolean NOT NULL DEFAULT true;
