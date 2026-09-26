-- Account deletion and deactivation (Settings, Data & privacy).
--   DEACTIVATED: signed out everywhere and off every rota; signing in again turns it back on.
--   DELETED: personal data overwritten, the row kept so conversations and replies it handled
--   keep their history without a name attached.
ALTER TABLE users DROP CONSTRAINT ck_users_status;
ALTER TABLE users ADD CONSTRAINT ck_users_status
    CHECK (status IN ('ACTIVE', 'INVITED', 'DISABLED', 'DEACTIVATED', 'DELETED'));
ALTER TABLE users ADD COLUMN deactivated_at timestamptz;
ALTER TABLE users ADD COLUMN deleted_at timestamptz;

-- The deletion flow's progress lives here, not in the browser: the final delete is refused
-- unless this record reached the last stage. Short-lived, one per person, removed on completion.
CREATE TABLE account_deletion_challenges (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    stage        smallint NOT NULL DEFAULT 0 CHECK (stage BETWEEN 0 AND 4),
    code_hash    varchar(64),
    code_sent_at timestamptz,
    code_sends   integer NOT NULL DEFAULT 0,
    code_attempts integer NOT NULL DEFAULT 0,
    created_at   timestamptz NOT NULL DEFAULT now(),
    expires_at   timestamptz NOT NULL
);
