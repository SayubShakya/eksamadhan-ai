-- The text a source was actually read as.
--
-- Until now only the chunks survived, so nobody could see what a crawler extracted from a
-- page — whether it got the content or a cookie banner — and re-chunking meant re-crawling
-- the site or re-uploading the file. Keeping the extracted text makes the reading inspectable
-- and re-indexing a local operation.
ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS content text;
