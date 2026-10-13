-- "Not the same person" (13 October 2026). A same-name suggestion kept asking until someone linked
-- the two, so two different people called Sayub Shakya could never be told apart. One row per pair
-- of identities (page + customer id), stored in a fixed order so either side finds it.
CREATE TABLE customer_link_dismissals (
    organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    a_page_id       uuid        NOT NULL REFERENCES social_pages(id) ON DELETE CASCADE,
    a_customer_id   varchar(255) NOT NULL,
    b_page_id       uuid        NOT NULL REFERENCES social_pages(id) ON DELETE CASCADE,
    b_customer_id   varchar(255) NOT NULL,
    dismissed_by    uuid        REFERENCES users(id) ON DELETE SET NULL,
    dismissed_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (a_page_id, a_customer_id, b_page_id, b_customer_id)
);
