# ER diagram — Semester 2

Thirteen tables, produced by 24 Flyway migrations. Verified against the running database, not
from memory. Compare with [Semester 1](../../old-system-design/er-diagram/Picture1.png), which
had six.

<!-- images -->
![ER diagram — Semester 2](entity-relationship-diagram.png)

*Rendered from the Mermaid source below.*

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ USERS : employs
    ORGANIZATIONS ||--o{ INVITATIONS : issues
    ORGANIZATIONS ||--o{ SOCIAL_PAGES : owns
    ORGANIZATIONS ||--o{ KNOWLEDGE_SOURCES : owns
    ORGANIZATIONS ||--o{ KNOWLEDGE_CHUNKS : scopes
    USERS ||--o{ PUSH_SUBSCRIPTIONS : registers
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ INVITATIONS : invited_by
    USERS ||--o{ SOCIAL_MESSAGES : sent_by
    SOCIAL_PAGES ||--o{ CONVERSATION_THREADS : hosts
    SOCIAL_PAGES ||--o{ SOCIAL_MESSAGES : carries
    CONVERSATION_THREADS ||--o{ SOCIAL_MESSAGES : contains
    CONVERSATION_THREADS ||--o{ MESSAGE_EMBEDDINGS : remembers
    CONVERSATION_THREADS ||--o{ NOTIFICATIONS : concerns
    SOCIAL_MESSAGES ||--|| MESSAGE_EMBEDDINGS : embedded_as
    SOCIAL_MESSAGES ||--o| MESSAGE_TRIAGE : judged_as
    SOCIAL_MESSAGES ||--o{ AI_TRACE_STEPS : traced_by
    SOCIAL_MESSAGES |o--o{ CONVERSATION_THREADS : decided_spam
    KNOWLEDGE_SOURCES ||--o{ KNOWLEDGE_CHUNKS : split_into

    ORGANIZATIONS {
        uuid id PK
        varchar api_key UK "the tenant key denormalised elsewhere"
        varchar name
        timestamptz created_at
    }

    USERS {
        uuid id PK
        uuid organization_id FK "ON DELETE CASCADE"
        varchar email UK
        varchar password_hash "bcrypt, null for a Google-only member"
        varchar firebase_uid UK "the Google account, pinned on first use"
        varchar first_name
        varchar last_name
        varchar role "OWNER ADMIN AGENT"
        text avatar
        varchar status "ACTIVE INVITED DISABLED"
        timestamptz created_at
        timestamptz last_login_at
        boolean system_admin "set only from configuration"
    }

    INVITATIONS {
        uuid id PK
        uuid organization_id FK "ON DELETE CASCADE"
        uuid invited_by FK "ON DELETE SET NULL"
        varchar email
        varchar role
        varchar token UK "32 random bytes, the whole secret"
        timestamptz created_at
        timestamptz expires_at
        timestamptz accepted_at
    }

    SOCIAL_PAGES {
        uuid id PK
        uuid organization_id FK
        varchar page_id "Meta page id"
        varchar page_name
        varchar platform "facebook instagram"
        varchar instagram_business_id
        text access_token
        timestamp connected_at
    }

    CONVERSATION_THREADS {
        uuid id PK
        uuid social_page_id FK
        varchar customer_id "Meta page-scoped id"
        varchar tenant_id "DENORMALISED api_key, no FK"
        varchar page_id "DENORMALISED, no FK"
        varchar assigned_agent_id "user id as STRING, no FK"
        varchar status "AI_HANDLING OPEN_FOR_AGENT AGENT_HANDLING RESOLVED"
        varchar customer_name
        text customer_avatar_url
        varchar platform
        varchar sentiment
        timestamptz sentiment_at
        varchar escalation_reason
        integer off_topic_streak "closes the chat at 3"
        boolean unrelated
        smallint priority "1 urgent 2 normal 3 low, from Jev"
        boolean spam "off the Active tab, AI silent"
        varchar spam_kind "promotion scam gibberish"
        double spam_score
        uuid spam_message_id FK "the message that decided it, ON DELETE SET NULL"
        timestamptz spam_at
        boolean spam_cleared "a person said not spam"
        text summary "handover brief"
        timestamptz summary_at
        integer summary_message_count
        timestamptz last_message_at
        text last_message_preview
        varchar last_message_direction
        integer unanswered
        timestamptz created_at
        timestamptz escalated_at
        timestamptz resolved_at
    }

    SOCIAL_MESSAGES {
        uuid id PK
        uuid thread_id FK
        uuid social_page_id FK
        uuid sent_by_user_id FK "ON DELETE SET NULL"
        varchar meta_message_id UK "dedupes Meta redelivery"
        varchar external_message_id "legacy, predates meta_message_id"
        varchar tenant_id "DENORMALISED, no FK"
        varchar page_id "DENORMALISED, no FK"
        varchar sender_id
        varchar recipient_id
        varchar sender_name
        text sender_avatar_url
        text text
        text content
        varchar direction "inbound outbound"
        varchar platform
        varchar reply_to_id "message id as STRING, no FK"
        varchar reaction
        varchar attachment_type "audio image video file"
        text attachment_url
        text transcript "voice note, transcribed"
        varchar sentiment "POSITIVE NEUTRAL NEGATIVE ANGRY"
        boolean ai_generated
        double ai_confidence
        text ai_sources "which passages were used"
        integer ai_generated_ms "how long the AI took"
        integer ai_waited_ms "how long it waited first"
        boolean is_from_user
        boolean is_read
        timestamptz read_at
        timestamptz timestamp
    }

    KNOWLEDGE_SOURCES {
        uuid id PK
        uuid organization_id FK "ON DELETE CASCADE"
        varchar title
        varchar source_type "TEXT PDF IMAGE URL"
        varchar status "PENDING INDEXING READY FAILED"
        text content "the text it was read as"
        varchar original_filename
        varchar image_path
        text source_url
        text caption
        text error
        integer chunk_count
        integer character_count
        timestamptz created_at
        timestamptz indexed_at
    }

    KNOWLEDGE_CHUNKS {
        uuid id PK
        uuid knowledge_source_id FK "ON DELETE CASCADE"
        uuid organization_id FK "denormalised so search needs no join"
        integer ordinal
        text content
        integer character_count
        vector embedding "1536 dims, HNSW cosine"
        varchar embedding_model "so a model change is detectable"
        timestamptz created_at
    }

    MESSAGE_EMBEDDINGS {
        uuid id PK
        uuid social_message_id FK,UK "ON DELETE CASCADE"
        uuid thread_id FK "ON DELETE CASCADE"
        varchar tenant_id "DENORMALISED, no FK"
        text content
        vector embedding "1536 dims, HNSW cosine"
        varchar embedding_model
        timestamptz created_at
    }

    MESSAGE_TRIAGE {
        uuid id PK
        uuid social_message_id FK,UK "ON DELETE CASCADE"
        varchar mode "shadow on"
        varchar intent "greeting thanks_or_ack business_question complaint wants_human off_topic abusive"
        double intent_confidence
        double wants_human "probability 0..1"
        double injection "probability 0..1"
        varchar sentiment
        double sentiment_confidence
        varchar action "NONE GREET THANK ESCALATE_HUMAN ESCALATE_INJECTION OFF_TOPIC"
        double spam "probability 0..1"
        varchar spam_kind "customer promotion scam gibberish"
        smallint urgency "1 urgent 2 normal 3 low"
        double urgency_confidence
        integer latency_ms
        integer input_tokens
        timestamptz created_at
    }

    AI_TRACE_STEPS {
        uuid id PK
        uuid social_message_id FK "ON DELETE CASCADE"
        bigint seq "order within the message"
        varchar kind "TRIGGER DECISION JEV RETRIEVAL MODEL ACTION HANDOVER NOTIFY END ERROR"
        text title
        text outcome "the branch taken"
        text input "what went in, as JSON"
        text output "what came out, as JSON"
        integer duration_ms
        timestamptz created_at
    }

    PUSH_SUBSCRIPTIONS {
        uuid id PK
        uuid user_id FK "ON DELETE CASCADE"
        text endpoint UK "one row per browser"
        text p256dh "browser public key"
        text auth "browser auth secret"
        text user_agent
        timestamptz created_at
        timestamptz last_used_at
    }

    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK "ON DELETE CASCADE"
        uuid thread_id FK "ON DELETE CASCADE"
        varchar kind "ESCALATED ASSIGNED CUSTOMER_REPLIED TEST"
        text title
        text body
        text url
        timestamptz created_at
        timestamptz read_at
    }
```

## Four properties worth defending in a viva

**1. Embeddings live in the database.** `knowledge_chunks.embedding` and
`message_embeddings.embedding` are `vector(1536)` columns provided by the pgvector extension,
each with an **HNSW index using `vector_cosine_ops`**. HNSW rather than IVFFlat because
IVFFlat must be trained on existing rows, and there are none when a migration runs — it would
build a useless index that had to be rebuilt after loading.

**2. Some "relationships" are deliberately not foreign keys.** `tenant_id` on threads,
messages and embeddings is the organisation's api-key as a *string*. So is `page_id`, and so
is `assigned_agent_id`, which points at a user without a constraint. This is inherited from
the pre-authentication schema, where a tenant was a string in a URL. It is honest to draw it
as it is: the tenant filter works, but the database does not enforce it, and that is a
weakness worth naming rather than hiding.

**3. Two partial unique indexes do real work.**

- `uk_thread_active` on `(social_page_id, customer_id) WHERE status <> 'RESOLVED'` — a
  customer may have exactly one live conversation, while every resolved one stays as history.
  A plain unique index would have made closing a conversation impossible to do twice.
- `uk_knowledge_source_url` on `(organization_id, source_url) WHERE source_url IS NOT NULL` —
  re-crawling a website updates each page instead of duplicating it.

**4. Cascade lives in SQL, not in JPA.** There is no `@OneToMany`, no `cascade` and no
`orphanRemoval` anywhere in the entity model; every association is a lazy `@ManyToOne` from
the child. Deletion is `ON DELETE CASCADE` in the schema. That is what makes removing a
knowledge source a single transaction that takes its vectors with it.

**5. A thread and a message point at each other.** A message belongs to a thread, and a thread
flagged as spam points back at the message that decided it (`spam_message_id`). The back
reference is `ON DELETE SET NULL`, not cascade: deleting a message must not delete the
conversation it was in, only the evidence for one judgment about it.

## Against Semester 1

The old model had `TENANTS`, `ROLES`, `USERS`, `SOCIAL_PAGES`, `KNOWLEDGE_DOCUMENTS` and
`SOCIAL_MESSAGES`, all with integer ids. Five changes matter:

| Then | Now |
| :--- | :--- |
| `ROLES` table joined to users | `role` column constrained to three values — roles are fixed, not data |
| `KNOWLEDGE_DOCUMENTS.content varchar(5000)` | a source plus its chunks, each with a vector and an indexing status |
| no conversation table | `conversation_threads`, and it is the busiest table in the schema |
| messages hang off page and tenant | messages hang off a thread, which is what makes a handover possible |
| integer surrogate keys | UUIDs, so ids are not guessable in a URL |
