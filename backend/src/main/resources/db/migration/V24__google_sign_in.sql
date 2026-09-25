-- Sign in with Google (Firebase Authentication). A member who joins with Google has no
-- password here at all — that is the point — so the hash becomes optional; the password
-- login refuses an account without one.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- The Firebase uid of the Google account first used to sign in. Pinned after that first
-- sign-in: a different Google account presenting the same address (a deleted and recreated
-- Workspace account, say) is refused rather than silently let into this one.
ALTER TABLE users ADD COLUMN firebase_uid varchar(128) UNIQUE;
