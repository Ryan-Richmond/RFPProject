-- ============================================
-- ProposalPilot Migration 003: Agent Operations Tracking
-- Logs all Perplexity Agent API calls for the Computer Ops dashboard
-- ============================================

CREATE TABLE agent_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL, -- 'discovery' | 'analysis' | 'drafting' | 'compliance' | 'scoring'
  status TEXT NOT NULL DEFAULT 'running', -- 'running' | 'completed' | 'failed'
  input_summary TEXT,
  output_summary TEXT,
  citations_count INTEGER DEFAULT 0,
  model_used TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX idx_agent_operations_workspace ON agent_operations(workspace_id);
CREATE INDEX idx_agent_operations_type ON agent_operations(operation_type);
CREATE INDEX idx_agent_operations_created ON agent_operations(created_at DESC);
CREATE INDEX idx_agent_operations_status ON agent_operations(status);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE agent_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_operations_all" ON agent_operations
  FOR ALL USING (
    workspace_id IS NULL OR public.is_workspace_member(workspace_id)
  );
