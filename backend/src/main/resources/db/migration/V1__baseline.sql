-- Baseline: the schema as Hibernate's ddl-auto left it, captured 2026-09-17.
--
-- From here on the schema is owned by these files, not by Hibernate. Existing databases
-- are baselined at version 1 (see spring.flyway.baseline-* in application.yaml), so this
-- file only runs on a fresh database.
--
-- Constraint names are given explicitly rather than reusing Hibernate's generated ones
-- (fk2oghrsxqg31…), so a fresh database is readable and errors name something meaningful.

CREATE TABLE IF NOT EXISTS tenants (
    id       uuid         PRIMARY KEY,
    api_key  varchar(255) NOT NULL,
    name     varchar(255) NOT NULL,
    CONSTRAINT uk_tenants_api_key UNIQUE (api_key)
);

CREATE TABLE IF NOT EXISTS social_pages (
    id                    uuid         PRIMARY KEY,
    access_token          text,
    connected_at          timestamp(6),
    instagram_business_id varchar(255),
    page_id               varchar(255) NOT NULL,
    page_name             varchar(255) NOT NULL,
    platform              varchar(255) NOT NULL,
    tenant_id             uuid         NOT NULL,
    CONSTRAINT fk_social_pages_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id)
);

CREATE TABLE IF NOT EXISTS conversation_threads (
    id                     uuid         PRIMARY KEY,
    customer_id            varchar(255) NOT NULL,
    customer_name          varchar(255),
    customer_avatar_url    text,
    platform               varchar(255) NOT NULL,
    tenant_id              varchar(255) NOT NULL,
    page_id                varchar(255) NOT NULL,
    social_page_id         uuid         NOT NULL,
    status                 varchar(20)  NOT NULL,
    assigned_agent_id      varchar(255),
    sentiment              varchar(255),
    last_message_at        timestamptz(6),
    last_message_preview   text,
    last_message_direction varchar(255),
    unanswered             integer      NOT NULL DEFAULT 0,
    created_at             timestamptz(6),
    escalated_at           timestamptz(6),
    resolved_at            timestamptz(6),
    CONSTRAINT uk_thread_page_customer UNIQUE (social_page_id, customer_id),
    CONSTRAINT fk_thread_social_page FOREIGN KEY (social_page_id) REFERENCES social_pages (id),
    CONSTRAINT ck_thread_status CHECK (status IN ('AI_HANDLING', 'OPEN_FOR_AGENT', 'AGENT_HANDLING', 'RESOLVED'))
);

CREATE INDEX IF NOT EXISTS idx_thread_tenant       ON conversation_threads (tenant_id);
CREATE INDEX IF NOT EXISTS idx_thread_status       ON conversation_threads (status);
CREATE INDEX IF NOT EXISTS idx_thread_last_message ON conversation_threads (last_message_at);

CREATE TABLE IF NOT EXISTS social_messages (
    id                  uuid         PRIMARY KEY,
    meta_message_id     varchar(255),
    external_message_id varchar(255),
    sender_id           varchar(255) NOT NULL,
    sender_name         varchar(255),
    sender_avatar_url   text,
    recipient_id        varchar(255) NOT NULL,
    text                text,
    content             text,
    direction           varchar(255) NOT NULL,
    platform            varchar(255) NOT NULL,
    page_id             varchar(255) NOT NULL,
    tenant_id           varchar(255) NOT NULL,
    reply_to_id         varchar(255),
    reaction            varchar(255),
    attachment_type     varchar(255),
    attachment_url      text,
    is_from_user        boolean      NOT NULL DEFAULT false,
    is_read             boolean      NOT NULL DEFAULT false,
    read_at             timestamptz(6),
    "timestamp"         timestamptz(6),
    thread_id           uuid,
    social_page_id      uuid,
    -- Meta redelivers webhooks; this is what makes ingestion idempotent.
    CONSTRAINT uk_messages_meta_id UNIQUE (meta_message_id),
    CONSTRAINT fk_messages_thread      FOREIGN KEY (thread_id)      REFERENCES conversation_threads (id),
    CONSTRAINT fk_messages_social_page FOREIGN KEY (social_page_id) REFERENCES social_pages (id)
);

CREATE INDEX IF NOT EXISTS idx_messages_thread ON social_messages (thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant ON social_messages (tenant_id);
