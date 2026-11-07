-- Onboarding (7 November 2026): "Try your AI" became a setup step, before connecting a channel,
-- so an owner sees the AI answer from their own knowledge before any customer does.
ALTER TABLE organizations ADD COLUMN onboarding_ai_tried boolean NOT NULL DEFAULT false;

-- Businesses already set up have nothing to try first.
UPDATE organizations SET onboarding_ai_tried = true WHERE onboarding_completed_at IS NOT NULL;
