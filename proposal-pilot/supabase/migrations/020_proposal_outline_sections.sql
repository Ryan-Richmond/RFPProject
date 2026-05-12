-- ============================================
-- ProposalPilot Migration 020: Annotated Proposal Outlines
-- Adds solicitation-driven outline sections used for drafting, review, and export.
-- ============================================

CREATE TABLE IF NOT EXISTS public.proposal_outline_sections (
  id uuid primary key default extensions.uuid_generate_v4(),
  proposal_draft_id uuid not null references public.proposal_drafts(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  parent_section_id uuid references public.proposal_outline_sections(id) on delete cascade,
  section_number text,
  title text not null,
  volume text,
  section_type text not null default 'other'
    check (section_type in (
      'executive_summary', 'technical', 'management', 'past_performance',
      'pricing', 'resume', 'attachment', 'form', 'compliance', 'other'
    )),
  section_order integer not null,
  page_limit numeric,
  target_word_count integer,
  evaluation_weight text check (evaluation_weight in ('high', 'medium', 'low')),
  instructions text,
  source_refs text[] not null default '{}',
  mapped_requirement_ids text[] not null default '{}',
  owner_user_id uuid references auth.users(id) on delete set null,
  reviewer_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'planned'
    check (status in (
      'planned', 'approved', 'ai_drafted', 'in_review', 'needs_revision',
      'approved_for_export', 'blocked'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_outline_sections_draft
  ON public.proposal_outline_sections(proposal_draft_id, section_order);

CREATE INDEX IF NOT EXISTS idx_proposal_outline_sections_workspace
  ON public.proposal_outline_sections(workspace_id);

CREATE INDEX IF NOT EXISTS idx_proposal_outline_sections_requirements
  ON public.proposal_outline_sections USING gin(mapped_requirement_ids);

ALTER TABLE public.proposal_outline_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposal_outline_sections_all" ON public.proposal_outline_sections
  FOR ALL USING (public.is_workspace_member(workspace_id));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.proposal_outline_sections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
