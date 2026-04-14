-- ============================================
-- ProposalPilot Migration 004: Win Probability Fields
-- Adds win probability columns to solicitations table
-- ============================================

ALTER TABLE solicitations
  ADD COLUMN IF NOT EXISTS win_probability INTEGER,
  ADD COLUMN IF NOT EXISTS key_win_factors JSONB,
  ADD COLUMN IF NOT EXISTS key_risk_factors JSONB,
  ADD COLUMN IF NOT EXISTS bid_decision_recommendation TEXT;
