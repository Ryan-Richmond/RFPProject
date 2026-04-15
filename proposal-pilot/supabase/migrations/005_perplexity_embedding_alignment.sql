-- ============================================
-- ProposalPilot Migration 005: Perplexity Embedding Alignment
-- Aligns pgvector storage with Perplexity contextualized embeddings
-- and adds duplicate guards for discovered opportunities.
-- ============================================

-- ============================================
-- 1. Evidence chunk embeddings: 1024 dims for pplx-embed-context-v1-0.6b
-- ============================================
DROP INDEX IF EXISTS public.idx_evidence_chunks_embedding;

ALTER TABLE public.evidence_chunks
  ALTER COLUMN embedding TYPE vector(1024)
  USING NULL::vector(1024);

CREATE INDEX IF NOT EXISTS idx_evidence_chunks_embedding
  ON public.evidence_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- 2. Vector search RPC used by the knowledge-base service
-- ============================================
DROP FUNCTION IF EXISTS public.match_evidence_chunks(text, uuid, integer);
DROP FUNCTION IF EXISTS public.match_evidence_chunks(vector, uuid, integer);

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
    AND ec.embedding IS NOT NULL
  ORDER BY ec.embedding <=> query_embedding::vector(1024)
  LIMIT GREATEST(match_count, 1);
$$;

GRANT EXECUTE ON FUNCTION public.match_evidence_chunks(text, uuid, integer) TO authenticated;

-- ============================================
-- 3. Clean up existing duplicate opportunities before adding guards
-- ============================================
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY workspace_id, source, solicitation_number
      ORDER BY created_at ASC, id ASC
    ) AS row_num
  FROM public.opportunities
  WHERE solicitation_number IS NOT NULL
)
DELETE FROM public.opportunities o
USING ranked
WHERE o.id = ranked.id
  AND ranked.row_num > 1;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY workspace_id, source, source_url
      ORDER BY created_at ASC, id ASC
    ) AS row_num
  FROM public.opportunities
  WHERE source_url IS NOT NULL
)
DELETE FROM public.opportunities o
USING ranked
WHERE o.id = ranked.id
  AND ranked.row_num > 1;

-- ============================================
-- 4. Duplicate guards for opportunity discovery
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_unique_solicitation
  ON public.opportunities (workspace_id, source, solicitation_number)
  WHERE solicitation_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_unique_source_url
  ON public.opportunities (workspace_id, source, source_url)
  WHERE source_url IS NOT NULL;
