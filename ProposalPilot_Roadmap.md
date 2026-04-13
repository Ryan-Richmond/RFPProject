# ProposalPilot Roadmap

Build roadmap for the Perplexity Billion Dollar Program

Version: 1.0
Last updated: April 12, 2026

## 1. Roadmap Goal

Ship a credible MVP in 8 weeks that proves ProposalPilot can help small-to-mid government contractors turn uploaded RFPs and company documents into compliant, reviewable first-draft proposals faster than a manual workflow.

The roadmap is optimized for three outcomes:

- prove a real end-to-end workflow on live proposal material
- secure pilot usage with IT services contractors
- tell a strong competition story around an AI-native, Perplexity-powered company

## 2. Strategic Focus

### Launch wedge

- GovCon proposal response
- both federal and state/local supported
- explicit segmentation between federal and state/local workflows
- IT services contractors as the first focused customer segment

### MVP promise

Upload an RFP and supporting company documents, get:

- structured requirements
- a compliance matrix
- a grounded first draft with citations
- a review workflow for weak or missing sections
- a compliance check before export

### What this roadmap does not optimize for

- broad team collaboration
- fully automated onboarding
- opportunity scouting
- fully automated success-fee billing
- generalized response workflows outside GovCon

## 3. Definition Of MVP Success

By the end of week 8, the product should be able to:

- ingest federal and state/local RFPs in common document formats
- classify the solicitation as federal or state/local and branch the workflow accordingly
- index a company knowledge base with usable retrieval quality
- generate a grounded proposal draft with requirement mappings and citations
- run a compliance pass that surfaces addressed, weak, partial, and missing requirements
- export a working document users can continue editing
- support at least 3 live pilot accounts
- process at least 5 real proposal workflows end to end

## 4. Workstreams

The build should run across five workstreams in parallel.

### A. Product and UX

- define the workflow for workspace setup, RFP upload, analysis, drafting, review, compliance, and export
- design separate but connected federal and state/local user flows
- keep the interface thin and task-oriented

### B. AI and agent orchestration

- implement the knowledge base indexer
- implement the RFP analyzer
- implement the proposal drafter
- implement the compliance checker
- define structured JSON contracts between skills

### C. Platform and data

- workspace auth and tenant isolation
- file storage and document processing pipeline
- core database schema
- audit logging and outcome tracking

### D. Pilot and GTM

- recruit pilot partners in IT services
- line up 22nd Century conversations
- collect sample documents and permissioned test cases
- publish proof-of-work content around public RFP teardowns

### E. Competition narrative

- document the two-humans-plus-Computer operating model
- capture build velocity and product milestones weekly
- prepare the final demo, metrics, and founder narrative

## 5. Build Sequence By Epic

## Epic 1. Core platform foundation

Goal:

Create the minimum secure product shell for workspaces, documents, and workflow records.

Scope:

- auth and workspace creation
- tenant-isolated data model
- upload flows for RFPs and company documents
- job tracking for analysis and drafting runs
- audit log model

Done when:

- a user can create a workspace, upload documents, and see their processing status
- uploaded files and records are isolated by workspace

## Epic 2. Knowledge base ingestion

Goal:

Turn raw company documents into retrievable proposal evidence.

Scope:

- document extraction
- chunking and metadata tagging
- embeddings generation
- retrieval interface for drafting
- source reference storage

Done when:

- the system can retrieve relevant company evidence for a test requirement with acceptable accuracy

## Epic 3. RFP analysis engine

Goal:

Convert a solicitation into structured requirements and workflow-ready metadata.

Scope:

- document parsing and text normalization
- federal versus state/local classification
- requirement extraction and categorization
- instruction and evaluation mapping
- ambiguity detection
- readiness scoring against known evidence

Done when:

- an uploaded RFP yields a structured requirement set and a usable compliance matrix

## Epic 4. Grounded proposal drafting

Goal:

Generate a first draft that is aligned to the solicitation and grounded in evidence.

Scope:

- section planning
- evidence retrieval
- draft generation with citations
- requirement annotation
- unresolved placeholder handling
- confidence scoring

Done when:

- the user receives a sectioned draft with citations and visible mappings to requirements

## Epic 5. Review and compliance workflow

Goal:

Make the output trustworthy enough for real use.

Scope:

- review queue for weak, unsupported, or missing content
- requirement coverage status
- format and submission checks
- summary recommendation

Done when:

- the product highlights what is missing or weak before export

## Epic 6. Export and pilot instrumentation

Goal:

Make the product usable in the field and measurable in pilots.

Scope:

- Word-compatible export
- visible versus removable annotations mode
- basic metrics dashboard
- outcome tracking
- pilot feedback capture

Done when:

- a user can export a usable working document and the team can measure workflow performance

## 6. Eight-Week Delivery Plan

## Week 1: foundation and workflow definition

Primary outcome:

Lock the workflow, schema, and pilot target profile before build complexity grows.

Deliverables:

- final workflow map from upload to export
- core data model for workspaces, documents, requirements, drafts, citations, and outcomes
- federal versus state/local branching rules for MVP
- pilot outreach list focused on IT services firms
- repo scaffold and initial environments

Exit criteria:

- no open ambiguity about the MVP path
- the team knows what is intentionally out of scope

## Week 2: auth, storage, and ingestion pipeline

Primary outcome:

Users can create workspaces and upload documents into a real pipeline.

Deliverables:

