-- What an agent was told, kept so it can be read in the dashboard as well as pushed.
--
-- A browser notification is gone the moment it is dismissed, and it never arrives at all on a
-- device where permission was declined. The same alerts are therefore recorded here, so the
-- bell in the header shows the full history regardless of what any one device did with it.
CREATE TABLE IF NOT EXISTS notifications (
    id         uuid PRIMARY KEY,
    user_id    uuid NOT NULL,
    title      text NOT NULL,
    body       text,
    url        text,
    thread_id  uuid,
    kind       varchar(20) NOT NULL,
    created_at timestamptz(6) NOT NULL,
    read_at    timestamptz(6),
    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_thread
        FOREIGN KEY (thread_id) REFERENCES conversation_threads (id) ON DELETE CASCADE
);

-- The bell asks one question — "my newest, unread first" — so index exactly that.
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications (user_id, created_at DESC);
