# Sprint 1 — Capability Evidence Scoring (2 weeks)

## Objective
Upgrade scoring from metadata-only match to evidence-backed capability fit.

## Epic 1.1 — Opportunity Requirement Extraction

### Story 1.1.1 — Requirement extraction for top-K opportunities
**Description**
Extract structured requirements from opportunity payload + description documents for AI candidate set.

**Tasks**
- Define extraction schema (required capabilities, staffing, certifications, delivery constraints).
- Build parser workflow using Agent API.
- Persist extracted artifacts for re-use and traceability.

**Acceptance Criteria**
- Top-K opportunities include structured extracted requirements.
- Extraction output passes schema validation.
- Re-run is idempotent for unchanged source content.

### Story 1.1.2 — Capability taxonomy alignment
**Description**
Normalize extracted requirements and client capability terms to a shared taxonomy.

**Tasks**
- Create capability dictionary and synonym resolver.
- Normalize `client_profiles.core_capabilities` and extracted requirements.
- Add fallback semantic matching for unmapped terms.

**Acceptance Criteria**
- ≥90% of extracted capability terms map to canonical taxonomy or semantic fallback.
- Taxonomy supports deterministic and AI scoring paths.

## Epic 1.2 — Evidence-backed Scoring

### Story 1.2.1 — Evidence chunk retrieval and ranking
**Description**
Retrieve relevant company evidence chunks to support capability claims.

**Tasks**
- Query evidence chunks by taxonomy match + semantic similarity.
- Rank by relevance, recency, and agency/domain proximity.
- Return top evidence set for each requirement.

**Acceptance Criteria**
- Each top-ranked opportunity has at least 3 ranked evidence references when available.
- Evidence results include provenance (document id + snippet offsets).

### Story 1.2.2 — AI capability match score + rationale
**Description**
Populate AI score columns for capability fit and rationale.

**Tasks**
- Implement `ai_capability_match_score` generation.
- Generate rationale and citations for explainability.
- Persist AI scoring metadata with timestamp/model reference.

**Acceptance Criteria**
- AI score and rationale are saved for all enriched opportunities.
- Rationale includes clear positive/negative factors and evidence citations.

## Deliverables
- Requirement extraction pipeline.
- Capability taxonomy + matching utilities.
- AI capability fit scoring with citations.

## Exit Criteria
- Product can answer: “Why is this a good fit for us?” with evidence-backed rationale.
