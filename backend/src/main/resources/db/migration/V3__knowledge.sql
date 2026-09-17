-- The knowledge base and its embeddings (PRD 4.3, FR-02), plus an embedding per message.
--
-- Vectors live in PostgreSQL via pgvector rather than in Pinecone as the contextual report
-- proposed. PostgreSQL was already mandated by report 5.2, so keeping the vectors beside the
-- text removes a second service, removes a sync path that can drift, and makes deletion a
-- plain ON DELETE CASCADE inside one transaction instead of a best-effort remote cleanup.
-- Recorded as a deviation in docs/architecture.md.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_sources (
    id                uuid           PRIMARY KEY,
    organization_id   uuid           NOT NULL,
    title             varchar(255)   NOT NULL,
    source_type       varchar(20)    NOT NULL,
    original_filename varchar(255),
    status            varchar(20)    NOT NULL,
    -- Why indexing failed, shown to the admin. Null unless status is FAILED.
    error             text,
    chunk_count       integer        NOT NULL DEFAULT 0,
    character_count   integer        NOT NULL DEFAULT 0,
    created_at        timestamptz(6) NOT NULL DEFAULT now(),
    indexed_at        timestamptz(6),
    CONSTRAINT fk_knowledge_sources_org    FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
    CONSTRAINT ck_knowledge_sources_type   CHECK (source_type IN ('TEXT', 'PDF')),
    CONSTRAINT ck_knowledge_sources_status CHECK (status IN ('PENDING', 'INDEXING', 'READY', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_knowledge_sources_org ON knowledge_sources (organization_id);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id                  uuid           PRIMARY KEY,
    knowledge_source_id uuid           NOT NULL,
    -- Denormalised from the source so a similarity search filters by workspace without a
    -- join. Retrieval must never cross an organization boundary.
    organization_id     uuid           NOT NULL,
    ordinal             integer        NOT NULL,
    content             text           NOT NULL,
    character_count     integer        NOT NULL DEFAULT 0,
    embedding           vector(1536),
    -- Recorded per row: similarity scores from two different models are not comparable, so
    -- changing the model means re-indexing, and this is what makes that detectable.
    embedding_model     varchar(100)   NOT NULL,
    created_at          timestamptz(6) NOT NULL DEFAULT now(),
    CONSTRAINT fk_knowledge_chunks_source      FOREIGN KEY (knowledge_source_id) REFERENCES knowledge_sources (id) ON DELETE CASCADE,
    CONSTRAINT fk_knowledge_chunks_org         FOREIGN KEY (organization_id)     REFERENCES organizations (id)     ON DELETE CASCADE,
    CONSTRAINT uk_knowledge_chunks_source_ord  UNIQUE (knowledge_source_id, ordinal)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_org ON knowledge_chunks (organization_id);

CREATE TABLE IF NOT EXISTS message_embeddings (
    id                uuid           PRIMARY KEY,
    -- One embedding per message. Meta redelivers webhooks, so this is what keeps
    -- re-ingestion from producing duplicate vectors.
    social_message_id uuid           NOT NULL,
    thread_id         uuid           NOT NULL,
    -- The organization api-key, matching social_messages and conversation_threads, which
    -- denormalise it as a plain string rather than a foreign key.
    tenant_id         varchar(255)   NOT NULL,
    content           text           NOT NULL,
    embedding         vector(1536),
    embedding_model   varchar(100)   NOT NULL,
    created_at        timestamptz(6) NOT NULL DEFAULT now(),
    CONSTRAINT uk_message_embeddings_message UNIQUE (social_message_id),
    CONSTRAINT fk_message_embeddings_message FOREIGN KEY (social_message_id) REFERENCES social_messages (id)      ON DELETE CASCADE,
    CONSTRAINT fk_message_embeddings_thread  FOREIGN KEY (thread_id)         REFERENCES conversation_threads (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_message_embeddings_thread ON message_embeddings (thread_id);
CREATE INDEX IF NOT EXISTS idx_message_embeddings_tenant ON message_embeddings (tenant_id);

-- HNSW rather than IVFFlat: IVFFlat has to be trained on rows that already exist, so
-- building it here — before anything is ingested — would produce a useless index that had
-- to be rebuilt. HNSW builds incrementally, so it can be created up front.
-- vector_cosine_ops matches the <=> operator used by the retrieval queries.
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
    ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_message_embeddings_embedding
    ON message_embeddings USING hnsw (embedding vector_cosine_ops);
