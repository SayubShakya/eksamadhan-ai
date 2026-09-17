-- Finish what V10 started.
--
-- V10 dropped the unique constraint by the name V1 gives it, but this database predates
-- Flyway: its constraint was created by ddl-auto and carries a generated name
-- (uklp7ybmcpg4eryuj43p7c0mkfd), so the DROP matched nothing and a customer writing after
-- resolution still collided. The same mistake as V2, and the same fix — drop it by what it
-- constrains rather than by what it is called.
DO $$
DECLARE existing text;
BEGIN
    FOR existing IN
        SELECT conname FROM pg_constraint
         WHERE conrelid = 'conversation_threads'::regclass
           AND contype = 'u'
           AND pg_get_constraintdef(oid) = 'UNIQUE (social_page_id, customer_id)'
    LOOP
        EXECUTE format('ALTER TABLE conversation_threads DROP CONSTRAINT %I', existing);
    END LOOP;
END $$;

-- Only one *live* conversation per customer; any number of resolved ones in the history.
CREATE UNIQUE INDEX IF NOT EXISTS uk_thread_active
    ON conversation_threads (social_page_id, customer_id)
 WHERE status <> 'RESOLVED';
