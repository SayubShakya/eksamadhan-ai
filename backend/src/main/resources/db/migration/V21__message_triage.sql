-- What the Jev firewall judged about each inbound message, and what it did — or, in shadow
-- mode, what it would have done. Kept as its own table rather than columns on
-- social_messages so the firewall can be evaluated and switched off without touching the
-- message model, and so shadow-mode results can be compared against what actually happened.
CREATE TABLE message_triage (
    id                   uuid PRIMARY KEY,
    social_message_id    uuid NOT NULL UNIQUE REFERENCES social_messages (id) ON DELETE CASCADE,
    mode                 varchar(10)      NOT NULL,   -- shadow | on
    intent               varchar(32)      NOT NULL,
    intent_confidence    double precision NOT NULL,
    wants_human          double precision NOT NULL,   -- probability, 0..1
    injection            double precision NOT NULL,   -- probability, 0..1
    sentiment            varchar(16)      NOT NULL,
    sentiment_confidence double precision NOT NULL,
    action               varchar(32)      NOT NULL,   -- what the firewall decided
    latency_ms           integer          NOT NULL,
    input_tokens         integer,
    created_at           timestamptz      NOT NULL
);

CREATE INDEX idx_message_triage_created ON message_triage (created_at);
