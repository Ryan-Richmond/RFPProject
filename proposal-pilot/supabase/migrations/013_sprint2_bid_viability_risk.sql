-- ============================================
-- ProposalPilot Migration 013: Sprint 2 bid viability + risk dimensions
-- ============================================

ALTER TABLE public.sam_opportunity_scores
  ADD COLUMN IF NOT EXISTS ai_bid_readiness_score INTEGER,
  ADD COLUMN IF NOT EXISTS ai_delivery_complexity_score INTEGER,
  ADD COLUMN IF NOT EXISTS ai_confidence TEXT CHECK (ai_confidence IN ('high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS ai_estimated_contract_value_min NUMERIC,
  ADD COLUMN IF NOT EXISTS ai_estimated_contract_value_max NUMERIC;
