# ProposalPilot — Agent Architecture

ProposalPilot's core intelligence is delivered through four focused service modules that communicate via structured JSON. Each module handles a distinct stage of the proposal workflow.

All AI operations route through Perplexity's APIs. The Agent API is the orchestration layer, Sonar API provides web-grounded Q&A, and the Embeddings API handles vector storage. A single PERPLEXITY_API_KEY covers all three API surfaces.

---

## MVP Agent Skills (4 Core)

### 1. Knowledge Base Indexer

**Purpose**: Turn raw company documents into retrievable proposal evidence.

**Trigger**: User uploads past proposals, capability statements, resumes, or past performance references.

**Input**:
- Document files (PDF, Word, plain text)
- Optional user-provided tags (NAICS codes, agencies, contract names)

**Processing Pipeline**:
1. **Document Extraction** (pdf-parse / mammoth.js) — Convert to clean text with structural metadata.
2. **Content Segmentation** — Break documents into reusable chunks:
   - Corporate overview sections
   - Technical approach narratives
   - Management approach sections
   - Key personnel bios/resumes
   - Past performance citations (contract name, agency, value, period, relevance)
   - Certifications and compliance statements
3. **Auto-Tagging** (Claude Sonnet) — Classify each chunk by:
   - NAICS code(s)
   - Agency/customer
   - Contract type (FFP, T&M, CPFF, etc.)
   - Topic/domain keywords
   - Date/recency
4. **Semantic Indexing** (Perplexity Embeddings API → Supabase pgvector) — Generate embeddings for each chunk. Store with metadata for retrieval.
5. **Deduplication** — Flag near-duplicate content across uploads for user review.

**Output** (structured JSON):
```json
{
  "status": "complete",
  "chunks_created": 42,
  "categories": {
    "past_performance": 8,
    "technical_approach": 12,
    "key_personnel": 6,
    "corporate_overview": 4,
    "certifications": 3,
    "management": 9
  },
  "duplicates_flagged": 2,
  "source_document_id": "doc_abc123"
}
```

**Success Condition**: The system can retrieve relevant company evidence for a new proposal without manual copy-paste.

---

### 2. RFP Analyzer

**Purpose**: Convert a solicitation into structured requirements and a compliance matrix.

**Trigger**: User uploads an RFP document (PDF, Word, or plain text).

**Input**:
- Raw document file
- Document metadata (agency, solicitation number, due date — user-provided or auto-detected)

**Processing Pipeline**:
1. **Document Extraction** (pdf-parse / mammoth.js) — Convert to clean text.
2. **Federal vs. State/Local Classification** (Claude) — Detect solicitation type to branch workflow:
   - Federal: look for FAR references, Section L/M structure, SF forms, DFARS clauses
   - State/local: identify jurisdiction, procurement code references, scoring rubric format
3. **Requirement Extraction** (Claude — long-context) — Identify every requirement. Categorize by type:
   - Technical requirements
   - Management requirements
   - Past performance requirements
   - Pricing/cost requirements
   - Compliance/certifications (clearances, set-asides, registrations)
   - Submission format requirements (page limits, fonts, file naming, required forms)
4. **Compliance Matrix Generation**:
   - Federal: map Section L instructions → Section M evaluation criteria
   - State/local: map submission instructions → scoring rubric/evaluation factors
5. **Ambiguity Flagging** — Identify vague, contradictory, or missing information for Q&A period.
6. **Readiness Scoring** — Score each requirement against the company's knowledge base:
   - Green: strong evidence match
   - Yellow: partial match
   - Red: gap — no relevant evidence found
7. **Agency Intelligence** (Perplexity Sonar API, optional) — Pull recent award history, incumbent info, agency priorities. Non-blocking — if search fails, proceed without enrichment.

**Output** (structured JSON):
```json
{
  "solicitation_id": "W911NF-26-R-0042",
  "classification": "federal",
  "agency": "US Army CCDC",
  "due_date": "2026-06-15T17:00:00Z",
  "requirements": [
    {
      "id": "REQ-001",
      "category": "technical",
      "text": "Contractor shall provide...",
      "section_ref": "Section C, para 3.2.1",
      "evaluation_weight": "high",
      "readiness_score": "green",
      "matched_evidence_ids": ["chunk_abc123", "chunk_def456"]
    }
  ],
  "compliance_matrix": [
    {
      "instruction_ref": "Section L, para 4.2",
      "instruction_text": "Technical volume shall not exceed 50 pages...",
      "evaluation_ref": "Section M, Factor 1",
      "evaluation_text": "Technical Approach (40%)",
      "mapped_requirements": ["REQ-001", "REQ-002", "REQ-003"]
    }
  ],
  "ambiguities": [
    {
      "id": "AMB-001",
      "text": "SOW references 'existing infrastructure' without defining scope",
      "section_ref": "Section C, para 2.1",
      "suggested_question": "Please clarify the boundaries of 'existing infrastructure'..."
    }
  ],
  "readiness_summary": { "green": 42, "yellow": 12, "red": 6 }
}
```

