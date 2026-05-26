# Onboarding Confidence Ladder Pre-Launch Plan

## Goal

Prove that the V1 onboarding ladder is trustworthy before launch: public baseline research helps users get started, but only verified profile data, uploaded evidence, and SAM-verified entity records can support proposal drafting and citations.

## Must Complete

1. Apply Supabase migration `026_onboarding_confidence_ladder.sql` in the launch database.
   - Verify `public_company_research` exists with RLS enabled.
   - Verify `source_documents.ingestion_mode` exists.
   - Verify `evidence_chunks.artifact_type`, `artifact_title`, `artifact_confidence`, and `trust_level` exist.
   - Verify `match_evidence_chunks` and `match_capabilities_for_requirement` exclude `public_unverified`.

2. Run automated launch checks.
   - `npm run test:launch`
   - `npm run typecheck`
   - `npm run lint`
   - `npm run build`

3. Validate live SAM.gov entity import.
   - Use one known UEI/CAGE in a non-production workspace.
   - Confirm the imported record is stored with `source_type = sam_entity` and `trust_level = sam_verified`.
   - Confirm SAM-derived profile fields can be applied without creating evidence chunks.

4. Validate live public research.
   - Use one known company in a non-production workspace.
   - Confirm research writes to `public_company_research` with `trust_level = public_unverified`.
   - Confirm citations are retained.
   - Confirm public research does not create `evidence_chunks`.

5. Validate authenticated UX with seeded data.
   - Workspace first run shows one clear mission-control action when `NEXT_PUBLIC_ONBOARDING_LADDER_ENABLED=true`.
   - Profile can run public research/SAM import and apply suggestions.
   - Knowledge Base shows Minimum to start, High impact next, and Advanced library readiness tiers.
   - A legacy proposal upload produces 5+ artifact-backed readiness items.
   - Opportunity detail shows the commit modal before proposal creation.
   - Proposal detail shows the RFP-specific evidence gap panel when requirements are red/yellow.

## Rollback

Disable `NEXT_PUBLIC_ONBOARDING_LADDER_ENABLED` to restore the old Workspace onboarding surface. The migration is additive except for retrieval RPC changes that intentionally enforce the evidence firewall; do not roll those back unless legal/compliance signs off on allowing public unverified findings into drafting retrieval.

## Launch Owner Notes

Public/Sonar research may inform recommendations and onboarding copy. It must not become draft-citable evidence until a user explicitly applies or verifies it through profile data, uploaded documents, or SAM-verified entity import.

## Current Verification Status

Completed on May 26, 2026:

- Applied `026_onboarding_confidence_ladder.sql` to the configured Supabase project.
- Passed `npm run test`, `npm run lint`, and `npm run build`.
- Verified the SAM.gov Entity Management API with the configured `SAM_GOV_API_KEY` using a live entity-name lookup.
- Verified the configured development AI route can return structured JSON for public-baseline style company research.

Still required before launch:

- Run the authenticated seeded-workspace UX walkthrough with a real pilot account and `NEXT_PUBLIC_ONBOARDING_LADDER_ENABLED=true`.
- Confirm live, persisted public research and SAM import records in a non-production workspace, including that neither path creates draft-citable public-unverified evidence chunks.
