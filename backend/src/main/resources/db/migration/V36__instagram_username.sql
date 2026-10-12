-- An Instagram account's username (12 October 2026). A Facebook Page's address can be built from
-- its id, an Instagram profile's only from its username, which was never stored, so the Channels
-- card offered "View Page" for Facebook and nothing for Instagram. Null for Facebook Pages.
ALTER TABLE social_pages ADD COLUMN username varchar(255);
