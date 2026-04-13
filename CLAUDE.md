# ProposalPilot

AI-native operating system for government proposal response. Helps small-to-mid government contractors (1-200 employees) turn dense RFPs and fragmented company evidence into compliant, reviewable first-draft proposals in hours instead of days.

## Project Context

- **Product**: ProposalPilot — upload a government RFP + company docs, get a structured first-draft proposal
- **Competition**: Perplexity Billion Dollar Program (8-week build window)
- **Operating Model**: 2 humans + Perplexity Computer (AI-native company)
- **Founders**: Rodge (engineering, product) + Sam Nelson (marketing, BD) — Downstreet Digital
- **Launch wedge**: GovCon proposal response (federal + state/local)
- **First customer segment**: IT services contractors

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js + React + Tailwind CSS + shadcn/ui | Thin UI, task-oriented |
| Backend / Auth / Storage | Supabase (PostgreSQL + Auth + RLS + File Storage) | Tenant isolation from day 1 |
| AI — Drafting & Analysis | Anthropic API (Claude) | Direct API calls for requirement extraction, proposal drafting, compliance checking |
| AI — Search & Research | Perplexity Sonar API | Agency intelligence, incumbent research, grounded citations |
| Embeddings / RAG | Supabase pgvector + OpenAI Embeddings API | Vector search over company knowledge base |
| Document Processing | pdf-parse + mammoth.js | PDF and Word extraction to clean text |
| Hosting | Vercel | Frontend + API routes + serverless functions |
| Ops / Monitoring | Perplexity Computer | The "third co-founder" — see Operating Model below |

### Perplexity Computer Role (Ops, Not Product Backend)

Perplexity Computer is an autonomous agent platform — a digital worker, not a traditional API. It cannot serve as the AI backend for concurrent user requests. Instead, Computer operates as the third team member:

- **Customer support triage** — monitors support channels, answers common questions, escalates
- **Content marketing** — writes blog posts, RFP teardowns, LinkedIn content
- **Competitive intelligence** — monitors competitor pricing, features, announcements
- **Platform monitoring** — watches error rates, usage patterns, cost per proposal
- **Win verification** — checks SAM.gov for public award data (post-MVP)
- **Analytics & reporting** — generates weekly business reports
- **Development assistance** — helps build features, debug, generate tests

For the product's AI features (serving users), we call Anthropic and Perplexity Sonar APIs directly.

## Architecture Principles

- **Compliance over creativity**: A correct, grounded draft beats a flashy one
- **Evidence-first outputs**: Factual claims must trace to company materials or cited public sources
- **Human approval is mandatory**: The system produces a strong first draft, not an auto-submit machine
- **Thin UI, thick orchestration**: The interface stays simple while agent workflows do the hard work
- **Auditability by default**: Users can see where content came from and what still needs review
- **Tenant isolation from day 1**: Proposal content is commercially sensitive
- **Constrained tools over broad agent sprawl**: Each workflow gets a clear, structured set of actions

## MVP Scope (8 weeks)

### In scope
1. **Auth & Workspaces** — Supabase auth, tenant-isolated workspaces
2. **Company Knowledge Base** — Upload past proposals/capability statements, chunking, embeddings, retrieval
3. **RFP Upload & Analysis** — Upload PDF/Word/text, extract requirements, generate compliance matrix
4. **Federal vs. State/Local classification** — Branch workflow based on solicitation type
5. **Proposal Draft Generation** — Section-by-section, evidence-grounded, with citations and requirement annotations
6. **Review Workflow** — Flag weak/missing/unsupported sections, accept/reject/rewrite
7. **Compliance Checker** — Requirement-by-requirement coverage status, format checks, overall score
8. **Word Export** — Submission-ready document with annotation visibility controls
9. **Basic Metrics** — Proposals created, hours saved estimate, requirement coverage
10. **Outcome Tracking** — Won/lost/pending status per proposal

### Explicitly out of scope for MVP
- Full opportunity discovery / procurement portal monitoring
- Fully autonomous onboarding agent
- Deep multi-user collaboration workflows
- Automated success-fee invoicing and collections (track outcomes only)
- Comprehensive state/local template coverage across all jurisdictions
- Generalized "response OS" workflows outside GovCon

## Key Domain Terms

- **RFP**: Request for Proposal — government solicitation document
- **Section L**: Federal proposal submission instructions (how to write/format the proposal)
- **Section M**: Federal evaluation criteria (how the agency scores proposals)
- **Compliance Matrix**: Mapping of Section L instructions to Section M criteria — the core analysis output
- **FAR**: Federal Acquisition Regulation — primary rules governing federal procurement
- **SAM.gov**: System for Award Management — federal contractor registration portal
- **NAICS**: North American Industry Classification System — codes categorizing business types
- **PTAC**: Procurement Technical Assistance Center — free gov contracting counseling (distribution channel)
- **SBDC**: Small Business Development Center — SBA-funded business advisory centers
- **PWIN**: Probability of Win
- **SLED**: State, Local, and Education procurement market (~$2T/year)
- **FFP/T&M/CPFF**: Fixed-price / Time & Materials / Cost Plus Fixed Fee — contract types

## Development Guidelines

- Use TypeScript throughout
- Prefer server components in Next.js where possible
- Use Supabase client libraries for auth and data access
- AI calls go through Anthropic API (Claude) for drafting/analysis and Perplexity Sonar API for search/research
- RAG-only generation: never invent past performance or make ungrounded claims
- Every AI-generated section must cite its source (requirement ID, past proposal, evidence chunk)
- Keep the UI thin — the intelligence lives in the service layer, not the frontend
- All agent skill outputs are structured JSON, not loose prose
- Large documents are chunked and processed in parallel where possible

## File Structure

```
src/
  app/                  # Next.js app router pages
    (auth)/             # Auth pages (login, signup)
    (dashboard)/        # Authenticated app pages
      workspace/        # Workspace management
      knowledge-base/   # Company document management
      proposals/        # RFP upload, analysis, drafting, review
  components/           # React components (shadcn/ui based)
    ui/                 # shadcn primitives
    features/           # Feature-specific components
  lib/                  # Shared utilities, Supabase client, types
    supabase/           # Supabase client config, types
    ai/                 # AI service clients (Anthropic, Sonar)
    documents/          # Document processing utilities
  services/             # Backend service layer
    knowledge-base/     # Indexing, chunking, embedding, retrieval
    rfp-analyzer/       # Requirement extraction, compliance matrix
    proposal-drafter/   # Draft generation, citation management
    compliance-checker/ # Requirement coverage, format checks
supabase/
  migrations/           # Database migrations
  seed.sql              # Seed data
```

## Data Model (Core Entities)

- workspace
- user (+ workspace membership)
- company_profile
- source_document (uploaded files)
- evidence_chunk (indexed knowledge base content + embeddings)
- solicitation (uploaded RFP)
- extracted_requirement
- compliance_matrix_entry
- proposal_draft
- proposal_section
- citation
- compliance_finding
- proposal_outcome (won/lost/pending)
- audit_log

## Build Sequence

1. Auth, workspaces, and source document storage
2. Knowledge base ingestion and evidence chunking
3. RFP extraction and requirement matrix generation
4. Draft generation with citations
5. Review workflow and compliance checker
6. Export and basic metrics
7. Outcome tracking and pilot instrumentation

## Commands

```bash
npm run dev         # Start development server
npm run build       # Production build
npm run lint        # Lint check
npm run test        # Run tests
```
