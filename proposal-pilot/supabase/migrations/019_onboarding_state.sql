-- ============================================
-- ProposalPilot Migration 019: Onboarding State
--
-- Adds a flag to track whether a workspace has completed the onboarding guide.
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'has_completed_onboarding'
  ) THEN
    ALTER TABLE public.workspaces ADD COLUMN has_completed_onboarding BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;
