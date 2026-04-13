# ProposalPilot — Computer as the Engine: Refactor Implementation Plan

> **Target audience**: Claude (coding assistant) implementing this refactor on the ProposalPilot repo.  
> **Competition context**: Perplexity Billion Dollar Build — primary judging criterion is "Computer is the Engine."  
> **Scope**: Replace all Vertex AI / Anthropic direct-call wiring with Perplexity Agent API routing. Update all narrative documentation to match.

---

## 1. Conceptual Explanation

### What "Computer as the Engine" Means for This Product

ProposalPilot's current architecture calls Anthropic's Claude directly through Google Vertex AI Model Garden, and treats Perplexity as a supplementary search layer (Sonar-only, non-blocking, optional). For the Perplexity Billion Dollar Build, that framing is backwards. "Computer as the engine" means every AI operation in the product's core workflow — requirement extraction, proposal drafting, compliance checking, knowledge base tagging, embeddings — routes through Perplexity's infrastructure rather than Anthropic's or Google's. Perplexity is not a feature. It is the AI layer.

### Why the Agent API Is the Right Mechanism

The Perplexity Agent API (`POST https://api.perplexity.ai/v1/agent`) is a unified multi-model routing layer. It accepts a `model` parameter that accepts provider-prefixed model identifiers (`anthropic/claude-sonnet-4-6`, `openai/gpt-5.4`, `google/gemini-2.5-pro`), meaning you can call Claude via Perplexity using a single endpoint and a single `PERPLEXITY_API_KEY`. The Agent API also supports native tool calls (`web_search`, `fetch_url`), `previous_response_id` for multi-turn chaining, `parallel_tool_calls`, and a `preset` field for search behaviors like `deep-research`. This is not a thin proxy — it adds multi-model routing, tool orchestration, and citation infrastructure on top of the underlying models. Crucially, it also exposes the Embeddings API (`POST https://api.perplexity.ai/embeddings`) with a `sonar-embedding` model, making it possible to replace the Gemini embeddings used for RAG as well.

### How Perplexity's Multi-Model Routing Maps to the Four Agent Skills

| Agent Skill | Operation | Perplexity API | Model |
|---|---|---|---|
| Knowledge Base Indexer | Document auto-tagging | Agent API | `anthropic/claude-sonnet-4-6` |
| Knowledge Base Indexer | Embedding generation | Embeddings API | `sonar-embedding` |
| RFP Analyzer | Classification + extraction | Agent API | `anthropic/claude-sonnet-4-6` |
| RFP Analyzer | Agency intel (web-grounded) | Sonar API | `sonar-pro` |
| Proposal Drafter | Section planning + drafting | Agent API | `anthropic/claude-sonnet-4-6` |
| Proposal Drafter | Evidence retrieval | pgvector (via Supabase) | n/a |
| Compliance Checker | Semantic requirement mapping | Agent API | `anthropic/claude-sonnet-4-6` |

Every single AI call routes through `api.perplexity.ai`. One key. One company. One infrastructure layer. That is the engine narrative.

### Why This Removes the `@google-cloud/vertexai` Dependency

The current `src/lib/ai/vertex.ts` uses the `@google-cloud/vertexai` npm package, requires a `GOOGLE_CLOUD_PROJECT` environment variable, and handles all auth via GCP application default credentials. Replacing it with fetch calls to the Perplexity Agent API removes the GCP dependency entirely. The `@google-cloud/vertexai` package can be removed from `package.json`. `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION` can be removed from `.env.local.example`. A single `PERPLEXITY_API_KEY` replaces both.

---

## 2. File Changes Required

### File 1: `src/lib/ai/vertex.ts`

**Current state**: Imports `@google-cloud/vertexai`, instantiates a `VertexAI` client using `GOOGLE_CLOUD_PROJECT`, exports `getChatModel()` (returns Claude via Vertex AI Model Garden) and `getEmbeddingModel()` (returns Gemini embedding-001 model).

**Required change**: Deprecate entirely. Replace the file contents with a deprecation notice pointing to `src/lib/ai/perplexity.ts`. Do not delete the file — mark it clearly so any lingering import fails loudly with a readable message.

**New content** (complete replacement):

