-- Onboarding Confidence Ladder
-- Public company research stays outside the drafting evidence pool. User/SAM
-- verified evidence gets explicit provenance for readiness and RAG filters.

CREATE TABLE IF NOT EXISTS public.public_company_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('public_research', 'sam_entity')),
  trust_level TEXT NOT NULL CHECK (trust_level IN ('public_unverified', 'sam_verified')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'complete', 'error')),
  company_query TEXT NOT NULL,
  website TEXT,
  uei TEXT,
  cage TEXT,
  summary TEXT,
  suggestions JSONB NOT NULL DEFAULT '{}'::jsonb,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  applied_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_company_research_workspace
  ON public.public_company_research(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_company_research_status
  ON public.public_company_research(workspace_id, status);

ALTER TABLE public.public_company_research ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_company_research_all" ON public.public_company_research;
CREATE POLICY "public_company_research_all" ON public.public_company_research
  FOR ALL USING (public.is_workspace_member(workspace_id));

DROP TRIGGER IF EXISTS set_updated_at ON public.public_company_research;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.public_company_research
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.source_documents
  ADD COLUMN IF NOT EXISTS ingestion_mode TEXT NOT NULL DEFAULT 'standard'
  CHECK (ingestion_mode IN ('standard', 'legacy_proposal'));

ALTER TABLE public.evidence_chunks
  ADD COLUMN IF NOT EXISTS artifact_type TEXT,
  ADD COLUMN IF NOT EXISTS artifact_title TEXT,
  ADD COLUMN IF NOT EXISTS artifact_confidence TEXT DEFAULT 'medium'
    CHECK (artifact_confidence IN ('high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS trust_level TEXT NOT NULL DEFAULT 'user_verified'
    CHECK (trust_level IN ('user_verified', 'sam_verified', 'public_unverified'));

CREATE INDEX IF NOT EXISTS idx_evidence_chunks_artifact_type
  ON public.evidence_chunks(workspace_id, artifact_type);

CREATE INDEX IF NOT EXISTS idx_evidence_chunks_trust_level
  ON public.evidence_chunks(workspace_id, trust_level);

CREATE OR REPLACE FUNCTION public.match_evidence_chunks(
  query_embedding text,
  match_workspace_id uuid,
  match_count integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  source_document_id uuid,
  content text,
  category text,
  naics_codes text[],
  agency text,
  contract_type text,
  keywords text[],
  content_date text,
  similarity double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ec.id,
    ec.source_document_id,
    ec.content,
    ec.category,
    ec.naics_codes,
    ec.agency,
    ec.contract_type,
    ec.keywords,
    ec.content_date,
    1 - (ec.embedding <=> query_embedding::vector(1024)) AS similarity
  FROM public.evidence_chunks ec
  WHERE ec.workspace_id = match_workspace_id
    AND ec.is_excluded = false
    AND ec.trust_level <> 'public_unverified'
    AND ec.embedding IS NOT NULL
  ORDER BY ec.embedding <=> query_embedding::vector(1024)
  LIMIT GREATEST(match_count, 1);
$$;

CREATE OR REPLACE FUNCTION public.match_capabilities_for_requirement(
  query_embedding text,
  match_workspace_id uuid,
  match_count integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  source_document_id uuid,
  content text,
  category text,
  similarity double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ec.id,
    ec.source_document_id,
    ec.content,
    ec.category,
    1 - (ec.embedding <=> query_embedding::vector(1024)) AS similarity
  FROM public.evidence_chunks ec
  WHERE ec.workspace_id = match_workspace_id
    AND ec.is_excluded = false
    AND ec.trust_level <> 'public_unverified'
    AND ec.embedding IS NOT NULL
  ORDER BY ec.embedding <=> query_embedding::vector(1024)
  LIMIT GREATEST(match_count, 1);
$$;
