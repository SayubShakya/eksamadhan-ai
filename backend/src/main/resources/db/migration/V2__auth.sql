-- Accounts: the organization (workspace), its users, and pending agent invitations.
--
-- `tenants` becomes `organizations` — same table, clearer name, no data rewritten.
-- The `api_key` column keeps its name and its values on purpose: conversation_threads
-- and social_messages denormalise it into plain varchar `tenant_id` columns with no
-- foreign key, so every existing row still resolves after the rename.

ALTER TABLE tenants RENAME TO organizations;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS created_at timestamptz(6) NOT NULL DEFAULT now();

-- social_pages.tenant_id is a real uuid foreign key, so renaming it touches no
-- denormalised strings.
ALTER TABLE social_pages RENAME COLUMN tenant_id TO organization_id;

-- Constraints are renamed by *kind*, not by name. A database created from V1 carries the
-- explicit names in that file; the development database predates Flyway and carries
-- Hibernate's generated ones (uk3en99tewvbc4g3a7ou4mt1ono and the like). Looking them up
-- makes this migration correct on both.
DO $$
DECLARE existing text;
BEGIN
    SELECT conname INTO existing FROM pg_constraint
        WHERE conrelid = 'organizations'::regclass AND contype = 'p';
    IF existing IS NOT NULL AND existing <> 'organizations_pkey' THEN
        EXECUTE format('ALTER TABLE organizations RENAME CONSTRAINT %I TO organizations_pkey', existing);
    END IF;

    SELECT conname INTO existing FROM pg_constraint
        WHERE conrelid = 'organizations'::regclass AND contype = 'u';
    IF existing IS NOT NULL AND existing <> 'uk_organizations_api_key' THEN
        EXECUTE format('ALTER TABLE organizations RENAME CONSTRAINT %I TO uk_organizations_api_key', existing);
    END IF;

    SELECT conname INTO existing FROM pg_constraint
        WHERE conrelid = 'social_pages'::regclass AND contype = 'f';
    IF existing IS NOT NULL AND existing <> 'fk_social_pages_org' THEN
        EXECUTE format('ALTER TABLE social_pages RENAME CONSTRAINT %I TO fk_social_pages_org', existing);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id              uuid         PRIMARY KEY,
    organization_id uuid         NOT NULL,
    email           varchar(255) NOT NULL,
    password_hash   varchar(255) NOT NULL,
    first_name      varchar(60)  NOT NULL,
    last_name       varchar(60),
    role            varchar(20)  NOT NULL,
    -- Data URL of a 128px square, produced by the frontend's lib/avatar.js.
    avatar          text,
    status          varchar(20)  NOT NULL,
    created_at      timestamptz(6) NOT NULL DEFAULT now(),
    last_login_at   timestamptz(6),
    CONSTRAINT uk_users_email   UNIQUE (email),
    CONSTRAINT fk_users_org     FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
    CONSTRAINT ck_users_role    CHECK (role   IN ('OWNER', 'ADMIN', 'AGENT')),
    CONSTRAINT ck_users_status  CHECK (status IN ('ACTIVE', 'INVITED', 'DISABLED'))
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users (organization_id);

CREATE TABLE IF NOT EXISTS invitations (
    id              uuid         PRIMARY KEY,
    organization_id uuid         NOT NULL,
    email           varchar(255) NOT NULL,
    role            varchar(20)  NOT NULL,
    -- 32 random bytes, base64url. This is the whole secret in the invite link.
    token           varchar(64)  NOT NULL,
    invited_by      uuid,
    created_at      timestamptz(6) NOT NULL DEFAULT now(),
    expires_at      timestamptz(6) NOT NULL,
    accepted_at     timestamptz(6),
    CONSTRAINT uk_invitations_token  UNIQUE (token),
    CONSTRAINT fk_invitations_org    FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
    CONSTRAINT fk_invitations_user   FOREIGN KEY (invited_by)      REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT ck_invitations_role   CHECK (role IN ('OWNER', 'ADMIN', 'AGENT'))
);

CREATE INDEX IF NOT EXISTS idx_invitations_org ON invitations (organization_id);
