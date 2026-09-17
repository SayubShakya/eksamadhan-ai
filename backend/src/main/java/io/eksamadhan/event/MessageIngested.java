package io.eksamadhan.event;

import java.util.UUID;

/**
 * A message has been written to the database.
 *
 * Published inside the ingesting transaction but handled only after it commits: work like
 * embedding or answering runs on another thread, and that thread cannot see rows the
 * committing transaction has not released yet. Calling those services directly from the
 * ingestion path made them look up a message that did not exist yet and quietly do nothing.
 *
 * @param inbound true for a customer's message — the only kind the AI answers
 */
public record MessageIngested(UUID messageId, UUID pageId, boolean inbound) {}
