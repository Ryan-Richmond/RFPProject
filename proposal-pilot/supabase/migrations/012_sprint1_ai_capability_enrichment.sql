-- ============================================
-- ProposalPilot Migration 012: Sprint 1 AI capability enrichment
-- ============================================

ALTER TABLE public.pipeline_run_metrics
  DROP CONSTRAINT IF EXISTS pipeline_run_metrics_pipeline_type_check;

ALTER TABLE public.pipeline_run_metrics
  ADD CONSTRAINT pipeline_run_metrics_pipeline_type_check CHECK (pipeline_type IN (
    'discovery',
    'deterministic_scoring',
    'freshness_check',
    'distribution_snapshot',
    'quality_check',
    'ai_enrichment'
  ));

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

CREATE POLICY "sam_opportunity_requirement_profiles_all"
  ON public.sam_opportunity_requirement_profiles
  FOR ALL USING (public.is_workspace_member(workspace_id));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sam_opportunity_requirement_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
