-- ============================================
-- ProposalPilot Migration 017: Sprint 6 pilot execution tracking
-- ============================================

CREATE TABLE IF NOT EXISTS public.pilot_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,
  status TEXT NOT NULL DEFAULT 'onboarding' CHECK (status IN ('onboarding', 'active', 'paused', 'completed')),
  success_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  kickoff_notes TEXT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pilot_weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  narrative TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, week_start, week_end)
);

CREATE INDEX IF NOT EXISTS idx_pilot_weekly_reports_workspace_week
  ON public.pilot_weekly_reports(workspace_id, week_start DESC);

ALTER TABLE public.pilot_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pilot_workspaces_all"
  ON public.pilot_workspaces
  FOR ALL USING (public.is_workspace_member(workspace_id));

CREATE POLICY "pilot_weekly_reports_all"
  ON public.pilot_weekly_reports
  FOR ALL USING (public.is_workspace_member(workspace_id));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.pilot_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
