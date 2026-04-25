-- ============================================
-- ProposalPilot Migration 011: Opportunity pipeline observability
-- ============================================

CREATE TABLE IF NOT EXISTS public.pipeline_run_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  pipeline_type TEXT NOT NULL CHECK (pipeline_type IN (
    'discovery',
    'deterministic_scoring',
    'freshness_check',
    'distribution_snapshot',
    'quality_check'
  )),
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
CREATE INDEX IF NOT EXISTS idx_pipeline_run_metrics_workspace_status
  ON public.pipeline_run_metrics(workspace_id, status, started_at DESC);

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

ALTER TABLE public.pipeline_run_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_distribution_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sam_data_quality_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pipeline_run_metrics_all" ON public.pipeline_run_metrics
  FOR ALL USING (public.is_workspace_member(workspace_id));

CREATE POLICY "score_distribution_snapshots_all" ON public.score_distribution_snapshots
  FOR ALL USING (public.is_workspace_member(workspace_id));

CREATE POLICY "sam_data_quality_reports_all" ON public.sam_data_quality_reports
  FOR ALL USING (public.is_workspace_member(workspace_id));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.pipeline_run_metrics
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.score_distribution_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sam_data_quality_reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
