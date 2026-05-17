-- ============================================
-- Migration 025: Enforce same-workspace ownership on
-- requirement_capability_matches references
-- ============================================
--
-- Migration 024 added workspace-scoped RLS, but the INSERT/UPDATE policies
-- only verified that the caller belongs to the supplied workspace — they did
-- NOT verify that the referenced `requirement_id` and `evidence_chunk_id`
-- actually live in that same workspace. A workspace member could craft a
-- match row in their own workspace pointing at another tenant's
-- requirement or evidence chunk UUIDs (if known or guessed). Read-time RLS
-- on the joined tables would filter the foreign rows out, but defense in
-- depth: reject the write at the source.
--
-- This migration drops and recreates the INSERT and UPDATE policies with
-- additional EXISTS checks that confirm both referenced rows belong to the
-- same workspace as the match row being written.
--
-- NOTE: extracted_requirements has BOTH an `id` (uuid PK) and a
-- `requirement_id` (text, the human label like "REQ-001"). The outer-row
-- references here must be fully qualified to avoid column-name collision
-- inside the EXISTS subqueries.

DROP POLICY IF EXISTS rcm_workspace_insert ON public.requirement_capability_matches;
DROP POLICY IF EXISTS rcm_workspace_update ON public.requirement_capability_matches;

CREATE POLICY rcm_workspace_insert
  ON public.requirement_capability_matches
  FOR INSERT
  WITH CHECK (
    requirement_capability_matches.workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.extracted_requirements er
      WHERE er.id = requirement_capability_matches.requirement_id
        AND er.workspace_id = requirement_capability_matches.workspace_id
    )
    AND EXISTS (
      SELECT 1 FROM public.evidence_chunks ec
      WHERE ec.id = requirement_capability_matches.evidence_chunk_id
        AND ec.workspace_id = requirement_capability_matches.workspace_id
    )
  );

CREATE POLICY rcm_workspace_update
  ON public.requirement_capability_matches
  FOR UPDATE
  USING (
    requirement_capability_matches.workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    requirement_capability_matches.workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.extracted_requirements er
      WHERE er.id = requirement_capability_matches.requirement_id
        AND er.workspace_id = requirement_capability_matches.workspace_id
    )
    AND EXISTS (
      SELECT 1 FROM public.evidence_chunks ec
      WHERE ec.id = requirement_capability_matches.evidence_chunk_id
        AND ec.workspace_id = requirement_capability_matches.workspace_id
    )
  );
