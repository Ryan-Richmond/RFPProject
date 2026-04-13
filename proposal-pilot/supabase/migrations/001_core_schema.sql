-- ============================================
-- ProposalPilot Core Schema
-- Migration 001: Foundation tables
-- ============================================

-- Enable pgvector for embedding storage
create extension if not exists vector with schema extensions;

-- Enable UUID generation
create extension if not exists "uuid-ossp" with schema extensions;

-- ============================================
-- 1. Workspaces (tenant containers)
-- ============================================
create table public.workspaces (
  id uuid primary key default extensions.uuid_generate_v4(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- 2. Workspace Members
-- ============================================
create table public.workspace_members (
  id uuid primary key default extensions.uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique(workspace_id, user_id)
);

-- ============================================
-- 3. Company Profiles
-- ============================================
create table public.company_profiles (
  id uuid primary key default extensions.uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  cage_code text,
  uei text,
  naics_codes text[],
  set_aside_types text[],
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id)
);

-- ============================================
-- 4. Source Documents (uploaded files)
-- ============================================
create table public.source_documents (
  id uuid primary key default extensions.uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_type text not null check (document_type in ('rfp', 'company')),
  filename text not null,
  file_path text not null,
  file_size bigint not null,
  mime_type text not null,
  processing_status text not null default 'queued'
    check (processing_status in ('queued', 'processing', 'complete', 'error')),
  processing_error text,
  extracted_text text,
  page_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- 5. Evidence Chunks (indexed KB content + embeddings)
-- ============================================
create table public.evidence_chunks (
  id uuid primary key default extensions.uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_document_id uuid not null references public.source_documents(id) on delete cascade,
  content text not null,
  category text not null check (category in (
    'past_performance', 'technical_approach', 'key_personnel',
    'corporate_overview', 'certifications', 'management'
  )),
  naics_codes text[],
  agency text,
  contract_type text,
  keywords text[],
  content_date text,
  embedding vector(768), -- gemini-embedding-001 output dimension
  is_excluded boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================
-- 6. Solicitations (uploaded RFP metadata)
-- ============================================
create table public.solicitations (
  id uuid primary key default extensions.uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_document_id uuid references public.source_documents(id) on delete set null,
  solicitation_number text,
  title text not null,
  agency text,
  classification text check (classification in ('federal', 'state_local')),
  due_date timestamptz,
  status text not null default 'analyzing'
    check (status in ('analyzing', 'analyzed', 'draft_ready', 'reviewed', 'exported')),
  analysis_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- 7. Extracted Requirements
-- ============================================
create table public.extracted_requirements (
  id uuid primary key default extensions.uuid_generate_v4(),
  solicitation_id uuid not null references public.solicitations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  requirement_id text not null, -- e.g., REQ-001
  category text not null check (category in (
    'technical', 'management', 'past_performance',
    'pricing', 'compliance', 'submission_format'
  )),
  text text not null,
  section_ref text,
  evaluation_weight text check (evaluation_weight in ('high', 'medium', 'low')),
  readiness_score text check (readiness_score in ('green', 'yellow', 'red')),
  matched_evidence_ids uuid[],
  created_at timestamptz not null default now()
);

-- ============================================
-- 8. Compliance Matrix Entries
-- ============================================
create table public.compliance_matrix_entries (
  id uuid primary key default extensions.uuid_generate_v4(),
  solicitation_id uuid not null references public.solicitations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  instruction_ref text not null,
  instruction_text text not null,
  evaluation_ref text,
  evaluation_text text,
  mapped_requirements text[],
  created_at timestamptz not null default now()
);

-- ============================================
-- 9. Proposal Drafts
-- ============================================
create table public.proposal_drafts (
  id uuid primary key default extensions.uuid_generate_v4(),
  solicitation_id uuid not null references public.solicitations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  version integer not null default 1,
  status text not null default 'generating'
    check (status in ('generating', 'draft', 'in_review', 'approved', 'exported')),
  total_word_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- 10. Proposal Sections
-- ============================================
create table public.proposal_sections (
  id uuid primary key default extensions.uuid_generate_v4(),
  proposal_draft_id uuid not null references public.proposal_drafts(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  content text not null default '',
  section_order integer not null,
  requirement_mappings text[],
  placeholders text[],
  confidence text check (confidence in ('high', 'medium', 'low')),
  word_count integer,
  review_status text not null default 'pending'
    check (review_status in ('pending', 'accepted', 'rejected', 'edited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- 11. Citations
-- ============================================
create table public.citations (
  id uuid primary key default extensions.uuid_generate_v4(),
  proposal_section_id uuid not null references public.proposal_sections(id) on delete cascade,
  evidence_chunk_id uuid references public.evidence_chunks(id) on delete set null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_document_name text,
  excerpt text,
  created_at timestamptz not null default now()
);

-- ============================================
-- 12. Compliance Findings
-- ============================================
create table public.compliance_findings (
  id uuid primary key default extensions.uuid_generate_v4(),
  proposal_draft_id uuid not null references public.proposal_drafts(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  requirement_id text not null,
  status text not null check (status in ('addressed', 'partially_addressed', 'weak', 'unaddressed')),
  draft_location text,
  issue text,
  suggestion text,
  created_at timestamptz not null default now()
);

-- ============================================
-- 13. Proposal Outcomes
-- ============================================
create table public.proposal_outcomes (
  id uuid primary key default extensions.uuid_generate_v4(),
  solicitation_id uuid not null references public.solicitations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  outcome text not null check (outcome in ('won', 'lost', 'pending', 'no_bid')),
  contract_value numeric,
  award_date timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- 14. Audit Logs
-- ============================================
create table public.audit_logs (
  id uuid primary key default extensions.uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ============================================
-- Indexes
-- ============================================
create index idx_workspace_members_workspace on public.workspace_members(workspace_id);
create index idx_workspace_members_user on public.workspace_members(user_id);
create index idx_source_documents_workspace on public.source_documents(workspace_id);
create index idx_evidence_chunks_workspace on public.evidence_chunks(workspace_id);
create index idx_evidence_chunks_source_doc on public.evidence_chunks(source_document_id);
create index idx_evidence_chunks_category on public.evidence_chunks(category);
create index idx_solicitations_workspace on public.solicitations(workspace_id);
create index idx_extracted_requirements_solicitation on public.extracted_requirements(solicitation_id);
create index idx_extracted_requirements_workspace on public.extracted_requirements(workspace_id);
create index idx_compliance_matrix_solicitation on public.compliance_matrix_entries(solicitation_id);
create index idx_proposal_drafts_solicitation on public.proposal_drafts(solicitation_id);
create index idx_proposal_drafts_workspace on public.proposal_drafts(workspace_id);
create index idx_proposal_sections_draft on public.proposal_sections(proposal_draft_id);
create index idx_citations_section on public.citations(proposal_section_id);
create index idx_compliance_findings_draft on public.compliance_findings(proposal_draft_id);
create index idx_audit_logs_workspace on public.audit_logs(workspace_id);
create index idx_audit_logs_created on public.audit_logs(created_at desc);

-- Vector similarity search index for evidence retrieval
create index idx_evidence_chunks_embedding on public.evidence_chunks
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ============================================
-- Row Level Security
-- ============================================
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.company_profiles enable row level security;
alter table public.source_documents enable row level security;
alter table public.evidence_chunks enable row level security;
alter table public.solicitations enable row level security;
alter table public.extracted_requirements enable row level security;
alter table public.compliance_matrix_entries enable row level security;
alter table public.proposal_drafts enable row level security;
alter table public.proposal_sections enable row level security;
alter table public.citations enable row level security;
alter table public.compliance_findings enable row level security;
alter table public.proposal_outcomes enable row level security;
alter table public.audit_logs enable row level security;

-- Helper function: check workspace membership
create or replace function public.is_workspace_member(ws_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  ) or exists (
    select 1 from public.workspaces
    where id = ws_id and owner_id = auth.uid()
  );
$$ language sql security definer;

-- Workspaces: owner can do everything
create policy "workspace_owner_all" on public.workspaces
  for all using (owner_id = auth.uid());

-- Workspace members: members can read their own memberships
create policy "workspace_members_select" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));

create policy "workspace_members_insert" on public.workspace_members
  for insert with check (
    exists (select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())
  );

-- All workspace-scoped tables: members can read/write
create policy "company_profiles_all" on public.company_profiles
  for all using (public.is_workspace_member(workspace_id));

create policy "source_documents_all" on public.source_documents
  for all using (public.is_workspace_member(workspace_id));

create policy "evidence_chunks_all" on public.evidence_chunks
  for all using (public.is_workspace_member(workspace_id));

create policy "solicitations_all" on public.solicitations
  for all using (public.is_workspace_member(workspace_id));

create policy "extracted_requirements_all" on public.extracted_requirements
  for all using (public.is_workspace_member(workspace_id));

create policy "compliance_matrix_entries_all" on public.compliance_matrix_entries
  for all using (public.is_workspace_member(workspace_id));

create policy "proposal_drafts_all" on public.proposal_drafts
  for all using (public.is_workspace_member(workspace_id));

create policy "proposal_sections_all" on public.proposal_sections
  for all using (public.is_workspace_member(workspace_id));

create policy "citations_all" on public.citations
  for all using (public.is_workspace_member(workspace_id));

create policy "compliance_findings_all" on public.compliance_findings
  for all using (public.is_workspace_member(workspace_id));

create policy "proposal_outcomes_all" on public.proposal_outcomes
  for all using (public.is_workspace_member(workspace_id));

create policy "audit_logs_all" on public.audit_logs
  for all using (public.is_workspace_member(workspace_id));

-- ============================================
-- Auto-create workspace membership for owner
-- ============================================
create or replace function public.handle_new_workspace()
returns trigger as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

-- ============================================
-- Updated_at trigger
-- ============================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.workspaces
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.company_profiles
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.source_documents
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.solicitations
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.proposal_drafts
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.proposal_sections
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.proposal_outcomes
  for each row execute function public.handle_updated_at();
