# End-to-End Product Experience Review (User Lens)

Date: 2026-04-27
Reviewer position: first-time proposal manager at a government contractor

## Executive verdict

ProposalPilot already delivers a strong end-to-end skeleton:
- secure workspace signup and team onboarding,
- profile-based opportunity discovery and scoring,
- guided RFP → analysis → draft → compliance → export workflow,
- evidence-backed drafting with revisions and compliance findings.

The architecture is solid and closer to a **serious operating system for proposals** than a point solution. To feel truly premium and category-leading, the biggest gap is less about missing core steps and more about reducing user ambiguity at each handoff (what to do next, what “good” looks like, why a score is trustworthy, and how to close loops after submission).

## Journey walkthrough (what works, what feels unclear)

### 1) Account setup and workspace creation

**What works well**
- Signup supports both creating a new workspace and joining via invite code in a single flow, reducing friction for net-new users and invited teammates.
- Invite validation/redeem logic appears integrated at signup time, which avoids separate post-signup coordination.

**Premium gaps**
- No visible onboarding checklist/wizard after signup to orient new users toward the critical setup sequence (Profile → Knowledge Base → Discovery).
- Password-only auth and limited reassurance UX around security/compliance posture may feel lightweight for enterprise/federal buyers.

### 2) Knowing which documents to upload

**What works well**
- Knowledge Base uploader explicitly names the high-value document types (capability statement, past proposals, resumes, certifications).
- Inline indexing states and error badges help users know whether content is usable.
- Evidence search is directly on the page and allows users to sanity-check retrieval quality.

**Premium gaps**
- Guidance is descriptive but not diagnostic: users are not told what is *missing* from their evidence base (e.g., “no healthcare references uploaded,” “no SOC 2 evidence”).
- No “document quality score” or freshness indicator to reassure users the evidence base is production-ready.

### 3) Finding relevant projects

**What works well**
- Opportunity pipeline includes discovery, set-aside filters, minimum score filters, and clear pursue/monitor/pass visual badges.
- Opportunity detail view includes score decomposition and qualitative intelligence (agency intel/incumbent/landscape fields in data model).
- One-click promotion from opportunity to proposal workflow is a strong conversion pattern.

**Premium gaps**
- Discovery controls are minimal for power users (no saved searches, no source mix controls, no watchlists/alerts).
- Limited transparency on *why* low scores happen and what actions can improve fit (e.g., profile fields or evidence to add).

### 4) Requesting draft generation

**What works well**
- RFP upload pipeline auto-creates solicitation + proposal + analysis in sequence, reducing manual orchestration.
- Drafting queue and proposal detail both support draft generation, improving discoverability.
- Draft risk panel (placeholders, low confidence, weak claims) is a high-value quality signal.

**Premium gaps**
- No draft strategy controls before generation (tone, technical depth, section priorities, page/word targets, evaluator emphasis).
- Regeneration granularity is section-level via edit/review, but there is no explicit “regenerate this section with constraints” UX.

### 5) Tracking process stages

**What works well**
- Reusable pipeline stepper (indexed → analyzed → drafted → compliant) appears in workspace and proposal detail.
- Workspace “priority next step” callout is a good orchestration affordance.
- Recent activity feed with timing and citations count helps build trust in automation.

**Premium gaps**
- Stage semantics are clear internally but not always tied to outcome readiness (e.g., “compliant” != “submission-ready”).
- No SLA/urgency overlays (time-to-deadline risk, blocking issues, critical path).

### 6) Reading draft and requesting edits

**What works well**
- Section-level review state (pending/accepted/rejected/edited), revision history, and citations provide auditability.
- Draft and compliance are linked by requirement mappings and per-section risk notices.
- In-place editing with save and status update supports human-in-the-loop workflows.

**Premium gaps**
- Missing collaborative review controls expected in premium products (assignees, comments, @mentions, approval gates, diff compare views).
- No explicit “red team / color team” review phases or role-based signoff workflows common in proposal operations.

### 7) Exporting and closing out

**What works well**
- Export supports clean and annotated DOCX modes, which maps to practical handoff needs.
- Outcome tracking (won/lost/no-bid + value + notes) closes the loop for learning.

**Premium gaps**
- No packaging workflow for final submission requirements (attachments checklist, forms, portal-specific packaging validation).
- No “final readiness score” gate at export time that blocks risky exports unless explicitly overridden.

## Value-add vs standard market baseline

## Clear differentiators already present

1. **Integrated lifecycle in one product**: discovery → scoring → drafting → compliance → export, not isolated tools.
2. **Evidence-grounded drafting UX** with surfaced citations.
3. **Operational telemetry** (agent operations feed, time-saved estimate) for trust and internal reporting.
4. **Outcome capture loop** that can support model/process learning.

## Where it is still near market baseline

1. Most workflow actions are still user-triggered, not proactive (limited copiloting).
2. Collaboration/review operations are simpler than mature proposal platforms.
3. Competitive intelligence explainability and confidence communication could be deeper.

## Highest-impact enhancements for market success

### P0 (must-have to feel premium quickly)

1. **Guided onboarding mission control**
   - Add first-run checklist with completion states and contextual CTAs.
   - Include a readiness meter that combines profile completeness, evidence coverage, and active opportunity hygiene.

2. **Evidence gap intelligence**
   - After each RFP analysis, auto-generate “missing evidence” requests tied to specific requirements.
   - Let users create tasks directly from gaps (owner + due date + upload target).

3. **Submission-readiness gate**
   - Introduce a single “Ready to Submit” score with blocking/non-blocking issues.
   - Require explicit override rationale for unresolved unaddressed/weak findings before export.

