-- A workspace's own logo (13 October 2026). People had a photo, a business only its name. Held
-- like a profile photo: a small data URL, or an https address. Null shows the name's initial.
ALTER TABLE organizations ADD COLUMN logo text;
