-- ============================================
-- ProposalPilot Migration 022: Proposal Action Items
-- Converts placeholders, compliance gaps, and review needs into trackable work.
-- ============================================

CREATE TABLE IF NOT EXISTS public.proposal_action_items (
  id uuid primary key default extensions.uuid_generate_v4(),
  proposal_draft_id uuid not null references public.proposal_drafts(id) on delete cascade,
  proposal_section_id uuid references public.proposal_sections(id) on delete cascade,
  outline_section_id uuid references public.proposal_outline_sections(id) on delete set null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null,
  source text not null check (source in (
    'placeholder', 'compliance_finding', 'low_confidence', 'pending_review', 'manual'
  )),
  source_key text not null,
  requirement_id text,
  title text not null,
  description text,
  severity text not null default 'medium' check (severity in ('critical', 'high', 'medium', 'low')),
  status text not null default 'open' check (status in (
    'open', 'in_progress', 'blocked', 'resolved', 'accepted_risk'
  )),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(proposal_draft_id, source_key)
);

CREATE INDEX IF NOT EXISTS idx_proposal_action_items_draft_status
  ON public.proposal_action_items(proposal_draft_id, status, severity);

CREATE INDEX IF NOT EXISTS idx_proposal_action_items_workspace_owner
  ON public.proposal_action_items(workspace_id, owner_user_id, status);

CREATE INDEX IF NOT EXISTS idx_proposal_action_items_section
  ON public.proposal_action_items(proposal_section_id);

CREATE INDEX IF NOT EXISTS idx_proposal_action_items_outline
  ON public.proposal_action_items(outline_section_id);

ALTER TABLE public.proposal_action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposal_action_items_all" ON public.proposal_action_items
  FOR ALL USING (public.is_workspace_member(workspace_id));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.proposal_action_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