```typescript
/**
 * @deprecated vertex.ts is no longer used.
 *
 * All AI calls now route through the Perplexity Agent API.
 * Import from `src/lib/ai/perplexity.ts` instead.
 *
 * Replaced functions:
 *   getChatModel()      → callAgentAPI() in perplexity.ts
 *   getEmbeddingModel() → generateEmbedding() in perplexity.ts
 *
 * The @google-cloud/vertexai package has been removed from package.json.
 * Remove GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION from .env.local.
 */

export function getChatModel(): never {
  throw new Error(
    "vertex.ts is deprecated. Use callAgentAPI() from src/lib/ai/perplexity.ts instead."
  );
}

export function getEmbeddingModel(): never {
  throw new Error(
    "vertex.ts is deprecated. Use generateEmbedding() from src/lib/ai/perplexity.ts instead."
  );
}
```

---

### File 2: `src/lib/ai/perplexity.ts`

**Current state**: Sonar-only. Exports a single `searchAgencyIntel()` function that calls `/chat/completions` with `sonar-pro`. No Agent API. No Embeddings API.

**Required change**: Full rewrite. See Section 3 for the complete new file.

---

### File 3: `src/services/knowledge-base/index.ts`

**Current state**: TODO comments in `indexDocument()` reference `Claude Sonnet (via Vertex AI)` and `gemini-embedding-001`. TODO comments in `searchEvidence()` reference `gemini-embedding-001`.

**Required changes**: Update all TODO comments to reference the Perplexity Agent API and Perplexity Embeddings API. No logic changes — these are stubs.

**Exact diff** (replace TODO comment block in `indexDocument()`):

```typescript
  // TODO: Epic 2 implementation
  // 1. Fetch document from Supabase Storage
  // 2. Parse with pdf-parse / mammoth.js
  // 3. Segment into chunks
  // 4. Auto-tag with Claude Sonnet via Perplexity Agent API
  //    → callAgentAPI({ model: "anthropic/claude-sonnet-4-6", input: chunkTagPrompt })
  // 5. Generate embeddings via Perplexity Embeddings API
  //    → generateEmbedding(chunkText) using sonar-embedding model
  // 6. Store in Supabase pgvector
  // 7. Flag duplicates
```

**Exact diff** (replace TODO comment block in `searchEvidence()`):

```typescript
  // TODO: Epic 2 implementation
  // 1. Generate query embedding via Perplexity Embeddings API
  //    → generateEmbedding(query) using sonar-embedding model
  // 2. Run pgvector similarity search
  // 3. Return top-k chunks with metadata
```

---

### File 4: `src/services/rfp-analyzer/index.ts`

**Current state**: TODO comments reference `Claude Sonnet via Vertex AI` (steps 3 and 4).

**Required changes**: Replace Vertex AI references with Perplexity Agent API.

**Exact diff** (replace TODO comment block in `analyzeRFP()`):

```typescript
  // TODO: Epic 3 implementation
  // 1. Fetch document from Supabase Storage
  // 2. Parse with pdf-parse / mammoth.js
  // 3. Classify federal vs. state/local via Perplexity Agent API
  //    → callAgentAPI({ model: "anthropic/claude-sonnet-4-6", input: classifyPrompt })
  // 4. Extract requirements via Perplexity Agent API (long-context)
  //    → callAgentAPI({ model: "anthropic/claude-sonnet-4-6", input: extractPrompt })
  // 5. Generate compliance matrix
  // 6. Flag ambiguities
  // 7. Score readiness against knowledge base
  // 8. Optional: Perplexity Sonar for agency intel
  //    → searchAgencyIntel(agencyQuery)
```

---

### File 5: `src/services/proposal-drafter/index.ts`

**Current state**: TODO comments reference `Claude via Vertex AI` (steps 2 and 3b) and `Claude Sonnet via Vertex AI` (step 4).

**Required changes**: Replace all Vertex AI references with Perplexity Agent API.

**Exact diff** (replace TODO comment block in `generateDraft()`):

