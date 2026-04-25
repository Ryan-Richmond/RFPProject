-- ============================================
-- ProposalPilot Migration 014: Sprint 3 explainability + overrides
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

ALTER TABLE public.sam_opportunity_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sam_opportunity_recommendation_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sam_opportunity_score_history_all"
  ON public.sam_opportunity_score_history
  FOR ALL USING (public.is_workspace_member(workspace_id));

CREATE POLICY "sam_opportunity_recommendation_overrides_all"
  ON public.sam_opportunity_recommendation_overrides
  FOR ALL USING (public.is_workspace_member(workspace_id));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sam_opportunity_recommendation_overrides
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
