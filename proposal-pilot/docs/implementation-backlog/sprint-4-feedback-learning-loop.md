# Sprint 4 — Feedback & Learning Loop (2 weeks)

## Objective
Use user behavior to improve ranking quality and recommendation precision over time.

## Epic 4.1 — Event Instrumentation

### Story 4.1.1 — User interaction event model
**Description**
Track critical user actions on opportunities and recommendations.

**Tasks**
- Define events: viewed, saved, dismissed, pursued, promoted, overridden.
- Include metadata (workspace, opportunity, previous recommendation, reason tags).
- Add ingestion endpoint and storage table.

**Acceptance Criteria**
- All events are reliably recorded with timestamps and actor ids.
- Event schema supports downstream analytics queries.

### Story 4.1.2 — Recommendation quality dashboard
**Description**
Visualize conversion and acceptance metrics by workspace and time window.

**Tasks**
- Build dashboard queries for top funnel metrics.
- Add quality slices by agency, NAICS, set-aside, recommendation bucket.

**Acceptance Criteria**
- Dashboard shows acceptance/rejection rates for pursue/monitor/pass.
- Metrics refresh at least daily.

## Epic 4.2 — Calibration and Exploration

### Story 4.2.1 — Weight and threshold tuning job
**Description**
Periodically tune deterministic weights and decision thresholds from feedback data.

**Tasks**
- Build calibration job with backtesting report.
- Compare old/new precision proxy before applying updates.
- Store model config versions.

**Acceptance Criteria**
- Tuning run produces a report with expected impact.
- Config update is versioned and reversible.

### Story 4.2.2 — Exploration policy for AI enrichment
**Description**
Reserve a subset of near-threshold opportunities for AI analysis to avoid blind spots.

**Tasks**
- Implement top-K + exploration sampler.
- Track exploration outcomes separately.

**Acceptance Criteria**
- Exploration pool percentage is configurable.
- Outcome data available for future tuning.

## Deliverables
- Interaction event pipeline.
- Quality analytics dashboard.
- Calibration job with versioned scoring configs.
- Exploration policy implementation.

## Exit Criteria
- Recommendation quality improves measurably over baseline for at least one pilot workspace.
