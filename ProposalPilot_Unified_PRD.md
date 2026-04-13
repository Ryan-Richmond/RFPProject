# ProposalPilot

AI-native operating system for government proposal response

Unified Product Requirements Document

Version: 1.0
Status: Working build document
Last updated: April 12, 2026
Primary audience: founders, product, engineering, design

## 1. Product Thesis

ProposalPilot helps small-to-mid government contractors turn dense RFPs and fragmented internal knowledge into compliant, reviewable first-draft proposals in hours instead of days.

The wedge is not "AI writing." The wedge is autonomous execution of a high-friction, high-stakes workflow:

- parse a solicitation
- extract and structure requirements
- map those requirements to company evidence
- generate grounded draft content with citations
- route the draft through review
- verify compliance before export

This is the first wedge in a broader response-operations platform for regulated workflows, but the MVP is intentionally focused on government proposals.

## 2. Why This Fits The Competition

ProposalPilot aligns well with the Perplexity Billion Dollar Program because it matches the pattern the judges are likely looking for:

- Operator-led wedge: the product comes from real GovCon workflow knowledge, not generic automation theory.
- High-friction workflow: government proposals are document-heavy, compliance-sensitive, and expensive to execute manually.
- Clear ROI: reduce proposal hours, increase proposal volume, improve requirement coverage, and raise win probability.
- Perplexity-native architecture: the product depends on multi-model orchestration, document analysis, search, sub-agents, and sandboxed execution.
- Billion-dollar path: the initial wedge sits inside a federal plus state/local procurement market measured in trillions of dollars.

## 3. Vision

### Near-term vision

Be the default AI teammate for small and mid-sized government contractors that cannot afford a full proposal team.

### Long-term vision

Expand from GovCon proposal response into a broader response-operations layer for regulated, evidence-heavy workflows such as diligence questionnaires, certifications, partner onboarding, and adjacent public-sector response work.

The product should grow from a sharp wedge into a platform, not start as a vague platform.

## 4. Ideal Customer Profile

### Primary ICP

Small-to-mid government contractors with 1 to 200 employees that:

- respond to federal or state/local RFPs
- do not have large in-house proposal teams
- already have reusable past performance and corporate content, but cannot operationalize it quickly
- care deeply about compliance risk and turnaround speed

### Market segmentation

ProposalPilot should launch with both federal and state/local coverage, but the product and messaging should explicitly segment them rather than treating them as identical workflows.

- Federal segment: more structured solicitations, clearer instruction and evaluation mapping, heavier compliance rigor, stronger repeatability for automation.
- State/local segment: larger fragmented market, less standardized structure, more template variance, and strong upside if the product can simplify the chaos.

Product implication:

- Federal workflows are likely the cleanest starting point for structured automation.
- State/local support should be included from day one where possible, but the UX and analysis pipeline should acknowledge format variability instead of forcing federal assumptions everywhere.

### Primary users

- founder or owner-operator at a small GovCon firm
- proposal manager at a growing contractor
- operations or business development lead coordinating SMEs and deadlines

## 5. Core Problems

Customers face a repeating set of painful issues:

- RFPs are long, dense, and easy to misread.
- Requirements are scattered across instructions, SOW language, and attachments.
- Past proposals and resumes live in disconnected files and folders.
- Teams spend more time assembling and checking than differentiating.
- A single missed requirement can disqualify an otherwise strong proposal.
- Small firms often pass on winnable bids because the response cost is too high.

## 6. Product Principles

The product should follow these principles:

- Compliance over creativity. A correct and grounded draft beats a flashy one.
- Evidence-first outputs. Factual claims must trace to company materials or cited public sources.
- Human approval is mandatory. The system produces a strong first draft, not an auto-submit machine.
- Thin UI, thick orchestration. The interface stays simple while the agent workflows do the hard work.
- Constrained tools over broad agent sprawl. Each workflow gets a clear, structured set of actions.
- Auditability by default. Users must be able to see where content came from and what still needs review.
- Tenant isolation from day one. Proposal content is commercially sensitive.

## 7. Core User Journey

### Step 1: Set up company workspace

The user creates a workspace, adds company profile details, and uploads reusable materials:

- past proposals
- capability statements
- resumes and bios
- past performance references
- certifications and compliance artifacts

### Step 2: Upload an RFP

The user uploads a solicitation package in PDF, Word, or text format.

### Step 3: Analyze requirements

ProposalPilot extracts:

- all requirements
- submission instructions
- evaluation criteria
- ambiguities and open questions
- readiness signals based on existing company evidence

### Step 4: Build the draft

The system generates a structured draft aligned to the solicitation and grounded in the company knowledge base.