**Error Handling**:
- Corrupt/unreadable documents → return partial extraction + flag for human review
- Token limit exceeded → chunk document and process sections sequentially
- Sonar API failure → proceed without agency intelligence, flag as incomplete

---

### 3. Proposal Drafter

**Purpose**: Generate a grounded first-draft proposal aligned to the solicitation and company evidence.

**Trigger**: User requests a draft after RFP analysis is complete.

**Input**:
- Compliance matrix + extracted requirements from RFP Analyzer
- Company knowledge base (via pgvector semantic search)
- User-specified win themes or emphasis (optional)
- Formatting requirements from RFP

**Processing Pipeline**:
1. **Section Planning** (Claude) — Map compliance matrix to proposal sections. Determine section order, content strategy, and page allocations based on evaluation weights.
2. **Evidence Retrieval** (pgvector) — For each section, retrieve the most relevant knowledge base chunks. Score relevance and recency.
3. **Section-by-Section Drafting** (Claude — long-context) — Generate each section:
   - Ground content in retrieved evidence
   - Include inline citations: `[Evidence: chunk_abc123]`
   - Annotate with requirement mappings: `[Addresses: REQ-001, REQ-003]`
   - Mark unresolved items as explicit placeholders: `[PLACEHOLDER: No past performance found for cybersecurity domain]`
   - Assign confidence score (high/medium/low) based on evidence quality
4. **Cross-Section Coherence Check** (Claude) — Verify consistent terminology, no contradictions, and key themes threaded throughout.
5. **Readability Pass** — Flag overly long sentences, passive voice, and jargon-heavy sections.

**Output** (structured JSON per section):
```json
{
  "proposal_id": "prop_abc123",
  "sections": [
    {
      "id": "section_1",
      "title": "Technical Approach",
      "content": "...",
      "requirement_mappings": ["REQ-001", "REQ-002", "REQ-003"],
      "citations": [
        { "evidence_id": "chunk_abc123", "source_document": "Army IDIQ Proposal 2025", "excerpt": "..." }
      ],
      "placeholders": [],
      "confidence": "high",
      "word_count": 2450
    }
  ],
  "unresolved_requirements": ["REQ-022"],
  "total_word_count": 12800
}
```

**Guardrails**:
- **Evidence-first**: Never invent past performance, certifications, or capabilities not in the knowledge base
- **Mandatory citations**: Every factual claim traces to an evidence chunk or public source
- **Explicit gaps**: Unresolved requirements become visible placeholders, not fabricated content
- **Human-in-the-loop**: Draft is explicitly a *first draft* — the UX encourages editing, not blind submission

---

### 4. Compliance Checker

**Purpose**: Verify that every extracted requirement is addressed before export.

**Trigger**: User runs compliance check (manual) or auto-triggered before export.

**Input**:
- Extracted requirements from RFP Analyzer
- Current proposal draft (from Drafter or user-edited version)

**Processing Pipeline**:
1. **Requirement-to-Content Mapping** (Claude + semantic search) — For each requirement, find responsive content in the draft. Uses semantic matching, not just keywords.
2. **Coverage Assessment** — Rate each requirement:
   - **Addressed**: Clear, direct response found
   - **Partially Addressed**: Related content exists but doesn't fully respond
   - **Weak**: Content exists but is vague, generic, or unsupported
   - **Unaddressed**: No responsive content found
3. **Format Compliance** — Check against submission instructions:
   - Page/word limits per section
   - Required section headings present
   - Required attachments/forms listed
   - Font and margin requirements (where specified)
4. **Compliance Score** — Overall percentage + pass/fail recommendation.

**Output** (structured JSON):
```json
{
  "overall_score": 0.92,
  "recommendation": "PASS — 3 items need attention",
  "requirement_status": [
    { "id": "REQ-001", "status": "addressed", "draft_location": "Section 1, para 3" },
    { "id": "REQ-015", "status": "weak", "issue": "Past performance cited is >5 years old", "suggestion": "Add recent IDIQ task order from 2025" },
    { "id": "REQ-022", "status": "unaddressed", "issue": "No response to cybersecurity certification requirement" }
  ],
  "format_issues": [
    { "issue": "Technical volume at 53 pages exceeds 50-page limit", "severity": "critical" },
    { "issue": "Missing required attachment: SF-330", "severity": "high" }
  ]
}
```

---

## Post-MVP Skills (Phase 2+)