```typescript
  // TODO: Epic 4 implementation
  // 1. Fetch compliance matrix + requirements
  // 2. Plan sections via Perplexity Agent API
  //    → callAgentAPI({ model: "anthropic/claude-sonnet-4-6", input: planPrompt })
  // 3. For each section:
  //    a. Retrieve evidence (pgvector)
  //    b. Draft with citations via Perplexity Agent API (long-context)
  //       → callAgentAPI({ model: "anthropic/claude-sonnet-4-6", input: draftPrompt })
  //    c. Mark unresolved as [PLACEHOLDER]
  //    d. Assign confidence score
  // 4. Cross-section coherence check via Perplexity Agent API
  //    → callAgentAPI({ model: "anthropic/claude-sonnet-4-6", input: coherencePrompt })
  // 5. Readability pass
```

---

### File 6: `src/services/compliance-checker/index.ts`

**Current state**: TODO comments reference `Claude + pgvector via Vertex AI` (step 3a).

**Required changes**: Replace Vertex AI reference with Perplexity Agent API.

**Exact diff** (replace TODO comment block in `checkCompliance()`):

```typescript
  // TODO: Epic 5 implementation
  // 1. Fetch extracted requirements
  // 2. Fetch current draft sections
  // 3. For each requirement:
  //    a. Semantic match against draft via Perplexity Agent API
  //       → callAgentAPI({ model: "anthropic/claude-sonnet-4-6", input: matchPrompt })
  //    b. Rate coverage: addressed / partially / weak / unaddressed
  // 4. Check format compliance:
  //    a. Page/word limits
  //    b. Required headings
  //    c. Required attachments
  //    d. Font and margin requirements (where specified)
  // 5. Calculate overall score
  // 6. Generate recommendation
```

---

### File 7: `proposal-pilot/CLAUDE.md`

**Current state**: File contains only `@AGENTS.md` — a single line reference. The actual content that needs updating lives in `proposal-pilot/AGENTS.md` (read via this reference) and root `CLAUDE.md`.

**Required change**: The `@AGENTS.md` reference is fine — leave it. The substantive changes are in the files it references (see Files 8 and 9 below).

---

### File 8: `proposal-pilot/AGENTS.md`

**Current state**: Opens with: `"The product calls AI APIs directly (Anthropic for Claude, Perplexity for Sonar search). Perplexity Computer operates as the third team member for ops, not as the product's AI backend."`

Also contains: the "AI API Usage Pattern" table and the "Perplexity Computer — Ops Role" section at the bottom.

**Required changes**: See Section 6 for exact replacement text.

---

### File 9: Root `CLAUDE.md`

**Current state**: Contains the tech stack table listing `AI — Drafting & Analysis` as "Anthropic API (Claude)" and "Ops / Monitoring" as "Perplexity Computer." Also contains "Perplexity Computer Role (Ops, Not Product Backend)" section explicitly saying Computer is NOT the product backend. Development Guidelines line 93 says "AI calls go through Anthropic API (Claude)."

**Required changes**: See Section 6 for exact replacement text.

---

### File 10: Root `Agents.md`

**Current state**: Same opening paragraph as `proposal-pilot/AGENTS.md`. Same "AI API Usage Pattern" table. Same "Perplexity Computer — Ops Role" section.

**Required changes**: This file appears to be a copy of / equivalent to `proposal-pilot/AGENTS.md`. Apply the same changes described for File 8. See Section 6 for exact replacement text.

---

## 3. New `src/lib/ai/perplexity.ts` — Complete Replacement File