### Step 5: Review and resolve gaps

Users review cited draft sections, flagged weak spots, and unresolved requirements before approving changes.

### Step 6: Run compliance check and export

The system verifies coverage and format rules, then exports a submission-ready working document.

## 8. MVP Scope

The MVP must prove an end-to-end loop within the 8-week build window.

### In scope for MVP

- user authentication and tenant-isolated workspaces
- company knowledge base upload and indexing
- RFP upload and document extraction
- requirement extraction and categorization
- compliance matrix generation
- first-draft proposal generation with citations
- review workflow for flagged gaps and weak sections
- compliance checker with requirement-by-requirement status
- editable export to Word-compatible format
- basic workspace metrics such as proposals created, hours saved estimate, and requirement coverage
- basic outcome tracking: won, lost, pending

### Explicitly out of scope for MVP

- full opportunity discovery across procurement portals
- fully autonomous onboarding agent
- deep multi-user collaboration workflows
- automated success-fee invoicing and collections
- comprehensive support for all state and local procurement variants
- generalized "response OS" workflows outside GovCon

## 9. MVP Feature Requirements

## 9.1 Company Knowledge Base

Users need a way to upload and structure reusable evidence.

Requirements:

- upload Word, PDF, and text files
- segment content into reusable chunks
- tag content by agency, topic, contract type, NAICS, and recency where possible
- surface dedupe warnings for near-identical content
- store source references for every chunk
- allow users to exclude uploaded content from generation if they do not trust it

Success condition:

- the system can retrieve relevant company evidence for a new proposal without manual copy-paste.

## 9.2 RFP Analyzer

Users need a structured breakdown of the solicitation instead of a raw document dump.

Requirements:

- support large solicitation uploads
- extract technical, management, past performance, pricing, compliance, and submission-format requirements
- identify section references where possible
- map instructions to evaluation criteria when the structure supports it
- flag ambiguous, contradictory, or missing information for follow-up
- generate a readiness summary based on available company evidence

Success condition:

- the user can quickly understand what the bid requires and where likely gaps exist.

## 9.3 Proposal Drafter

Users need a grounded first draft that is aligned to the actual RFP structure.

Requirements:

- generate section-by-section content aligned to the solicitation
- pull supporting evidence from the knowledge base
- include citations or source references for factual claims
- annotate paragraphs or sections with mapped requirement IDs
- preserve a clear difference between drafted content and unresolved placeholders
- provide confidence levels for generated sections

Success condition:

- the user receives a reviewable first draft that is materially closer to submission than a blank document.

## 9.4 Review Workflow

Users need control, visibility, and approval before anything leaves the system.

Requirements:

- show flagged unresolved questions
- show weak or unsupported claims
- show missing requirement coverage
- allow users to accept, reject, or rewrite proposed content
- preserve an audit trail of generated content and edits

Success condition:

- the user trusts the system enough to use it in a real proposal cycle without feeling locked out of the process.

## 9.5 Compliance Checker

Users need a final pass that checks response quality against the extracted requirements.

Requirements:

- mark each requirement as addressed, partially addressed, weak, or unaddressed
- identify format issues such as missing headings, page-limit risk, or required attachments
- provide an overall compliance score and recommendation
- point users to the draft locations tied to each requirement

Success condition:

- the user can fix critical gaps before submission and reduce avoidable non-compliance risk.

## 9.6 Export

Users need a document they can continue editing and submit externally.

Requirements:

- export to a Word-compatible document
- preserve section hierarchy and requirement annotations
- include citation metadata in a way that can be hidden or removed before final submission

Success condition:

- the exported file is useful as a working proposal document, not just a text dump.

## 10. Agent Architecture

ProposalPilot is built around a small set of focused agent skills communicating through structured JSON.

### Core MVP skills

#### 1. Knowledge Base Indexer

- extracts uploaded company content
- segments and tags reusable evidence
- stores embeddings and metadata

#### 2. RFP Analyzer

- ingests solicitation documents
- extracts requirements and instructions
- builds the compliance matrix
- flags ambiguities and readiness gaps

#### 3. Proposal Drafter

- maps requirements to sections
- retrieves evidence from the knowledge base
- drafts grounded content with citations
- spawns section-level sub-agents for larger proposals

#### 4. Compliance Checker

- compares extracted requirements against the current draft
- scores requirement coverage
- flags weak responses and format issues

### Phase 2 skills

- Onboarding Agent
- Opportunity Scout

### Agent operating rules

- Every skill returns structured output, not loose prose.
- Large documents are chunked and analyzed in parallel.
- Search enrichment is optional and never blocks the core workflow.
- Generated content must remain grounded in customer evidence or cited public sources.
- High-risk decisions route back to a human review step.