### Opportunity Scout
- Monitor SAM.gov, state procurement portals via Perplexity Sonar API
- Match opportunities against company profile
- Generate scored daily digests
- **Deferred to Phase 2**

### Onboarding Agent
- Guided workspace setup and first RFP walkthrough
- **Deferred to Phase 2** — founder-led onboarding for MVP pilots

---

## Workflow Diagram

```
User: Set up workspace + upload company docs
        │
        ▼
┌──────────────────────┐
│  Knowledge Base      │
│  Indexer             │
│  (pdf-parse → Claude │
│   → embeddings →     │
│   pgvector)          │
└──────────┬───────────┘
           │ evidence chunks indexed
           │
User: Upload RFP
           │
           ▼
┌──────────────────────┐
│  RFP Analyzer        │
│  (pdf-parse → Claude │
│   → Sonar optional)  │
└──────────┬───────────┘
           │ requirements + compliance matrix (JSON)
           ▼
┌──────────────────────┐     ┌──────────────────┐
│  Proposal Drafter    │◄────│  Knowledge Base   │
│  (Claude + pgvector  │     │  (RAG retrieval)  │
│   retrieval)         │     └──────────────────┘
└──────────┬───────────┘
           │ draft sections with citations (JSON)
           ▼
┌──────────────────────┐
│  Review Workflow     │
│  (UI — human review) │
│  accept/reject/edit  │
└──────────┬───────────┘
           │ reviewed draft
           ▼
┌──────────────────────┐
│  Compliance Checker  │
│  (Claude + rules)    │
└──────────┬───────────┘
           │ compliance report (JSON)
           ▼
   Export to Word + Submit
```

## AI API Usage Pattern

| Operation | API | Model | Why |
|-----------|-----|-------|-----|
| Requirement extraction | Perplexity Agent API | anthropic/claude-sonnet-4-6 | Best at structured extraction |
| Federal vs. state/local classification | Perplexity Agent API | anthropic/claude-sonnet-4-6 | Fast classification |
| Evidence chunk tagging | Perplexity Agent API | anthropic/claude-sonnet-4-6 | Categorization |
| Proposal section drafting | Perplexity Agent API | anthropic/claude-opus-4-6 | Highest quality writing |
| Cross-section coherence | Perplexity Agent API | anthropic/claude-sonnet-4-6 | Consistency check |
| Compliance checking | Perplexity Agent API | anthropic/claude-sonnet-4-6 | Semantic matching |
| Agency research & intel | Perplexity Agent API + web_search | sonar-pro | Search-grounded with citations |
| Opportunity discovery | Perplexity Agent API + web_search | sonar-pro | Government RFP search |
| Opportunity scoring | Perplexity Agent API | anthropic/claude-sonnet-4-6 | Multi-dimension scoring |
| Win probability | Perplexity Agent API + web_search | anthropic/claude-sonnet-4-6 | Market-informed estimation |
| Embeddings generation | Perplexity Embeddings API | sonar-embedding | RAG vector storage |
| Fast web Q&A | Perplexity Sonar API | sonar-pro | Quick agency intel lookups |

## Data Flow & Storage

| Data | Storage | Access Pattern |
|------|---------|---------------|
| Uploaded documents (RFPs + company docs) | Supabase Storage | Read during processing, archived |
| Evidence chunks + embeddings | Supabase PostgreSQL + pgvector | Semantic search during drafting |
| Extracted requirements | Supabase PostgreSQL | Queried during drafting and compliance |
| Compliance matrix | Supabase PostgreSQL | Displayed in UI, used by drafter |
| Draft proposals + sections | Supabase PostgreSQL | CRUD by user, versioned |
| Citations | Supabase PostgreSQL | Linked to sections and evidence chunks |
| Proposal outcomes | Supabase PostgreSQL | Analytics, future success-fee calculation |
| Audit logs | Supabase PostgreSQL | Debugging, trust, compliance |

## Perplexity Computer — Engine + Operator

Perplexity Computer is both the AI infrastructure of the product AND the operator of the company. All product AI routes through Perplexity's APIs, and Computer handles operational workflows:

| Ops Function | How Computer Helps |
|---|---|
| Support triage | Monitor support channels, answer common questions, escalate |
| Content marketing | Write blog posts, RFP teardowns, LinkedIn content for Sam |
| Competitive intel | Monitor competitor pricing/features, generate weekly briefs |
| Platform monitoring | Watch error rates, usage patterns, alert on anomalies |
| Win verification | Check SAM.gov for public award data (post-MVP) |
| Analytics | Generate weekly business reports and pilot metrics |
| Development assist | Help debug, write tests, generate boilerplate |
| Competition assets | Help prepare demo narrative, metrics deck, competition brief |