```typescript
/**
 * Perplexity AI Client
 *
 * All AI calls in ProposalPilot route through Perplexity's infrastructure:
 *   - Agent API  → Claude (drafting, analysis, classification, compliance)
 *   - Agent API  → Claude + web_search tool (web-grounded research)
 *   - Sonar API  → sonar-pro (agency intel with real-time citations)
 *   - Embeddings API → sonar-embedding (RAG knowledge base vectors)
 *
 * Single environment variable: PERPLEXITY_API_KEY
 * No GCP credentials, no Vertex AI SDK, no secondary model provider.
 */

const PERPLEXITY_BASE_URL = "https://api.perplexity.ai";

// ---------------------------------------------------------------------------
// Shared Types
// ---------------------------------------------------------------------------

export interface AgentAPIResponse {
  output_text: string;
  citations: string[];
  status: "completed" | "incomplete" | "failed";
  response_id?: string;
}

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
}

export interface SonarSearchResult {
  answer: string;
  citations: string[];
}

export type AgentModel =
  | "anthropic/claude-sonnet-4-6"
  | "anthropic/claude-opus-4-6"
  | "openai/gpt-5.4"
  | "google/gemini-2.5-pro";

export type AgentPreset = "pro-search" | "deep-research";

export interface AgentTool {
  type: "web_search" | "fetch_url";
}

export interface AgentAPIOptions {
  /** Perplexity-routed model identifier. Default: anthropic/claude-sonnet-4-6 */
  model?: AgentModel;
  /** The prompt / user message to send. */
  input: string;
  /** System-level instructions for the model. */
  instructions?: string;
  /** Tool array — include { type: "web_search" } to enable grounded search. */
  tools?: AgentTool[];
  /** Preset search behavior. Use "deep-research" for thorough multi-source tasks. */
  preset?: AgentPreset;
  /** Chain responses — pass previous_response_id to continue a conversation. */
  previous_response_id?: string;
  /** Allow the model to run multiple tool calls in parallel. Default: true. */
  parallel_tool_calls?: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getApiKey(): string {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "PERPLEXITY_API_KEY is not set. Add it to .env.local. " +
        "All AI operations route through Perplexity — this key is required."
    );
  }
  return apiKey;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

// ---------------------------------------------------------------------------
// Agent API — Core LLM calls (Claude via Perplexity routing)
// ---------------------------------------------------------------------------

/**
 * Call the Perplexity Agent API.
 *
 * Routes to Claude (or any supported model) through Perplexity's
 * unified multi-model infrastructure. Use this for all drafting,
 * analysis, classification, and compliance tasks.
 *
 * @example
 * // RFP classification
 * const result = await callAgentAPI({
 *   model: "anthropic/claude-sonnet-4-6",
 *   input: rfpText,
 *   instructions: "Classify this solicitation as federal or state/local...",
 * });
 *
 * @example
 * // Chained multi-turn response
 * const first = await callAgentAPI({ input: "Plan sections for this RFP..." });
 * const second = await callAgentAPI({
 *   input: "Now draft Section 1 using this evidence...",
 *   previous_response_id: first.response_id,
 * });
 */
export async function callAgentAPI(
  options: AgentAPIOptions
): Promise<AgentAPIResponse> {
  const apiKey = getApiKey();
  const {
    model = "anthropic/claude-sonnet-4-6",
    input,
    instructions,
    tools,
    preset,
    previous_response_id,
    parallel_tool_calls = true,
  } = options;

  const body: Record<string, unknown> = {
    model,
    input,
    ...(instructions && { instructions }),
    ...(tools && tools.length > 0 && { tools }),
    ...(preset && { preset }),
    ...(previous_response_id && { previous_response_id }),
    ...(tools && tools.length > 0 && { parallel_tool_calls }),
  };

  const response = await fetch(`${PERPLEXITY_BASE_URL}/v1/agent`, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "(unreadable)");
    throw new Error(
      `Perplexity Agent API error: ${response.status} ${response.statusText} — ${errorText}`
    );
  }

  const data = await response.json();

  return {
    output_text: data.output_text ?? "",
    citations: data.citations ?? [],
    status: data.status ?? "completed",
    response_id: data.id,
  };
}

/**
 * Call the Perplexity Agent API with web search enabled.
 *
 * Use this for research tasks that need real-time, grounded information —
 * such as agency background, incumbent data, or recent award history.
 * Returns both synthesized answer text and source citations.
 *
 * @example
 * const result = await callAgentAPIWithSearch({
 *   input: "Who is the current IT services incumbent at DHS CISA?",
 *   preset: "pro-search",
 * });
 * // result.citations contains URLs backing each claim
 */
export async function callAgentAPIWithSearch(
  options: Omit<AgentAPIOptions, "tools">
): Promise<AgentAPIResponse> {
  return callAgentAPI({
    ...options,
    tools: [{ type: "web_search" }],
    parallel_tool_calls: true,
  });
}

// ---------------------------------------------------------------------------
// Embeddings API — sonar-embedding for RAG
// ---------------------------------------------------------------------------

/**
 * Generate a vector embedding for a text string.
 *
 * Replaces the previous Gemini embedding-001 call via Vertex AI.
 * Use for knowledge base indexing and evidence retrieval (pgvector).
 *
 * @returns Float array suitable for pgvector storage and cosine similarity.
 *
 * @example
 * const vector = await generateEmbedding("Our IDIQ contract with US Army...");
 * // Store vector in Supabase evidence_chunks table
 */
export async function generateEmbedding(
  text: string
): Promise<number[]> {
  const apiKey = getApiKey();

  const response = await fetch(`${PERPLEXITY_BASE_URL}/embeddings`, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: JSON.stringify({
      model: "sonar-embedding",
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "(unreadable)");
    throw new Error(
      `Perplexity Embeddings API error: ${response.status} ${response.statusText} — ${errorText}`
    );
  }

  const data = await response.json();
  const embedding = data?.data?.[0]?.embedding;

  if (!Array.isArray(embedding)) {
    throw new Error(
      "Perplexity Embeddings API returned an unexpected response shape. " +
        `Expected data[0].embedding array, got: ${JSON.stringify(data)}`
    );
  }

  return embedding as number[];
}

/**
 * Generate embeddings for multiple text strings in parallel.
 *
 * Convenience wrapper for batch indexing during knowledge base ingestion.
 * Errors on individual chunks are propagated — caller should handle partial failures.
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  return Promise.all(texts.map(generateEmbedding));
}

// ---------------------------------------------------------------------------
// Sonar API — Real-time web-grounded search with citations
// ---------------------------------------------------------------------------

/**
 * Search for agency intelligence using Perplexity Sonar Pro.
 *
 * Use for optional research enrichment: agency priorities, past award
 * history, incumbent contractors. Non-blocking — if this fails, the
 * core proposal workflow continues without it.
 *
 * @example
 * const intel = await searchAgencyIntel(
 *   "Recent IT services awards at Department of Veterans Affairs 2024-2025"
 * );
 * if (intel) {
 *   // Enrich RFP analysis with incumbent and award data
 * }
 */
export async function searchAgencyIntel(
  query: string
): Promise<SonarSearchResult | null> {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    console.warn(
      "PERPLEXITY_API_KEY not set — skipping agency intelligence enrichment."
    );
    return null;
  }

  try {
    const response = await fetch(`${PERPLEXITY_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: buildAuthHeaders(apiKey),
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content:
              "You are a government contracting research assistant. " +
              "Provide factual, cited information about agencies, incumbents, and recent awards.",
          },
          {
            role: "user",
            content: query,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("Perplexity Sonar API error:", response.status);
      return null;
    }

    const data = await response.json();
    return {
      answer: data.choices?.[0]?.message?.content ?? "",
      citations: data.citations ?? [],
    };
  } catch (error) {
    console.error("Perplexity Sonar search failed:", error);
    return null;
  }
}
```

---

## 4. `package.json` Dependency Changes

**File path**: `proposal-pilot/package.json`

**Remove** (line 13):
```json
"@google-cloud/vertexai": "^1.11.0",
```

**After removal**, the `dependencies` block becomes:
```json
"dependencies": {
  "@base-ui/react": "^1.3.0",
  "@supabase/ssr": "^0.10.2",
  "@supabase/supabase-js": "^2.103.0",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "lucide-react": "^1.8.0",
  "next": "16.2.3",
  "next-themes": "^0.4.6",
  "react": "19.2.4",
  "react-dom": "19.2.4",
  "shadcn": "^4.2.0",
  "sonner": "^2.0.7",
  "tailwind-merge": "^3.5.0",
  "tw-animate-css": "^1.4.0"
}
```

**After editing `package.json`**, run:
```bash
npm install
```

This will remove `@google-cloud/vertexai` from `node_modules` and update `package-lock.json`.

**No new packages needed.** The Perplexity Agent, Sonar, and Embeddings APIs are called via `fetch` — no SDK required.

---

## 5. Environment Variable Changes

**File path**: `proposal-pilot/.env.local.example` (create this file if it does not exist, or update it)

**Remove**:
```
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1
```

**Also remove** any `OPENAI_API_KEY` entries if present (embeddings now use Perplexity).

**Add / confirm present**:
```
# Perplexity API — ALL AI operations route through this key
# Covers: Agent API (Claude drafting/analysis), Sonar API (agency research),
#         and Embeddings API (RAG knowledge base vectors)
# Get yours at: https://www.perplexity.ai/settings/api
PERPLEXITY_API_KEY=pplx-...
```

**Keep unchanged**:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Final `.env.local.example`**:
```
# Perplexity API — all AI calls route through this single key
# Agent API (Claude), Sonar API (web search), Embeddings API (RAG)
PERPLEXITY_API_KEY=pplx-...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 6. Narrative Rewrite — Exact Replacement Text