## 11. Recommended Technical Stack

- Frontend: Next.js, React, Tailwind, shadcn/ui
- Backend and data: Supabase PostgreSQL, Auth, Storage, Row Level Security
- AI orchestration: Perplexity Computer and Agent API
- Reasoning and drafting: model routing through Perplexity Computer
- Search and enrichment: Perplexity Search API
- Embeddings and retrieval: Perplexity Embeddings API
- Document processing and isolated execution: Perplexity Sandbox API
- Hosting: Vercel for frontend, managed backend deployment as needed

## 12. Data Model Overview

Core data entities:

- workspace
- user
- company profile
- uploaded source document
- evidence chunk
- solicitation
- extracted requirement
- compliance matrix entry
- proposal draft
- proposal section
- citation
- compliance finding
- proposal outcome
- audit log

## 13. Monetization Strategy

The product should preserve the low-friction value proposition from the earlier ProposalPilot work while staying realistic for MVP execution.

### Launch business model

- low-friction entry tier for early adoption
- paid tier for higher usage and team needs
- success-fee model tied to reported wins
- basic outcome tracking in product

### Why keep the success-fee model

- it creates a stronger upside path than a pure seat-based SaaS model
- it signals confidence and alignment with customer outcomes
- it differentiates ProposalPilot from high-cost enterprise competitors
- it reduces adoption friction for small contractors that are skeptical of paying upfront for another tool

### Important note

The success-fee model should remain part of the core product thesis. However, automated billing and contract-value fee collection should not block the MVP. The product should prove workflow value first, then operationalize fee collection with legal review, caps, reporting flows, and customer-friendly enforcement mechanics.

## 14. Go-To-Market

### Initial GTM motion

- direct founder-led outreach to small and mid-sized contractors
- Downstreet Digital network and consulting relationships
- IT services contractors as the first focused beachhead
- pilot partner outreach through existing 22nd Century relationships
- PTAC and SBDC partnership exploration
- content marketing around public RFP teardowns and proposal workflow pain

### Why this motion works

- the users are reachable through niche channels
- the pain is acute and easy to demonstrate with before-and-after time savings
- the product can be shown on real public documents
- IT services firms often see repeat proposal patterns, which makes them a strong early learning loop

## 15. Success Metrics

The MVP should optimize for proof of workflow value, not vanity usage.

### Product metrics

- time from upload to usable first draft
- requirement extraction accuracy
- percentage of requirements mapped to draft content
- compliance issues caught before export
- percentage of drafted claims backed by citations

### Business metrics

- number of real proposals processed
- number of active pilot customers
- proposal volume increase per customer
- customer-reported hours saved
- number of opportunities the customer would have skipped without the product

## 16. Risks And Mitigations

### Hallucinated or unsupported claims

Mitigation:

- evidence-first generation
- mandatory citations
- explicit unresolved placeholders
- human approval gates

### Overly broad MVP

Mitigation:

- keep the build focused on the end-to-end proposal workflow
- defer scouting, full billing automation, and broad collaboration

### Platform dependency

Mitigation:

- keep workflows modular
- structure agent outputs cleanly
- avoid unnecessary reliance on fragile third-party connectors

### Sensitive customer data

Mitigation:

- tenant isolation
- audit logging
- permissioned workspace access
- careful handling of customer uploads and external enrichment steps

### Market confusion from too-broad positioning

Mitigation:

- message the product as GovCon-first
- keep the broader response-operations platform as a future path, not the headline

## 17. Open Product Decisions

These are the main decisions still worth resolving before implementation hardens:

- How should the product branch the workflow between federal and state/local once an RFP is uploaded?
- Should requirement annotations remain visible in the exported working draft, or be removable in a final export mode?
- What is the minimum review workflow that creates trust without slowing users down?
- What is the simplest fair mechanism for reporting wins and enforcing the success-fee model without adding heavy friction?
- Which IT services sub-segment should be the first pilot focus: federal civilian, defense, health, or state/local modernization work?

## 18. Build Sequence

The build should follow this order:

1. auth, workspaces, and source document storage
2. knowledge base ingestion and evidence chunking
3. RFP extraction and requirement matrix generation
4. draft generation with citations
5. review workflow and compliance checker
6. export and basic metrics
7. outcome tracking and early monetization hooks

## 19. Final Positioning Statement

ProposalPilot is the AI-native operating system for government proposal response. It helps small and mid-sized contractors turn dense solicitations and scattered company evidence into compliant, cited, reviewable first drafts faster than manual teams can. It starts with GovCon, proves ROI in one painful workflow, and expands from there.
