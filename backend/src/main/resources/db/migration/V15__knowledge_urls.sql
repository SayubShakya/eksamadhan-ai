-- Pages crawled from a website.
--
-- One source per page rather than one per site: a page is what a customer's question is
-- really about, it gives the source a meaningful title, and an admin can delete a single
-- page that has gone stale without re-crawling everything.
ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS source_url text;

ALTER TABLE knowledge_sources DROP CONSTRAINT IF EXISTS ck_knowledge_sources_type;
ALTER TABLE knowledge_sources
    ADD CONSTRAINT ck_knowledge_sources_type
    CHECK (source_type IN ('TEXT', 'PDF', 'IMAGE', 'URL'));

-- Re-crawling should update a page, not add a second copy of it.
CREATE UNIQUE INDEX IF NOT EXISTS uk_knowledge_source_url
    ON knowledge_sources (organization_id, source_url)
 WHERE source_url IS NOT NULL;