- auth and tenant isolation
- document upload UI
- storage integration
- processing job model
- raw extraction pipeline for RFPs and company docs

Exit criteria:

- documents upload successfully and processing status is visible

## Week 3: knowledge base indexing

Primary outcome:

Company content becomes searchable evidence instead of static uploads.

Deliverables:

- chunking strategy
- metadata tagging
- embeddings pipeline
- evidence retrieval endpoint
- first retrieval quality checks using real sample documents

Exit criteria:

- the system can retrieve relevant support material for known test prompts

## Week 4: RFP analyzer v1

Primary outcome:

Uploaded solicitations produce a structured requirement set and compliance matrix.

Deliverables:

- federal versus state/local classifier
- requirement extraction and categorization
- instruction extraction
- evaluation mapping where available
- ambiguity flags
- readiness scoring stub

Exit criteria:

- one federal RFP and one state/local RFP can be analyzed end to end with usable output

## Week 5: proposal drafter v1

Primary outcome:

The system generates a grounded first draft from the compliance matrix and evidence base.

Deliverables:

- section planner
- retrieval-assisted generation flow
- citations and requirement annotations
- visible unresolved placeholders
- first draft UI

Exit criteria:

- a user can move from uploaded RFP to first draft inside one workspace

## Week 6: review and compliance loop

Primary outcome:

The draft becomes reviewable and safer to use.

Deliverables:

- review queue for weak and missing items
- requirement coverage statuses
- compliance summary
- draft-to-requirement traceability
- revision loop for accepted and rejected content

Exit criteria:

- users can see exactly what still needs work before export

## Week 7: export, metrics, and pilot hardening

Primary outcome:

The product is usable in real pilot workflows.

Deliverables:

- Word-compatible export
- annotation visibility controls
- basic metrics dashboard
- outcome tracking for won, lost, pending
- pilot onboarding playbook
- bug fixing and reliability pass

Exit criteria:

- at least one pilot user can run a real proposal workflow without founder hand-holding at every step

## Week 8: pilot proof, polish, and competition packaging

Primary outcome:

Turn the MVP into a credible competition submission and pilot-ready product.

Deliverables:

- 3 plus live pilot workspaces
- 5 plus real proposal runs or strong simulated runs with real documents
- final demo narrative
- quantified product metrics
- competition brief and product visuals
- roadmap for post-MVP expansion

Exit criteria:

- the team can show a complete workflow, explain the market, and defend the billion-dollar path

## 7. Pilot Plan

### Pilot objective

Prove that ProposalPilot reduces manual proposal effort and improves compliance confidence for IT services contractors.

### Ideal pilot profile

- small or mid-sized GovCon IT services firm
- active pipeline of federal or state/local bids
- existing proposal archive and past performance content
- willing to share a limited number of documents under clear confidentiality rules

### Pilot targets

- 22nd Century and adjacent IT services relationships
- 3 to 5 active pilot organizations
- 1 to 2 users per organization in the first wave

### Pilot success metrics

- time saved per proposal
- number of requirements captured automatically
- retrieval quality of past performance material
- reduction in blank-page drafting effort
- user trust in citations and compliance findings

## 8. Ownership Model

The roadmap assumes a two-humans-plus-Computer operating model.

### Human 1

- product direction
- customer discovery
- pilot recruiting
- competition narrative
- final product decisions

### Human 2

- sales and pilot management
- content and GTM execution
- customer support and feedback capture
- billing and operations setup

### Perplexity Computer

- document analysis workflows
- structured drafting workflows
- support for debugging, test generation, and analytics
- content production for GTM and competition assets

## 9. Technical Milestones

These are the minimum technical checkpoints that matter most.

- M1: secure workspace and upload pipeline live
- M2: evidence retrieval working on real company documents
- M3: RFP analyzer produces usable requirement JSON
- M4: first draft generated with citations
- M5: compliance checker flags missing and weak items
- M6: working export and pilot metrics in product

## 10. Key Dependencies

- access to representative RFPs from both federal and state/local sources
- access to real company proposal materials for retrieval testing
- clear legal position on data handling and pilot confidentiality
- enough pilot feedback to validate workflow trust
- enough time reserved in weeks 7 and 8 for polish instead of net-new scope

## 11. Risks To The Roadmap

### Risk: trying to support all procurement formats equally

Response:

- support both federal and state/local, but optimize the engine around segmented logic
- prioritize the most common and structured cases first

### Risk: retrieval quality is too weak for trustworthy drafting

Response:

- test retrieval quality by week 3 on real documents
- simplify chunking and tagging before adding more drafting complexity

### Risk: success-fee complexity distracts from shipping the product

Response:

- keep the model in the story and product scaffolding
- postpone full automation of billing and enforcement

### Risk: pilots require too much manual support

Response:

- choose a narrow pilot segment
- create a lightweight onboarding playbook
- use founder-led onboarding in the first wave

## 12. Post-MVP Roadmap

After the 8-week MVP, the next 90 days should focus on:

- deeper state/local handling for top target jurisdictions
- improved review workflow and collaboration
- success-fee operations and reporting flows
- win verification via public data where feasible
- early bid or no-bid support
- stronger analytics from proposal outcomes

## 13. Immediate Next Actions

The next concrete actions are:

1. choose the first IT services pilot sub-segment
2. lock the federal versus state/local workflow branch rules
3. define the core JSON schemas for documents, requirements, citations, and findings
4. start pilot outreach with a short design-partner pitch
5. begin week 1 implementation against the foundation epic
