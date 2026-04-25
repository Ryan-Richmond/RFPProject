# Sprint 3 — Explainability & Trust UX (2 weeks)

## Objective
Make recommendations transparent, defensible, and easy to validate by users.

## Epic 3.1 — Recommendation Explainability

### Story 3.1.1 — Unified score breakdown UI
**Description**
Expose deterministic + AI score components in one clear breakdown panel.

**Tasks**
- Add UI components for each score dimension.
- Show disqualification reason prominently.
- Include confidence and freshness indicators.

**Acceptance Criteria**
- Users can view full score breakdown in opportunity detail.
- Disqualified opportunities show reason without extra clicks.

### Story 3.1.2 — Evidence citations panel
**Description**
Attach evidence links/snippets directly to rationale statements.

**Tasks**
- Render AI citations and evidence snippets.
- Support source open-in-new-tab flow.
- Add empty-state handling when citations unavailable.

**Acceptance Criteria**
- Every enriched rationale displays available citations.
- Users can navigate from rationale to source in one click.

## Epic 3.2 — Change Visibility + Human Overrides

### Story 3.2.1 — “What changed” timeline
**Description**
Show score deltas and causes across scoring runs.

**Tasks**
- Store score snapshots and change reasons.
- Display diff timeline for opportunity scores.

**Acceptance Criteria**
- Users can see previous score and current score with cause labels.
- Timeline supports at least last 5 score updates.

### Story 3.2.2 — Manual recommendation override
**Description**
Allow users to override recommendation with a reason.

**Tasks**
- Add override action in UI.
- Persist override reason + timestamp + actor.
- Reflect override in list sorting/filtering.

**Acceptance Criteria**
- Override appears immediately in UI.
- Original score remains auditable.

## Deliverables
- Explainability panel.
- Citation explorer.
- Score-change timeline.
- Manual override workflow.

## Exit Criteria
- User can answer “why this recommendation?” and “what changed?” without leaving the app.
