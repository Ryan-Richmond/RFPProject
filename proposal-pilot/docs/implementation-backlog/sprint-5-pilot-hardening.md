# Sprint 5 — Pilot Hardening & Reliability (2 weeks)

## Objective
Ensure system reliability, multi-tenant safety, and operational readiness before pilot rollout.

## Epic 5.1 — Reliability and Recovery

### Story 5.1.1 — Retry and dead-letter handling
**Description**
Improve resilience for ingestion, extraction, and scoring failures.

**Tasks**
- Add retries with exponential backoff for transient external failures.
- Route hard failures to dead-letter queue/report.
- Add replay command for failed records.

**Acceptance Criteria**
- Transient failures auto-retry up to configured limit.
- Dead-letter entries include enough context for replay.

### Story 5.1.2 — Backfill and replay workflows
**Description**
Support safe historical reprocessing after schema/model updates.

**Tasks**
- Build controlled backfill job for selected date windows/workspaces.
- Add throttling controls and progress checkpoints.

**Acceptance Criteria**
- Backfill can resume after interruption.
- Backfill does not degrade foreground API latency beyond SLA.

## Epic 5.2 — Security and Tenant Isolation

### Story 5.2.1 — Multi-tenant score isolation tests
**Description**
Prove no cross-workspace leakage in scoring and retrieval paths.

**Tasks**
- Add integration tests for RLS-protected score operations.
- Validate workspace-scoped query filters in APIs.

**Acceptance Criteria**
- Tests fail on cross-workspace read/write attempts.
- No privileged bypass path exists in normal runtime.

### Story 5.2.2 — Pilot operations runbook
**Description**
Document incident handling and daily health checks.

**Tasks**
- Create runbook sections: monitoring, escalation, rollback, replay.
- Assign owners and escalation contacts.

**Acceptance Criteria**
- On-call can execute runbook without tribal knowledge.
- Runbook reviewed and signed off by eng + product.

## Deliverables
- Reliability/retry framework.
- Backfill/replay capability.
- Isolation test suite.
- Pilot runbook.

## Exit Criteria
- Team can handle failures safely without impacting pilot users.
