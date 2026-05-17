-- ============================================
-- Migration 024: Requirement → Capability Matching
-- Phase 1 of the Requirements Traceability Matrix work.
-- ============================================
--
-- Adds the data model needed to map each extracted RFP requirement to the
-- evidence chunks (company capabilities) that satisfy it. Mapping is produced
-- by:
--   1. Embedding the requirement text with the same model used for evidence
--      chunks (gemini-embedding-001 @ 1024 dims).
--   2. Running pgvector cosine similarity to retrieve the top-K candidate
--      chunks (RPC `match_capabilities_for_requirement`).
--   3. A single LLM justification pass that classifies each candidate as
--      strong / partial / weak / none and writes the result to
--      `requirement_capability_matches`.
--
-- The join table is the source of truth. `extracted_requirements.matched_evidence_ids`
-- is kept as a denormalized cache of confirmed match IDs for fast list reads.

-- ============================================
-- 1. Add embedding column to extracted_requirements
-- ============================================
ALTER TABLE public.extracted_requirements
  ADD COLUMN IF NOT EXISTS embedding vector(1024);

CREATE INDEX IF NOT EXISTS idx_extracted_requirements_embedding
  ON public.extracted_requirements
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- 2. Join table: requirement ↔ evidence chunk
-- ============================================
CREATE TABLE IF NOT EXISTS public.requirement_capability_matches (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES public.extracted_requirements(id) ON DELETE CASCADE,
  evidence_chunk_id uuid NOT NULL REFERENCES public.evidence_chunks(id) ON DELETE CASCADE,
  similarity_score double precision NOT NULL,
  llm_confidence text CHECK (llm_confidence IN ('strong', 'partial', 'weak', 'none')),
  llm_justification text,
  status text NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('suggested', 'confirmed', 'overridden', 'rejected')),
  overridden_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requirement_id, evidence_chunk_id)
);

CREATE INDEX IF NOT EXISTS idx_rcm_workspace
  ON public.requirement_capability_matches (workspace_id);

CREATE INDEX IF NOT EXISTS idx_rcm_requirement
  ON public.requirement_capability_matches (requirement_id);

CREATE INDEX IF NOT EXISTS idx_rcm_evidence
  ON public.requirement_capability_matches (evidence_chunk_id);

ALTER TABLE public.requirement_capability_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY rcm_workspace_select
  ON public.requirement_capability_matches
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY rcm_workspace_insert
  ON public.requirement_capability_matches
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY rcm_workspace_update
  ON public.requirement_capability_matches
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY rcm_workspace_delete
  ON public.requirement_capability_matches
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- 3. RPC: top-K capability matches for a requirement embedding
-- ============================================
DROP FUNCTION IF EXISTS public.match_capabilities_for_requirement(text, uuid, integer);

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
    AND ec.embedding IS NOT NULL
  ORDER BY ec.embedding <=> query_embedding::vector(1024)
  LIMIT GREATEST(match_count, 1);
$$;

GRANT EXECUTE ON FUNCTION public.match_capabilities_for_requirement(text, uuid, integer) TO authenticated;

-- ============================================
-- 4. Trigger to keep updated_at fresh
-- ============================================
CREATE OR REPLACE FUNCTION public.touch_rcm_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rcm_updated_at ON public.requirement_capability_matches;

CREATE TRIGGER trg_rcm_updated_at
  BEFORE UPDATE ON public.requirement_capability_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_rcm_updated_at();
