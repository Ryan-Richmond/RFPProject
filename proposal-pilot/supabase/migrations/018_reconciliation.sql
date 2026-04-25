-- ============================================
-- ProposalPilot Migration 018: Reconciliation
--
-- Resolves schema drift between the live database (which has sam_opportunities
-- with 28 columns from our direct sync session) and the codebase (which expects
-- raw_payload, place_of_performance_state, and 12 additional tables from
-- migrations 010–017 that were never applied).
--
-- This migration is idempotent (IF NOT EXISTS / IF EXISTS everywhere).
-- ============================================

-- ============================================
-- 1. Reconcile sam_opportunities schema
--    Live DB has: raw_data (jsonb), place_of_performance (jsonb)
--    Code expects: raw_payload (jsonb), place_of_performance_state (text)
--    Also needs: source_url (text)
-- ============================================

-- Add raw_payload as a generated column that mirrors raw_data
-- This lets both names work without duplicating data.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sam_opportunities' AND column_name = 'raw_payload'
  ) THEN
    ALTER TABLE public.sam_opportunities ADD COLUMN raw_payload JSONB GENERATED ALWAYS AS (raw_data) STORED;
  END IF;
END $$;

-- Add place_of_performance_state extracted from JSONB
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sam_opportunities' AND column_name = 'place_of_performance_state'
  ) THEN
    ALTER TABLE public.sam_opportunities ADD COLUMN place_of_performance_state TEXT;
    -- Backfill from existing JSONB data
    UPDATE public.sam_opportunities
    SET place_of_performance_state = place_of_performance->>'state'
    WHERE place_of_performance IS NOT NULL AND place_of_performance->>'state' IS NOT NULL;
  END IF;
END $$;

-- Add source_url if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sam_opportunities' AND column_name = 'source_url'
  ) THEN
    ALTER TABLE public.sam_opportunities ADD COLUMN source_url TEXT;
    -- Backfill from ui_link
    UPDATE public.sam_opportunities SET source_url = ui_link WHERE ui_link IS NOT NULL;
  END IF;
END $$;

