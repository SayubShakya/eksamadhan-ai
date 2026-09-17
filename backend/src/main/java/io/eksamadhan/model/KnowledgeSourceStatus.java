package io.eksamadhan.model;

/**
 * Indexing is asynchronous — embedding a document takes far longer than an HTTP request
 * should — so the admin watches a source move through these.
 */
public enum KnowledgeSourceStatus {
    PENDING,
    INDEXING,
    READY,
    FAILED
}
