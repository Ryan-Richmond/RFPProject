-- ============================================
-- ProposalPilot Migration 002: Opportunity Discovery
-- Adds tables for government RFP discovery, scoring, and client profiles
-- ============================================

-- ============================================
-- 1. Discovered Opportunities
-- ============================================
CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source TEXT NOT NULL, -- 'sam_gov' | 'usaspending' | 'state_portal' | 'manual'
  solicitation_number TEXT,
  title TEXT NOT NULL,
  agency TEXT NOT NULL,
  posted_date TIMESTAMPTZ,
  response_deadline TIMESTAMPTZ,
  naics_codes TEXT[] DEFAULT '{}',
  set_aside_type TEXT, -- '8(a)' | 'SDVOSB' | 'WOSB' | 'HUBZone' | 'SB' | 'unrestricted'
  estimated_value_min NUMERIC,
  estimated_value_max NUMERIC,
  contract_type TEXT, -- 'FFP' | 'T&M' | 'CPFF' | 'IDIQ'
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'closed' | 'awarded' | 'cancelled'
  source_url TEXT,
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. Opportunity Scores
-- ============================================
CREATE TABLE opportunity_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Dimension scores (0-100)
  naics_match_score INTEGER DEFAULT 0,
  size_fit_score INTEGER DEFAULT 0,
  capability_match_score INTEGER DEFAULT 0,
  set_aside_eligibility_score INTEGER DEFAULT 0,
  competition_level_score INTEGER DEFAULT 0,
  timeline_fit_score INTEGER DEFAULT 0,

  -- Composite
  overall_score INTEGER NOT NULL DEFAULT 0,
  recommendation TEXT NOT NULL DEFAULT 'pass', -- 'pursue' | 'monitor' | 'pass'
  score_rationale TEXT,
  scoring_model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',

  -- Agent research results
  agency_intel TEXT,
  incumbent_info TEXT,
  competitive_landscape TEXT,
  citations JSONB DEFAULT '[]',

  scored_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(opportunity_id, workspace_id)
);

-- ============================================
-- 3. Client Business Profiles
-- ============================================
CREATE TABLE client_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
  company_name TEXT,
  business_description TEXT,
  naics_codes TEXT[] DEFAULT '{}',
  certifications TEXT[] DEFAULT '{}', -- '8(a)', 'SDVOSB', 'ISO 9001', etc.
  annual_revenue_tier TEXT, -- 'under_1m' | '1m_10m' | '10m_50m' | '50m_plus'
  employee_count_tier TEXT, -- 'micro' | 'small' | 'mid' | 'large'
  past_contract_vehicles TEXT[] DEFAULT '{}', -- GSA Schedules, SEWP, etc.
  preferred_agencies TEXT[] DEFAULT '{}',
  excluded_agencies TEXT[] DEFAULT '{}',
  min_contract_value NUMERIC DEFAULT 0,
  max_contract_value NUMERIC,
  core_capabilities TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. Discovery Run Log
-- ============================================
CREATE TABLE discovery_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running', -- 'running' | 'completed' | 'failed'
  opportunities_found INTEGER DEFAULT 0,
  opportunities_scored INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX idx_opportunities_workspace ON opportunities(workspace_id);
CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_opportunities_deadline ON opportunities(response_deadline);
CREATE INDEX idx_opportunity_scores_workspace ON opportunity_scores(workspace_id);
CREATE INDEX idx_opportunity_scores_overall ON opportunity_scores(overall_score DESC);
CREATE INDEX idx_client_profiles_workspace ON client_profiles(workspace_id);
CREATE INDEX idx_discovery_runs_workspace ON discovery_runs(workspace_id);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_runs ENABLE ROW LEVEL SECURITY;

-- Policies using existing is_workspace_member() function
CREATE POLICY "opportunities_all" ON opportunities
  FOR ALL USING (public.is_workspace_member(workspace_id));

CREATE POLICY "opportunity_scores_all" ON opportunity_scores
  FOR ALL USING (public.is_workspace_member(workspace_id));

CREATE POLICY "client_profiles_all" ON client_profiles
  FOR ALL USING (public.is_workspace_member(workspace_id));

CREATE POLICY "discovery_runs_all" ON discovery_runs
  FOR ALL USING (public.is_workspace_member(workspace_id));

-- ============================================
-- Updated_at triggers
-- ============================================
CREATE TRIGGER set_updated_at BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON client_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
