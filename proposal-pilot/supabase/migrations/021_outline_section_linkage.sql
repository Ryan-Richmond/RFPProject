-- ============================================
-- ProposalPilot Migration 021: Outline-to-Draft Linkage
-- Links generated draft sections back to approved outline sections so review,
-- export, and future assignment workflows share the same source of truth.
-- ============================================

ALTER TABLE public.proposal_sections
  ADD COLUMN IF NOT EXISTS outline_section_id uuid
  REFERENCES public.proposal_outline_sections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_proposal_sections_outline_section
  ON public.proposal_sections(outline_section_id);
