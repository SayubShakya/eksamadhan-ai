-- Multi-tenancy (15 October 2026): every table carries the organization it belongs to, so the
-- data can later be split (sharded) by organization and tenant isolation can be checked in the
-- database itself. These seven tables only reached their organization through a user or a
-- message; each now has organization_id directly, filled in from that parent, then made
-- required. The three tables that still use the text tenant_id follow in a later migration.

-- Belong to a user.
ALTER TABLE notifications               ADD COLUMN organization_id uuid;
ALTER TABLE push_subscriptions          ADD COLUMN organization_id uuid;
ALTER TABLE pinned_conversations        ADD COLUMN organization_id uuid;
ALTER TABLE account_deletion_challenges ADD COLUMN organization_id uuid;
ALTER TABLE email_links                 ADD COLUMN organization_id uuid;

UPDATE notifications t               SET organization_id = u.organization_id FROM users u WHERE u.id = t.user_id;
UPDATE push_subscriptions t          SET organization_id = u.organization_id FROM users u WHERE u.id = t.user_id;
UPDATE pinned_conversations t        SET organization_id = u.organization_id FROM users u WHERE u.id = t.user_id;
UPDATE account_deletion_challenges t SET organization_id = u.organization_id FROM users u WHERE u.id = t.user_id;
UPDATE email_links t                 SET organization_id = u.organization_id FROM users u WHERE u.id = t.user_id;

-- Belong to a customer message; a message's organization is the one whose key it was filed under.
ALTER TABLE ai_trace_steps ADD COLUMN organization_id uuid;
ALTER TABLE message_triage ADD COLUMN organization_id uuid;

UPDATE ai_trace_steps t SET organization_id = o.id
  FROM social_messages m JOIN organizations o ON o.api_key = m.tenant_id
 WHERE m.id = t.social_message_id;
UPDATE message_triage t SET organization_id = o.id
  FROM social_messages m JOIN organizations o ON o.api_key = m.tenant_id
 WHERE m.id = t.social_message_id;

-- Required from now on. Deleting an organization already removes these rows through their user
-- or message; the cascade here says the same thing directly.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['notifications', 'push_subscriptions', 'pinned_conversations',
                           'account_deletion_challenges', 'email_links', 'ai_trace_steps', 'message_triage']
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN organization_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE',
                   t, 'fk_' || t || '_organization');
    EXECUTE format('CREATE INDEX %I ON %I (organization_id)', 'idx_' || t || '_organization', t);
  END LOOP;
END $$;
