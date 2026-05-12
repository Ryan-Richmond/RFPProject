# Proposal Production Strengthening Plan

## Objective

Strengthen ProposalPilot around the proposal-production workflow that matters most to GovCon teams:

> Solicitation shred → annotated outline → assigned sections → evidence-grounded draft → coherence/red-team review → exportable compliance package.

The implementation should preserve ProposalPilot's current evidence-first architecture while closing the most visible gaps against Bidara, Loopio, and GovDash.

## Guiding principles

1. **Source traceability is the moat.** Every generated outline section, draft paragraph, compliance finding, and export artifact should point back to solicitation requirements and company evidence.
2. **Human control before AI drafting.** Users should approve the outline before long-form drafting so ProposalPilot follows the RFP instead of a fixed template.
3. **Proposal artifacts beat chat outputs.** Exported Word documents, compliance packages, issue lists, and evidence appendices should be treated as first-class deliverables.
4. **Workflow first, integrations second.** Section ownership, review states, due dates, and action items should precede deep Word/SharePoint/CRM integrations.

## Current foundation

ProposalPilot already has the core objects required for this workflow:

- `extracted_requirements` with requirement ID, category, section reference, evaluation weight, readiness score, and matched evidence IDs.
- `compliance_matrix_entries` with instruction/evaluation references and mapped requirement IDs.
- `proposal_drafts` and `proposal_sections` with section content, order, mappings, placeholders, confidence, word count, and review status.
- `citations` that connect proposal sections to evidence chunks.
- `compliance_findings` for requirement-level coverage review.
- `proposal_section_revisions` for auditability of AI/user/system changes.

## Phase 1 — Review-ready proposal package

### Deliverables

- Annotated `.docx` export with section metadata, requirement mappings, placeholders, and evidence trace.
- Clean `.docx` export with inline AI annotations removed.
- Compliance package export with requirement status, findings, open placeholders, low-confidence sections, and citation appendix.

### Acceptance criteria

- Users can download a reviewer-ready artifact from an existing draft.
- Export includes enough traceability for a proposal manager to review open gaps without returning to the app.
- Export does not remove placeholders in annotated mode.

## Phase 2 — Solicitation-driven annotated outline

### Deliverables

- `proposal_outline_sections` table for the approved proposal structure.
- Outline generation service that turns extracted requirements and compliance matrix entries into editable outline sections.
- Draft generation that uses outline sections instead of hard-coded sections when an outline exists.
- Proposal detail API returns outline sections alongside requirements, compliance matrix, sections, revisions, and findings.

### Acceptance criteria

- Every analyzed proposal can produce an outline before drafting.
- Outline sections carry mapped requirement IDs, source references, instructions, evaluation weight, page/word targets, owner/reviewer placeholders, and status.
- Draft generation uses approved outline sections in section order.

## Phase 3 — Team execution

### Deliverables

- Section owners, reviewers, due dates, and workflow statuses.
- Proposal board grouped by section status.
- Action items generated from placeholders, compliance findings, and red-team findings.
- Comments anchored to sections and, later, selected text spans.

### Acceptance criteria

- Every open gap has an owner or can be assigned.
- Proposal managers can identify blocked/overdue sections in one view.
- Approved sections can be protected from accidental AI overwrite unless explicitly regenerated.

## Phase 4 — Red-team coherence checks

### Deliverables

- `proposal_quality_findings` table for contradiction, repetition, unsupported-claim, win-theme, style, stale-evidence, and page-limit findings.
- AI coherence check across all proposal sections.
- Findings linked to affected sections, requirements, and citations.

### Acceptance criteria

- ProposalPilot identifies contradictions across sections and flags unsupported claims.
- Findings can be resolved, accepted as risk, or assigned.
- Coherence findings appear in the export package.

## Phase 5 — Compliance shreds

### Deliverables

- `solicitation_shreds` table with source document, page/character offsets, shred type, source text, requirement ID, priority, and evaluation weight.
- Links between shreds, outline sections, proposal responses, and compliance findings.
- Split-screen source → obligation → response review UI.

### Acceptance criteria

- Users can audit each obligation from source text to draft response.
- Compliance package can be downloaded with shred mappings.
- Requirement extraction updates preserve previous human edits where possible.

## Phase 6 — Structured past performance

### Deliverables

- `past_performance_records` as curated reusable contract assets.
- Evidence links from records to source chunks.
- Per-proposal past-performance recommendations and user selections.
- Past-performance drafting constrained to selected records.

### Acceptance criteria

- Users can curate extracted contract records before reuse.
- ProposalPilot recommends relevant records by agency, NAICS/PSC, scope, recency, value, and role.
- Past-performance sections cite approved records and identify missing customer/contact data.

## First executable slice

This implementation starts with Phase 2 and strengthens existing Phase 1 support:

1. Add `proposal_outline_sections` and supporting indexes/RLS.
2. Add an outline generation service.
3. Add `/api/proposals/[id]/outline` for GET/POST generation and PATCH updates.
4. Return outline sections from proposal detail API.
5. Make draft generation outline-driven when outline sections exist.
6. Add outline metadata to annotated export.

