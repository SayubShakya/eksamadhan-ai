-- Survey follow-up (7 October 2026): owners scored "I would let the AI answer without checking
-- every reply" 2.8 of 5, and adding knowledge 3.4.
--
--   review_ai_replies: on, the AI's answer to a question is kept as a draft for a person to
--     check and send, instead of going straight to the customer. Off by default, so nothing
--     changes for a workspace that does not ask for it.
--   ai_draft: that draft, on the conversation, until someone replies or the AI answers again.
--   knowledge_gap_dismissals: questions the AI could not answer that the owner has dealt with
--     (answered on the Knowledge page, or dismissed), so the list only shows what is left.
ALTER TABLE organizations ADD COLUMN review_ai_replies boolean NOT NULL DEFAULT false;

ALTER TABLE conversation_threads ADD COLUMN ai_draft text;
ALTER TABLE conversation_threads ADD COLUMN ai_draft_at timestamptz;

CREATE TABLE knowledge_gap_dismissals (
    organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    question        text        NOT NULL,
    dismissed_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, question)
);
