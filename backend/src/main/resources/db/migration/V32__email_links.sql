-- Email verification and password reset.
--
-- Everyone who already has an account is treated as verified: they were created by invitation
-- (the link proves the address), by Google (Google proves it) or before this check existed.
-- Only new password sign-ups start unverified.
ALTER TABLE users ADD COLUMN email_verified boolean NOT NULL DEFAULT true;

-- One-time links sent by email. Only a SHA-256 hash of the token is stored, so someone reading
-- the database cannot use a link that is still waiting in an inbox.
CREATE TABLE email_links (
    id          uuid PRIMARY KEY,
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose     varchar(20) NOT NULL,
    token_hash  varchar(64) NOT NULL UNIQUE,
    expires_at  timestamptz NOT NULL,
    used_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_email_links_purpose CHECK (purpose IN ('VERIFY_EMAIL', 'RESET_PASSWORD'))
);
CREATE INDEX ix_email_links_user ON email_links (user_id, purpose);
