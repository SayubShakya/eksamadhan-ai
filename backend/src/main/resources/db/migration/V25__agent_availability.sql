-- FR-05: agent availability. Each person chooses whether they take new conversations
-- (AVAILABLE) or not (BUSY); whether they are online at all is worked out from last_seen_at,
-- which the open dashboard refreshes every minute. Routing only assigns to people who are
-- AVAILABLE and were seen in the last few minutes.
ALTER TABLE users ADD COLUMN availability varchar(20) NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE users ADD CONSTRAINT users_availability_check CHECK (availability IN ('AVAILABLE', 'BUSY'));
ALTER TABLE users ADD COLUMN last_seen_at timestamptz;
