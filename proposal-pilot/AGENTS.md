<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Decision Log

Architecture decisions live in [`docs/decisions/`](docs/decisions/README.md). Read the relevant ADR before changing an AI provider, the data model, or anything that crosses service boundaries. When the code and this file disagree, the ADR is canonical.

## AI API Usage Pattern

**Current development environment routes all AI through Google Gemini.** See [ADR 0001](docs/decisions/0001-gemini-for-development-ai-routing.md). The table below shows the production target — what each operation *will* run on once we swap back. In dev, every row collapses to `gemini-flash-latest` (chat) or `gemini-embedding-001` @ 1024 dims (embeddings).

| Operation                              | Production API           | Production model                | Why                              |
| -------------------------------------- | ------------------------ | ------------------------------- | -------------------------------- |
| Requirement extraction                 | Perplexity Agent API     | `anthropic/claude-sonnet-4-6`   | Best at structured extraction    |
| Federal vs. state/local classification | Perplexity Agent API     | `anthropic/claude-sonnet-4-6`   | Fast classification              |
| Evidence chunk tagging                 | Perplexity Agent API     | `anthropic/claude-sonnet-4-6`   | Categorization                   |
| Proposal section drafting              | Perplexity Agent API     | `anthropic/claude-opus-4-6`     | Highest quality writing          |
| Cross-section coherence                | Perplexity Agent API     | `anthropic/claude-sonnet-4-6`   | Consistency check                |
| Compliance checking                    | Perplexity Agent API     | `anthropic/claude-sonnet-4-6`   | Semantic matching                |
| Agency research & intel                | Perplexity Agent + web_search | `sonar-pro`                | Search-grounded with citations   |
| Opportunity discovery                  | Perplexity Agent + web_search | `sonar-pro`                | Government RFP search            |
| Opportunity scoring                    | Perplexity Agent API     | `anthropic/claude-sonnet-4-6`   | Multi-dimension scoring          |
| Win probability estimation             | Perplexity Agent + web_search | `anthropic/claude-sonnet-4-6` | Market-informed estimation     |
| Embeddings generation                  | Perplexity Embeddings API | `sonar-embedding`              | RAG vector storage               |
| Fast web Q&A                           | Perplexity Sonar API     | `sonar-pro`                     | Quick agency intel lookups       |

**When writing new AI call sites:** pass the production model name as the `model:` parameter. The Gemini wrapper accepts and ignores it; the value documents intent and survives the eventual swap.

**Invariant:** both sides of any cosine comparison must use the same embedding model. All embeddings flow through `generateEmbeddings()` in `src/lib/ai/gemini.ts`. Do not mix models.
