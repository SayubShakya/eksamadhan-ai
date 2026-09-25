-- Alerts written before the no-emoji rule (2026-09-25) began with a siren emoji. The code no
-- longer writes it; this cleans the rows already stored so the bell and the notifications page
-- read the same for old and new alerts.
UPDATE notifications
SET title = regexp_replace(title, '^\s*🚨\s*', '')
WHERE title ~ '^\s*🚨';