### 6a. Root `CLAUDE.md` — Tech Stack Table (replace AI rows)

**Find and replace** the following rows in the tech stack table:

| Old row | New row |
|---|---|
| `AI — Drafting & Analysis \| Anthropic API (Claude) \| Direct API calls for requirement extraction, proposal drafting, compliance checking` | `AI — Drafting & Analysis \| Perplexity Agent API \| Routes to Claude (anthropic/claude-sonnet-4-6) through Perplexity — requirement extraction, proposal drafting, compliance checking` |
| `AI — Search & Research \| Perplexity Sonar API \| Agency intelligence, incumbent research, grounded citations` | `AI — Search & Research \| Perplexity Sonar API \| Agency intelligence, incumbent research, grounded citations — same key as Agent API` |
| `Embeddings / RAG \| Supabase pgvector + OpenAI Embeddings API \| Vector search over company knowledge base` | `Embeddings / RAG \| Supabase pgvector + Perplexity Embeddings API \| sonar-embedding model for knowledge base vectors — same key as Agent API` |
| `Ops / Monitoring \| Perplexity Computer \| The "third co-founder" — see Operating Model below` | `Ops / Monitoring \| Perplexity Computer \| Development assistance, content marketing, competitive intelligence — see Operating Model below` |

**Find and replace** development guidelines line 93:

Old:
```
- AI calls go through Anthropic API (Claude) for drafting/analysis and Perplexity Sonar API for search/research
```

New:
```
- All AI calls route through the Perplexity API (Agent API for Claude drafting/analysis, Sonar API for search/research, Embeddings API for RAG vectors)
```

**Find and replace** the "Perplexity Computer Role" section heading and body text. Replace the entire section from `### Perplexity Computer Role (Ops, Not Product Backend)` through `For the product's AI features (serving users), we call Anthropic and Perplexity Sonar APIs directly.` with:

```markdown
### Perplexity as the AI Infrastructure Backbone

All AI operations in ProposalPilot route through Perplexity's infrastructure via a single `PERPLEXITY_API_KEY`. There is no direct Anthropic API key. There is no GCP/Vertex AI dependency. Perplexity is the AI layer:

- **Agent API** (`POST https://api.perplexity.ai/v1/agent`) — routes to `anthropic/claude-sonnet-4-6` for requirement extraction, proposal drafting, compliance checking, and knowledge base tagging. Supports tool calls, multi-turn chaining via `previous_response_id`, and parallel execution.
- **Sonar API** (`POST https://api.perplexity.ai/chat/completions`) — `sonar-pro` model for real-time web-grounded agency research with citations.
- **Embeddings API** (`POST https://api.perplexity.ai/embeddings`) — `sonar-embedding` model for generating knowledge base vectors, replacing the previous Gemini embedding-001 via Vertex AI.

Perplexity Computer (this agent environment) additionally serves as development partner, content creator, and competitive intelligence feed — but that is secondary to its role as the product's AI routing layer.
```

---

### 6b. `proposal-pilot/AGENTS.md` and Root `Agents.md` — Opening Paragraph

**Find and replace** the opening paragraph (lines 3-5 in both files):

Old:
```
ProposalPilot's core intelligence is delivered through four focused service modules that communicate via structured JSON. Each module handles a distinct stage of the proposal workflow.

The product calls AI APIs directly (Anthropic for Claude, Perplexity for Sonar search). Perplexity Computer operates as the third team member for ops, not as the product's AI backend.
```

New:
```markdown
ProposalPilot's core intelligence is delivered through four focused service modules that communicate via structured JSON. Each module handles a distinct stage of the proposal workflow.

