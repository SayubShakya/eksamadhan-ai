-- Let a customer have more than one conversation over time.
--
-- Until now there was exactly one thread per customer per page, so a customer writing again
-- after their issue was closed reopened the old one: its resolution time was cleared and its
-- closing record was overwritten by the new exchange. A resolved conversation should stay
-- resolved, and the next question should start its own lifecycle.
--
-- The uniqueness that still matters is that a customer has only one *live* conversation at a
-- time — otherwise two agents could be answering the same person in parallel. A partial index
-- says exactly that, while leaving any number of resolved ones in the history.
ALTER TABLE conversation_threads DROP CONSTRAINT IF EXISTS uk_thread_page_customer;

CREATE UNIQUE INDEX IF NOT EXISTS uk_thread_active
    ON conversation_threads (social_page_id, customer_id)
 WHERE status <> 'RESOLVED';
