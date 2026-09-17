-- Images in the knowledge base, paired with what they show.
--
-- A text embedding cannot read pixels, so an image is retrieved through words that stand in
-- for it: the title an admin gives it, their caption, and a description the vision model
-- writes. Those are what get embedded; the file itself is just stored and sent.
ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS image_path varchar(255);
ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS caption    text;

ALTER TABLE knowledge_sources DROP CONSTRAINT IF EXISTS ck_knowledge_sources_type;
ALTER TABLE knowledge_sources
    ADD CONSTRAINT ck_knowledge_sources_type
    CHECK (source_type IN ('TEXT', 'PDF', 'IMAGE'));

-- An image source must actually have an image behind it, or retrieval would match a
-- passage that cannot be shown to anyone.
ALTER TABLE knowledge_sources
    ADD CONSTRAINT ck_knowledge_sources_image
    CHECK (source_type <> 'IMAGE' OR image_path IS NOT NULL);
