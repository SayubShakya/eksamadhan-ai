-- Sign-ins older than this are refused. Set when a password is changed or reset, or when a
-- Google sign-in removes a password nobody confirmed, so a session opened with the old
-- password (someone who knew it, a forgotten laptop) ends on its next request instead of
-- running out its 24 hours. Null: every unexpired sign-in is valid.
ALTER TABLE users ADD COLUMN sessions_valid_from timestamptz;
