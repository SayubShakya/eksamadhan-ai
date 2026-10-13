-- Website chat (13 October 2026): a chat box a business adds to its own website. Each one is a
-- social_pages row with platform 'WEB', so its conversations use the same inbox, AI and
-- handover as Messenger and Instagram. page_id holds the widget's public key.
ALTER TABLE social_pages
    ADD COLUMN widget_origins  text,        -- the websites allowed to use it, one per line
    ADD COLUMN widget_greeting text,        -- first message in the chat box; null uses the default
    ADD COLUMN widget_color    varchar(7);  -- #rrggbb for the button and the visitor's messages