4. **Section regeneration with intent controls**
   - “Regenerate section” with controls for evaluator priority, tone, word budget, risk posture, and required citations.

### P1 (high leverage)

1. **Collaborative review system**
   - Inline comments, mentions, threaded discussions, role-based approval stages.
   - Color-team templates (pink/red/gold team) and stage gates.

2. **Opportunity intelligence explainability**
   - For each score dimension, show strongest supporting and opposing evidence.
   - Add what-to-improve recommendations linked to Profile and Knowledge Base updates.

3. **Deadline-aware orchestration**
   - Add due-date countdown risk levels and automatic prioritization.
   - Surface suggested weekly plan across open proposals.

### P2 (differentiation moat)

1. **Learning system from outcomes + edits**
   - Mine accepted/rejected edits and win/loss notes to generate playbooks and drafting style profiles.
2. **Submission package assistant**
   - Validate required forms/attachments and generate a final package checklist by agency/portal type.
3. **Executive portfolio view**
   - Forecasted pipeline value, win probability weighted revenue, team capacity, and proposal throughput health.

## Architecture-level observation

The current architecture is modular and conducive to iteration: clear page-level separations (workspace/opportunities/proposals/knowledge/compliance/profile/team), reusable workflow state helpers, and API endpoints aligned to workflow verbs. This supports rapid product evolution. The biggest next step is adding a stronger orchestration layer (checklists, gates, tasks, and role-based review governance) on top of the existing foundation.

## Bottom line

Yes, the system is functionally end-to-end today and has real value beyond basic drafting tools. To win in market as a premium platform, prioritize:
1) guided onboarding + readiness intelligence,
2) stronger collaborative review governance,
3) submission-readiness gates and packaging assistance,
4) deeper explainability with actionable next steps.

## Implementation Plan (Approved) — with Document Readiness System

### Placement strategy for recommended documents
Per approval, implement in both locations:
1. **Onboarding Mission Control**: show a “Recommended Proposal Library” checklist so first-time users know exactly what to upload.
2. **Knowledge Base page**: add a persistent “Recommended Documents” panel with status, freshness, owner, and quality score.

### Comprehensive recommended document set (federal proposal pack)

#### Tier 1 — Critical for draft quality (required)
1. Current Capability Statement (prime + core differentiators)
2. Past Performance Narratives (at least 3 recent, relevant)
3. Corporate Experience writeups by domain
4. Key Personnel resumes and bios (proposal-ready format)
5. Quality Management Plan / QMS overview
6. Cybersecurity posture docs (e.g., SSP summary, controls mapping)
7. Required certifications package (e.g., ISO/SOC/FedRAMP evidence as applicable)
8. NAICS and socioeconomic status evidence (8(a), SDVOSB, WOSB, HUBZone as applicable)
9. Contract vehicle list with scope fit (e.g., GWAC/BPA/IDIQ details)
10. Standard management/staffing approach library

#### Tier 2 — Strongly recommended for competitiveness
11. Transition-in and transition-out plan templates
12. Sample technical approach volumes from prior wins
13. Program management plan examples
14. Risk register examples and mitigation playbooks
15. Performance metrics/KPI framework examples
16. Customer references and CPARS-like performance summaries
17. Subcontractor/teaming partner capability summaries
18. Org chart templates and surge staffing plans
19. Pricing narrative assumptions (non-rate-sensitive)
20. Lessons learned archive from prior bids

#### Tier 3 — Differentiation and acceleration assets
21. Innovation/R&D case studies
22. Tooling/automation accelerators catalog
23. Security incident response and BCDR summaries
24. Accessibility/compliance artifacts (508, privacy, records handling)
25. Agency-specific past win themes and evaluator insights

### Per-document guidance fields to capture
For each recommended document type, track:
- Why it matters to proposal quality/compliance.
- Freshness target (e.g., 6/12/24 months).
- Owner and backup owner.
- Minimum metadata required (agency, domain, contract type, period of performance).
- Impact weight on draft quality score.

### Document Readiness Score (Yes — including LLM-assisted scanning)

#### How we achieve it
Use a hybrid scoring system combining deterministic checks + LLM classification at upload time.

1. **Deterministic checks (fast, reliable)**
   - Presence/absence by required category.
   - Recency/freshness against per-doc SLA.
   - Completeness of required metadata fields.
   - Document parseability + chunk/index success.

2. **LLM-assisted document scan (semantic quality checks)**
   - On upload, run an LLM pass to classify:
     - document type,
     - relevance to proposal use-cases,
     - evidence strength (specificity, measurability, credibility),
     - missing key sections (e.g., no outcomes, no customer context, no technical depth).
   - Generate structured tags and a quality rationale summary.

3. **Scoring model (v1)**
   - 40% coverage (required categories present)
   - 20% freshness
   - 20% metadata completeness
   - 20% semantic quality (LLM-derived rubric)

4. **Outputs in product**
   - Workspace readiness meter includes document readiness contribution.
   - Knowledge Base shows per-document and aggregate scores.
   - Proposal pages surface missing evidence gaps tied to requirements.

### Soft-gate behavior before draft generation (Yes)
- If critical Tier 1 documents are missing or stale, show a **non-blocking warning gate** with:
  - missing/stale items,
  - likely draft-quality impact,
  - “Upload recommended docs” CTA,
  - “Generate anyway” option with tracked override reason.

### Delivery sequence
1. Add recommended document model + UI in Onboarding and Knowledge Base.
2. Add deterministic readiness scoring pipeline.
3. Add LLM document scan and semantic quality rubric.
4. Add draft-generation soft gate and override capture.
5. Add evidence-gap task suggestions linked to proposal requirements.
