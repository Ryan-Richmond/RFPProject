-- ============================================
-- ProposalPilot Migration 016: Sprint 5 reliability hardening
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

CREATE INDEX IF NOT EXISTS idx_opportunity_backfill_jobs_workspace_created
  ON public.opportunity_backfill_jobs(workspace_id, created_at DESC);

ALTER TABLE public.opportunity_pipeline_dead_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_backfill_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "opportunity_pipeline_dead_letters_all"
  ON public.opportunity_pipeline_dead_letters
  FOR ALL USING (public.is_workspace_member(workspace_id));

CREATE POLICY "opportunity_backfill_jobs_all"
  ON public.opportunity_backfill_jobs
  FOR ALL USING (public.is_workspace_member(workspace_id));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.opportunity_pipeline_dead_letters
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.opportunity_backfill_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
