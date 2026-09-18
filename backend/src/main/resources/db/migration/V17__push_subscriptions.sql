-- Browser push subscriptions, one per device an agent signs in on (FR-06).
--
-- A subscription belongs to a person, not a workspace: an agent with a laptop and a phone has
-- two, and both should buzz. The endpoint is the address the push service gave that browser,
-- and it is unique — re-subscribing the same browser must update the keys rather than leave a
-- stale row that is pushed to forever.
--
-- p256dh and auth are the browser's own keys. The server encrypts every payload against them
-- (RFC 8291), so the push service in the middle carries a customer's message without being
-- able to read it.
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id           uuid PRIMARY KEY,
    user_id      uuid NOT NULL,
    endpoint     text NOT NULL,
    p256dh       text NOT NULL,
    auth         text NOT NULL,
    user_agent   text,
    created_at   timestamptz(6) NOT NULL,
    last_used_at timestamptz(6),
    CONSTRAINT fk_push_subscriptions_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uk_push_subscriptions_endpoint UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);
