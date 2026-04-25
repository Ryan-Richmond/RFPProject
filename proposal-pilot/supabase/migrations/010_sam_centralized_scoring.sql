-- ============================================
-- ProposalPilot Migration 010: Centralized SAM opportunities + workspace-scoped scoring
-- ============================================

CREATE TABLE IF NOT EXISTS public.sam_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id TEXT,
  solicitation_number TEXT,
  title TEXT NOT NULL,
  full_parent_path_name TEXT,
  naics_code TEXT,
  naics_codes TEXT[] DEFAULT '{}',
  type_of_set_aside TEXT,
  response_deadline TIMESTAMPTZ,
  posted_date TIMESTAMPTZ,
  classification_code TEXT,
  place_of_performance_state TEXT,
  point_of_contact JSONB DEFAULT '{}'::jsonb,
  description_url TEXT,
  source_url TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (notice_id),
  UNIQUE (solicitation_number, title)
);

CREATE INDEX IF NOT EXISTS idx_sam_opportunities_deadline
  ON public.sam_opportunities(response_deadline);
CREATE INDEX IF NOT EXISTS idx_sam_opportunities_naics
  ON public.sam_opportunities(naics_code);
CREATE INDEX IF NOT EXISTS idx_sam_opportunities_classification
  ON public.sam_opportunities(classification_code);

CREATE TABLE IF NOT EXISTS public.sam_opportunity_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sam_opportunity_id UUID NOT NULL REFERENCES public.sam_opportunities(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- Tier 1 deterministic dimensions
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

  -- Tier 2 AI-enriched (optional)
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

ALTER TABLE public.sam_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sam_opportunity_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sam_opportunities_read_authenticated" ON public.sam_opportunities
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "sam_opportunity_scores_all" ON public.sam_opportunity_scores
  FOR ALL USING (public.is_workspace_member(workspace_id));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sam_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sam_opportunity_scores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
