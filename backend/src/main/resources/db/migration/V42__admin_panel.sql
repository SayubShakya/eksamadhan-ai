-- Admin panel (28 October 2026): the platform operator can suspend a business and restore it,
-- and every action they take is recorded.

-- A suspended business cannot sign in and gets no AI replies. Its customers' messages are
-- still received and stored, so nothing is lost while it is suspended.
ALTER TABLE organizations ADD COLUMN status varchar(20) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE organizations ADD COLUMN suspended_at timestamptz;
ALTER TABLE organizations ADD COLUMN suspended_reason text;
ALTER TABLE organizations ADD CONSTRAINT chk_organizations_status CHECK (status IN ('ACTIVE', 'SUSPENDED'));

-- What the platform admin did, to which business and which person, and why. organization_id is
-- the business acted on: it leads the key and the index, as on every table (multi-tenancy rule).
CREATE TABLE admin_audit_log (
    organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    id              uuid        NOT NULL DEFAULT gen_random_uuid(),
    admin_user_id   uuid        NOT NULL REFERENCES users(id),
    action          varchar(40) NOT NULL,
    target_user_id  uuid        REFERENCES users(id) ON DELETE SET NULL,
    detail          text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, id)
);
CREATE INDEX idx_admin_audit_log_organization ON admin_audit_log (organization_id, created_at DESC);
CREATE INDEX idx_admin_audit_log_created ON admin_audit_log (created_at DESC);