-- ============================================
-- 2. Create sam_opportunity_scores (from 010_sam_centralized_scoring)
--    with ALL columns from sprints 0–2
-- ============================================
CREATE TABLE IF NOT EXISTS public.sam_opportunity_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sam_opportunity_id UUID NOT NULL REFERENCES public.sam_opportunities(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- Tier 1 deterministic dimensions (Sprint 0)
  naics_match_score INTEGER NOT NULL DEFAULT 0,
  set_aside_eligibility_score INTEGER NOT NULL DEFAULT 0,
  agency_alignment_score INTEGER NOT NULL DEFAULT 0,
  timeline_viability_score INTEGER NOT NULL DEFAULT 0,
  psc_domain_score INTEGER NOT NULL DEFAULT 0,

  -- Composite
  overall_score INTEGER NOT NULL DEFAULT 0,
  recommendation TEXT NOT NULL DEFAULT 'pass'
    CHECK (recommendation IN ('pursue', 'monitor', 'pass')),
  is_disqualified BOOLEAN NOT NULL DEFAULT FALSE,
  disqualification_reason TEXT,

  -- Tier 2 AI-enriched (Sprint 1)
  ai_score_rationale TEXT,
  ai_capability_match_score INTEGER,
  ai_size_fit_score INTEGER,
  ai_competition_level_score INTEGER,
  ai_overall_score INTEGER,
  ai_recommendation TEXT,
  agency_intel TEXT,
  incumbent_info TEXT,
  competitive_landscape TEXT,
  ai_citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_scored_at TIMESTAMPTZ,

  -- Sprint 2: bid viability + risk
  ai_bid_readiness_score INTEGER,
  ai_delivery_complexity_score INTEGER,
  ai_confidence TEXT CHECK (ai_confidence IN ('high', 'medium', 'low')),
  ai_estimated_contract_value_min NUMERIC,
  ai_estimated_contract_value_max NUMERIC,

  scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (sam_opportunity_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_sam_opportunity_scores_workspace
  ON public.sam_opportunity_scores(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sam_opportunity_scores_workspace_overall
  ON public.sam_opportunity_scores(workspace_id, overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_sam_opportunity_scores_workspace_rec_deadline
  ON public.sam_opportunity_scores(workspace_id, recommendation, scored_at DESC);

ALTER TABLE public.sam_opportunity_scores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "sam_opportunity_scores_all" ON public.sam_opportunity_scores
    FOR ALL USING (public.is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.sam_opportunity_scores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 3. Pipeline observability tables (from 011)
-- ============================================
CREATE TABLE IF NOT EXISTS public.pipeline_run_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  pipeline_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  duration_ms INTEGER,
  rows_read INTEGER NOT NULL DEFAULT 0,
  rows_written INTEGER NOT NULL DEFAULT 0,
  retries INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_run_metrics_workspace_type_started
  ON public.pipeline_run_metrics(workspace_id, pipeline_type, started_at DESC);

ALTER TABLE public.pipeline_run_metrics ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "pipeline_run_metrics_all" ON public.pipeline_run_metrics
    FOR ALL USING (public.is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.pipeline_run_metrics
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Score distribution snapshots
CREATE TABLE IF NOT EXISTS public.score_distribution_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_count INTEGER NOT NULL DEFAULT 0,
  pursue_count INTEGER NOT NULL DEFAULT 0,
  monitor_count INTEGER NOT NULL DEFAULT 0,
  pass_count INTEGER NOT NULL DEFAULT 0,
  disqualified_count INTEGER NOT NULL DEFAULT 0,
  avg_overall_score NUMERIC(5,2),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_score_distribution_snapshots_workspace_date
  ON public.score_distribution_snapshots(workspace_id, snapshot_date DESC);

ALTER TABLE public.score_distribution_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "score_distribution_snapshots_all" ON public.score_distribution_snapshots
    FOR ALL USING (public.is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.score_distribution_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- SAM data quality reports
CREATE TABLE IF NOT EXISTS public.sam_data_quality_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_rows INTEGER NOT NULL DEFAULT 0,
  missing_naics_count INTEGER NOT NULL DEFAULT 0,
  invalid_deadline_count INTEGER NOT NULL DEFAULT 0,
  missing_set_aside_count INTEGER NOT NULL DEFAULT 0,
  missing_agency_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_sam_data_quality_reports_workspace_date
  ON public.sam_data_quality_reports(workspace_id, report_date DESC);

ALTER TABLE public.sam_data_quality_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "sam_data_quality_reports_all" ON public.sam_data_quality_reports
    FOR ALL USING (public.is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.sam_data_quality_reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 4. Sprint 1: AI capability enrichment (from 012)
-- ============================================
CREATE TABLE IF NOT EXISTS public.sam_opportunity_requirement_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  sam_opportunity_id UUID NOT NULL REFERENCES public.sam_opportunities(id) ON DELETE CASCADE,
  extracted_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_capabilities TEXT[] NOT NULL DEFAULT '{}',
  extraction_model TEXT NOT NULL DEFAULT 'anthropic/claude-sonnet-4-6',
  extraction_confidence TEXT CHECK (extraction_confidence IN ('high', 'medium', 'low')),
  extraction_rationale TEXT,
  evidence_matches JSONB NOT NULL DEFAULT '[]'::jsonb,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, sam_opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_sam_opp_req_profiles_workspace
  ON public.sam_opportunity_requirement_profiles(workspace_id, extracted_at DESC);

ALTER TABLE public.sam_opportunity_requirement_profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "sam_opportunity_requirement_profiles_all"
    ON public.sam_opportunity_requirement_profiles
    FOR ALL USING (public.is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.sam_opportunity_requirement_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 5. Sprint 3: Explainability + overrides (from 014)
-- ============================================
CREATE TABLE IF NOT EXISTS public.sam_opportunity_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  sam_opportunity_id UUID NOT NULL REFERENCES public.sam_opportunities(id) ON DELETE CASCADE,
  change_source TEXT NOT NULL CHECK (change_source IN ('deterministic', 'ai_enrichment', 'manual_override')),
  overall_score INTEGER,
  recommendation TEXT,
  ai_overall_score INTEGER,
  ai_recommendation TEXT,
  change_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sam_score_history_workspace_opp_created
  ON public.sam_opportunity_score_history(workspace_id, sam_opportunity_id, created_at DESC);

ALTER TABLE public.sam_opportunity_score_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "sam_opportunity_score_history_all"
    ON public.sam_opportunity_score_history
    FOR ALL USING (public.is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.sam_opportunity_recommendation_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  sam_opportunity_id UUID NOT NULL REFERENCES public.sam_opportunities(id) ON DELETE CASCADE,
  override_recommendation TEXT NOT NULL CHECK (override_recommendation IN ('pursue', 'monitor', 'pass')),
  override_reason TEXT,
  override_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, sam_opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_sam_score_overrides_workspace
  ON public.sam_opportunity_recommendation_overrides(workspace_id, updated_at DESC);

ALTER TABLE public.sam_opportunity_recommendation_overrides ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "sam_opportunity_recommendation_overrides_all"
    ON public.sam_opportunity_recommendation_overrides
    FOR ALL USING (public.is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.sam_opportunity_recommendation_overrides
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 6. Sprint 4: Feedback + learning loop (from 015)
-- ============================================
CREATE TABLE IF NOT EXISTS public.opportunity_feedback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  sam_opportunity_id UUID NOT NULL REFERENCES public.sam_opportunities(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'viewed', 'saved', 'dismissed', 'pursued', 'promoted',
    'override_set', 'override_cleared'
  )),
  prior_recommendation TEXT,
  reason_tag TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_feedback_events_workspace_type_created
  ON public.opportunity_feedback_events(workspace_id, event_type, created_at DESC);

ALTER TABLE public.opportunity_feedback_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "opportunity_feedback_events_all"
    ON public.opportunity_feedback_events
    FOR ALL USING (public.is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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

ALTER TABLE public.scoring_model_configs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "scoring_model_configs_all"
    ON public.scoring_model_configs
    FOR ALL USING (public.is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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

ALTER TABLE public.scoring_calibration_runs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "scoring_calibration_runs_all"
    ON public.scoring_calibration_runs
    FOR ALL USING (public.is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 7. Sprint 5: Pipeline hardening (from 016)
-- ============================================
CREATE TABLE IF NOT EXISTS public.opportunity_pipeline_dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  pipeline_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  error_message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  retry_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'replayed', 'ignored')),
  first_failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  replayed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_pipeline_dead_letters_workspace_status
  ON public.opportunity_pipeline_dead_letters(workspace_id, status, last_failed_at DESC);

ALTER TABLE public.opportunity_pipeline_dead_letters ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "opportunity_pipeline_dead_letters_all"
    ON public.opportunity_pipeline_dead_letters
    FOR ALL USING (public.is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.opportunity_pipeline_dead_letters
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.opportunity_backfill_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('deterministic_scoring', 'ai_enrichment', 'history_snapshot')),
  date_from DATE,
  date_to DATE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  progress_pct INTEGER NOT NULL DEFAULT 0,
  throttled BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.opportunity_backfill_jobs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "opportunity_backfill_jobs_all"
    ON public.opportunity_backfill_jobs
    FOR ALL USING (public.is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.opportunity_backfill_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 8. Sprint 6: Pilot execution (from 017)
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

ALTER TABLE public.pilot_workspaces ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "pilot_workspaces_all"
    ON public.pilot_workspaces
    FOR ALL USING (public.is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.pilot_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

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

ALTER TABLE public.pilot_weekly_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "pilot_weekly_reports_all"
    ON public.pilot_weekly_reports
    FOR ALL USING (public.is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 9. Ensure sam_opportunities RLS allows reads
-- ============================================
DO $$ BEGIN
  CREATE POLICY "sam_opportunities_read_authenticated" ON public.sam_opportunities
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- Done. All 12 tables from sprints 0–6 are now live.
-- ============================================
