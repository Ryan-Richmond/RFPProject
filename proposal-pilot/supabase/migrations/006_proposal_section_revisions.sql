-- ============================================
-- ProposalPilot Migration 006: Proposal Section Revision History
-- Preserves AI-generated content and user edits for review auditability
-- ============================================

create table public.proposal_section_revisions (
  id uuid primary key default extensions.uuid_generate_v4(),
  proposal_draft_id uuid not null references public.proposal_drafts(id) on delete cascade,
  proposal_section_id uuid references public.proposal_sections(id) on delete set null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_type text not null
    check (actor_type in ('ai', 'user', 'system')),
  actor_user_id uuid references auth.users(id) on delete set null,
  change_type text not null
    check (change_type in ('generated', 'edited', 'accepted', 'rejected', 'superseded')),
  section_title text not null,
  content text not null default '',
  review_status text
    check (review_status in ('pending', 'accepted', 'rejected', 'edited')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_proposal_section_revisions_draft
  on public.proposal_section_revisions(proposal_draft_id);

create index idx_proposal_section_revisions_section
  on public.proposal_section_revisions(proposal_section_id);

create index idx_proposal_section_revisions_created
  on public.proposal_section_revisions(created_at desc);

alter table public.proposal_section_revisions enable row level security;

create policy "proposal_section_revisions_all" on public.proposal_section_revisions
  for all using (public.is_workspace_member(workspace_id));

-- Track discovery refresh behavior for user-facing trust and ops review.
ALTER TABLE public.discovery_runs
  ADD COLUMN IF NOT EXISTS opportunities_created integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opportunities_refreshed integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opportunities_skipped integer DEFAULT 0;
