-- A platform operator above the workspaces. Deliberately a flag and not a fourth role: team
-- invitations take their role straight from the request, so a role value would let any
-- workspace owner invite someone who could then read every workspace's conversations. This
-- flag is set only from configuration at startup — no invite, signup or profile edit reaches it.
ALTER TABLE users ADD COLUMN system_admin boolean NOT NULL DEFAULT false;

-- Every step the AI took on a customer message, with what went in and what came out: the
-- Jev triage, the knowledge search, the model's exact prompt and raw reply, each gate, the
-- escalation, the assignment, the alerts. It is what the conversation visualizer draws.
--
-- Input and output are JSON held as text: they are written once, read whole, and never
-- queried inside, so a jsonb column would buy nothing but a mapping to maintain.
CREATE TABLE ai_trace_steps (
    id                uuid PRIMARY KEY,
    social_message_id uuid        NOT NULL REFERENCES social_messages (id) ON DELETE CASCADE,
    seq               bigint      NOT NULL,   -- order within the message
    kind              varchar(20) NOT NULL,   -- TRIGGER DECISION JEV RETRIEVAL MODEL ACTION HANDOVER NOTIFY END ERROR
    title             text        NOT NULL,
    outcome           text,                   -- the branch taken, or the step's result in a few words
    input             text,
    output            text,
    duration_ms       integer,
    created_at        timestamptz NOT NULL
);

CREATE INDEX idx_ai_trace_steps_message ON ai_trace_steps (social_message_id, seq);