All AI calls in the product route through the **Perplexity API** — a unified multi-model routing layer that provides the Agent API (for Claude-powered drafting and analysis), the Sonar API (for real-time web-grounded research), and the Embeddings API (for RAG vector generation). A single `PERPLEXITY_API_KEY` covers all three. There is no direct Anthropic API dependency and no GCP/Vertex AI infrastructure.
```

---

### 6c. `proposal-pilot/AGENTS.md` and Root `Agents.md` — AI API Usage Pattern Table

**Find and replace** the entire "AI API Usage Pattern" table:

Old:
```markdown
| Operation | API | Model | Why |
|-----------|-----|-------|-----|
| Requirement extraction | Anthropic | Claude (long-context) | Handles full RFP in single pass, best at structured extraction |
| Federal vs. state/local classification | Anthropic | Claude Sonnet | Fast classification task |
| Evidence chunk tagging | Anthropic | Claude Sonnet | Categorization, lower cost than Opus |
| Proposal section drafting | Anthropic | Claude (long-context) | Highest quality reasoning and writing |
| Cross-section coherence | Anthropic | Claude Sonnet | Comparison and consistency check |
| Compliance checking | Anthropic | Claude Sonnet + deterministic rules | Rules for measurable criteria, AI for semantic matching |
| Agency research & intel | Perplexity | Sonar Pro | Search-grounded with citations |
| Embeddings generation | OpenAI | text-embedding-3-small | Cost-effective, good quality for RAG |
```

New:
```markdown
| Operation | Perplexity API | Model | Notes |
|-----------|---------------|-------|-------|
| Requirement extraction | Agent API | `anthropic/claude-sonnet-4-6` | Long-context; handles full RFP in single pass |
| Federal vs. state/local classification | Agent API | `anthropic/claude-sonnet-4-6` | Fast classification with structured output |
| Evidence chunk tagging | Agent API | `anthropic/claude-sonnet-4-6` | Categorization at ingestion time |
| Proposal section drafting | Agent API | `anthropic/claude-sonnet-4-6` | Long-context; evidence-grounded generation |
| Cross-section coherence | Agent API | `anthropic/claude-sonnet-4-6` | Multi-section comparison pass |
| Compliance checking | Agent API | `anthropic/claude-sonnet-4-6` + rules | Semantic matching + deterministic format rules |
| Agency research & intel | Sonar API | `sonar-pro` | Real-time web search with citations |
| Knowledge base embeddings | Embeddings API | `sonar-embedding` | Vectors for pgvector RAG retrieval |

All three APIs share one endpoint domain (`api.perplexity.ai`) and one `PERPLEXITY_API_KEY`. No other AI provider credentials are required.
```

---

### 6d. `proposal-pilot/AGENTS.md` and Root `Agents.md` — Perplexity Computer Ops Role Section

**Find and replace** the entire "Perplexity Computer — Ops Role" section:

Old:
```markdown
## Perplexity Computer — Ops Role

Computer handles operational workflows as the third team member, NOT product AI:

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
```

New:
```markdown
## Perplexity — AI Backbone and Operating Partner

Perplexity powers ProposalPilot at two levels:

### Level 1: Product AI Infrastructure (Core)

Every AI operation in the proposal workflow runs through Perplexity's API:

| Product Function | Perplexity Service | Details |
|---|---|---|
| Requirement extraction | Agent API → Claude | Classifies and extracts structured requirements from RFP text |
| Proposal drafting | Agent API → Claude | Generates evidence-grounded section drafts with citations |
| Compliance checking | Agent API → Claude | Semantic requirement-to-draft matching |
| Knowledge base tagging | Agent API → Claude | Auto-categorizes company document chunks |
| Knowledge base vectors | Embeddings API | `sonar-embedding` for pgvector RAG |
| Agency intelligence | Sonar API | Real-time web-grounded research with citations |

### Level 2: Operational Partner (Secondary)

Perplexity Computer also serves as a hands-on operational team member:

| Ops Function | How Computer Helps |
|---|---|
| Development assist | Debug, write tests, implement features, review code |
| Content marketing | Write blog posts, RFP teardowns, LinkedIn content |
| Competitive intel | Monitor competitor pricing/features, generate weekly briefs |
| Platform monitoring | Watch error rates, usage patterns, alert on anomalies |
| Win verification | Check SAM.gov for public award data (post-MVP) |
| Analytics | Generate weekly business reports and pilot metrics |
| Competition assets | Prepare demo narrative, metrics deck, competition materials |
```

---

### 6e. Workflow Diagram Update (in `Agents.md`)

**Find and replace** the two diagram boxes that reference Vertex AI:

Old:
```
┌──────────────────────┐
│  Knowledge Base      │
│  Indexer             │
│  (pdf-parse → Claude │
│   → embeddings →     │
│   pgvector)          │
└──────────┬───────────┘
```

New:
```
┌──────────────────────┐
│  Knowledge Base      │
│  Indexer             │
│  (pdf-parse →        │
│   Perplexity Agent   │
│   → Perplexity       │
│   Embeddings →       │
│   pgvector)          │
└──────────┬───────────┘
```

Old:
```
┌──────────────────────┐
│  RFP Analyzer        │
│  (pdf-parse → Claude │
│   → Sonar optional)  │
└──────────┬───────────┘
```

New:
```
┌──────────────────────┐
│  RFP Analyzer        │
│  (pdf-parse →        │
│   Perplexity Agent   │
│   → Sonar optional)  │
└──────────┬───────────┘
```

Old:
```
┌──────────────────────┐     ┌──────────────────┐
│  Proposal Drafter    │◄────│  Knowledge Base   │
│  (Claude + pgvector  │     │  (RAG retrieval)  │
│   retrieval)         │     └──────────────────┘
└──────────┬───────────┘
```

New:
```
┌──────────────────────┐     ┌──────────────────┐
│  Proposal Drafter    │◄────│  Knowledge Base   │
│  (Perplexity Agent   │     │  (RAG retrieval)  │
│   + pgvector)        │     └──────────────────┘
└──────────┬───────────┘
```

Old:
```
┌──────────────────────┐
│  Compliance Checker  │
│  (Claude + rules)    │
└──────────┬───────────┘
```

New:
```
┌──────────────────────┐
│  Compliance Checker  │
│  (Perplexity Agent   │
│   + rules)           │
└──────────┬───────────┘
```

---

## 7. Competition Talking Point

> ProposalPilot doesn't call Anthropic — it calls Perplexity. Every AI operation in the product, from extracting requirements out of a 200-page federal RFP to generating a compliant proposal draft grounded in the company's own evidence, routes through the Perplexity Agent API. Perplexity chooses the model, routes the call, manages the tool use, and returns structured output with citations. We deleted our Vertex AI dependency entirely and replaced it with a single `PERPLEXITY_API_KEY`. One key. One infrastructure layer. That is the engine.

---

## Summary of All Changes

| File | Action | Key Change |
|---|---|---|
| `src/lib/ai/perplexity.ts` | Full rewrite | Add Agent API, Embeddings API, keep Sonar; single key for all |
| `src/lib/ai/vertex.ts` | Deprecate | Replace with error-throwing stubs + deprecation notice |
| `src/services/knowledge-base/index.ts` | Update comments | Vertex AI → Perplexity Agent API + Embeddings API |
| `src/services/rfp-analyzer/index.ts` | Update comments | Vertex AI → Perplexity Agent API |
| `src/services/proposal-drafter/index.ts` | Update comments | Vertex AI → Perplexity Agent API |
| `src/services/compliance-checker/index.ts` | Update comments | Vertex AI → Perplexity Agent API |
| `proposal-pilot/AGENTS.md` | Narrative rewrite | Perplexity as AI backbone; updated table and diagram |
| `proposal-pilot/CLAUDE.md` | No direct change | Inherits from `AGENTS.md` via `@AGENTS.md` reference |
| Root `CLAUDE.md` | Narrative rewrite | Tech stack table, Computer Role section, dev guidelines |
| Root `Agents.md` | Narrative rewrite | Same as `proposal-pilot/AGENTS.md` |
| `package.json` | Remove dependency | Delete `@google-cloud/vertexai` |
| `.env.local.example` | Update vars | Remove GCP vars; confirm `PERPLEXITY_API_KEY` covers all AI |

**No new npm packages required.** The Perplexity APIs are all called via native `fetch`. The refactor removes a dependency (`@google-cloud/vertexai`) and adds zero new ones.
