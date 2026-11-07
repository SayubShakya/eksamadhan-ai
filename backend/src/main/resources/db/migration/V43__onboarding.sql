-- Onboarding (7 November 2026): what a new business told the welcome page and how far its setup
-- guide has gone. Kept on the business, so the guide looks the same on every device and for
-- every admin. organizations is the tenant table itself, so it needs no organization_id.

ALTER TABLE organizations ADD COLUMN onboarding_channels text;
ALTER TABLE organizations ADD COLUMN onboarding_welcomed boolean NOT NULL DEFAULT false;
ALTER TABLE organizations ADD COLUMN onboarding_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE organizations ADD COLUMN onboarding_solo boolean NOT NULL DEFAULT false;
ALTER TABLE organizations ADD COLUMN onboarding_ai_chosen boolean NOT NULL DEFAULT false;
ALTER TABLE organizations ADD COLUMN onboarding_completed_at timestamptz;

-- Businesses that were already running before onboarding existed have nothing to be welcomed to.
UPDATE organizations SET onboarding_welcomed = true, onboarding_hidden = true, onboarding_ai_chosen = true, onboarding_completed_at = now();
