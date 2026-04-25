# Sprint 0 — Foundation & Observability (1 week)

## Objective
Create operational visibility and data quality guardrails for SAM ingestion/scoring before deeper AI enrichment.

## Epic 0.1 — Telemetry and Pipeline Health

### Story 0.1.1 — Discovery + scoring telemetry
**Description**
Instrument discovery and scoring jobs to capture runtime, throughput, and failure metadata.

**Tasks**
- Add structured logging fields for discovery and scoring lifecycle events.
- Persist run metrics (start/end duration, rows read/written, failures, retries).
- Expose run status endpoint for dashboard polling.

**Acceptance Criteria**
- Every run records start/end timestamps and terminal status.
- Failures include actionable reason and step name.
- Dashboard can show last successful run and duration.

### Story 0.1.2 — Freshness SLA alerts
**Description**
Detect stale ingestion/scoring and alert operations.

**Tasks**
- Create daily freshness monitor job.
- Add threshold config (e.g., no successful ingest in 24h).
- Notify via configured channel.

**Acceptance Criteria**
- Alert triggers when ingest/scoring freshness threshold is breached.
- Alert includes run id, failed stage, and suggested runbook link.

## Epic 0.2 — Score Distribution Monitoring

### Story 0.2.1 — Distribution snapshot pipeline
**Description**
Store score and recommendation distribution snapshots per workspace daily.

**Tasks**
- Build aggregation query for pursue/monitor/pass counts.
- Persist snapshots in a daily metrics table.
- Add drift comparison vs trailing 14-day baseline.

**Acceptance Criteria**
- Daily snapshot exists for each active workspace.
- Drift monitor flags abnormal spikes/drops in categories.

### Story 0.2.2 — Data quality checks
**Description**
Validate key SAM fields required by deterministic scorer.

**Tasks**
- Add checks for NAICS, response deadline, and set-aside normalization.
- Log invalid/missing records to quality report.

**Acceptance Criteria**
- Quality report generated per run.
- Invalid rows do not break the scoring pipeline.

## Deliverables
- Telemetry schema additions (if needed).
- Monitoring jobs + alert thresholds.
- Runbook draft for triaging ingest/scoring incidents.

## Exit Criteria
- Team can answer: “Is ingestion healthy right now?” in under 60 seconds.
- On-call gets alerts for stale data and abnormal score drift.
