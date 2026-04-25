-- ============================================
-- ProposalPilot Migration 015: Sprint 4 feedback + learning loop
-- ============================================

CREATE TABLE IF NOT EXISTS public.opportunity_feedback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  sam_opportunity_id UUID NOT NULL REFERENCES public.sam_opportunities(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'viewed',
    'saved',
    'dismissed',
    'pursued',
    'promoted',
    'override_set',
    'override_cleared'
  )),
  prior_recommendation TEXT,
  reason_tag TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_feedback_events_workspace_type_created
  ON public.opportunity_feedback_events(workspace_id, event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.scoring_model_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  deterministic_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  pursue_threshold INTEGER NOT NULL DEFAULT 75,
  monitor_threshold INTEGER NOT NULL DEFAULT 50,
  exploration_ratio NUMERIC(4,3) NOT NULL DEFAULT 0.200,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, version)
);

CREATE INDEX IF NOT EXISTS idx_scoring_model_configs_workspace_version
  ON public.scoring_model_configs(workspace_id, version DESC);

CREATE TABLE IF NOT EXISTS public.scoring_calibration_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  config_version INTEGER,
  baseline_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  proposed_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  proposed_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scoring_calibration_runs_workspace_created
  ON public.scoring_calibration_runs(workspace_id, created_at DESC);

ALTER TABLE public.opportunity_feedback_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_model_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_calibration_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "opportunity_feedback_events_all"
  ON public.opportunity_feedback_events
  FOR ALL USING (public.is_workspace_member(workspace_id));

CREATE POLICY "scoring_model_configs_all"
  ON public.scoring_model_configs
  FOR ALL USING (public.is_workspace_member(workspace_id));

CREATE POLICY "scoring_calibration_runs_all"
  ON public.scoring_calibration_runs
  FOR ALL USING (public.is_workspace_member(workspace_id));
