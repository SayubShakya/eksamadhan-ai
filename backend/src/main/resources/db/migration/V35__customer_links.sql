-- One person, several channels (12 October 2026): the same customer writes on Messenger and on
-- Instagram, and each platform gives them a different id, so the inbox showed two strangers.
--
-- A person in the inbox stays tied to the platform they wrote on (a reply must go back the same
-- way), so conversations are linked, not merged: every identity (a page and the customer's id
-- on it) linked as the same person shares one contact_id. Linking two identities that already
-- belong to different contacts joins the contacts.
CREATE TABLE customer_links (
    social_page_id  uuid         NOT NULL REFERENCES social_pages(id) ON DELETE CASCADE,
    customer_id     varchar(255) NOT NULL,
    organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id      uuid         NOT NULL,
    linked_by       uuid         REFERENCES users(id) ON DELETE SET NULL,
    linked_at       timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (social_page_id, customer_id)
);

CREATE INDEX idx_customer_links_contact ON customer_links (organization_id, contact_id);
