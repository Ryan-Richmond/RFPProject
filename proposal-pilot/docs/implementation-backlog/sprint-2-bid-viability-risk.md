# Sprint 2 — Bid Viability & Risk Scoring (2 weeks)

## Objective
Reduce false positives by scoring execution feasibility and bid risk, not just relevance.

## Epic 2.1 — Readiness and Size-Fit

### Story 2.1.1 — Bid readiness scoring
**Description**
Model whether the team can realistically submit a strong proposal before deadline.

**Tasks**
- Build readiness heuristic using deadline, complexity, and profile completeness.
- Create risk bands (low/medium/high) with rationale.
- Add readiness score + reason to score output.

**Acceptance Criteria**
- Every enriched opportunity has readiness score and reason.
- Opportunities with very short timelines are visibly risk-flagged.

### Story 2.1.2 — AI size-fit inference
**Description**
Infer contract magnitude/effort from available text when SAM value data is absent.

**Tasks**
- Prompt Agent API to estimate range and confidence.
- Score fit against workspace size profile (revenue/employee tier).
- Persist estimate confidence and source evidence.

**Acceptance Criteria**
- `ai_size_fit_score` is populated for enriched opportunities.
- Each estimate includes confidence and explanation.

## Epic 2.2 — Competition and Delivery Risk

### Story 2.2.1 — Competition intensity scoring
**Description**
Estimate competitive pressure and incumbent strength.

**Tasks**
- Pull agency/contract intel and incumbent signals.
- Score competition level with high/med/low confidence.
- Save `ai_competition_level_score` and context fields.

**Acceptance Criteria**
- Competition score + incumbent context are available for enriched opportunities.
- Low-confidence estimates are clearly tagged.

### Story 2.2.2 — Delivery complexity indicator
**Description**
Capture complexity signals that increase execution risk.

**Tasks**
- Detect multi-site delivery, specialized certifications, aggressive milestones.
- Add composite complexity flag used in recommendation rationale.

**Acceptance Criteria**
- Complexity indicator is included in top-level recommendation explanation.
- Indicator contributes to recommendation downgrade when risk is high.

## Deliverables
- Readiness, size-fit, competition, and complexity risk dimensions.
- Updated recommendation policy with risk-aware adjustments.

## Exit Criteria
- Product can justify “pass” decisions due to execution risk even for relevant opportunities.
