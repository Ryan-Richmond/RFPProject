# ProposalPilot — Project Instructions

@AGENTS.md

## Decision Log

Architecture decisions live in [`docs/decisions/`](docs/decisions/README.md). When the code and these instructions disagree, the ADR is what closes the gap. Read the relevant ADR before changing an AI call site, the data model, or anything that crosses service boundaries.

## AI Architecture

**Current (development): Google Gemini.** All AI operations route through `src/lib/ai/gemini.ts` with a single `GEMINI_API_KEY`. See [ADR 0001](docs/decisions/0001-gemini-for-development-ai-routing.md) for the why.

**Production target: Perplexity-native.** Single `PERPLEXITY_API_KEY`, original model assignments per the table below. The Perplexity wrapper lives at `src/lib/ai/perplexity.ts` and stays in tree for the eventual swap.

### Current dev routing

| Function                          | Model                  |
| --------------------------------- | ---------------------- |
| All chat / extraction / drafting / compliance / scoring | `gemini-flash-latest`  |
| Embeddings                        | `gemini-embedding-001` (1024 dims) |

### Production target routing

| Function                       | Perplexity API           | Production model               |
| ------------------------------ | ------------------------ | ------------------------------ |
| RFP analysis & extraction      | Agent API                | `anthropic/claude-sonnet-4-6`  |
| Proposal drafting              | Agent API                | `anthropic/claude-opus-4-6`    |
| Compliance checking            | Agent API                | `anthropic/claude-sonnet-4-6`  |
| Opportunity discovery          | Agent API + web_search   | `sonar-pro`                    |
| Agency research & intel        | Agent API + web_search   | `sonar-pro`                    |
| Win probability estimation     | Agent API + web_search   | `anthropic/claude-sonnet-4-6`  |
| Knowledge base embeddings      | Embeddings API           | `sonar-embedding`              |
| Fast web-grounded Q&A          | Sonar API                | `sonar-pro`                    |

When writing new AI code today, pass the production model name as the `model:` parameter (it's ignored by `gemini.ts`, but documents intent for the eventual swap).

**Invariant:** both sides of any cosine comparison must use the same embedding model. All embeddings flow through `generateEmbeddings()` in `src/lib/ai/gemini.ts`.

### How Computer Operates the Business

Beyond the product's API calls, Perplexity Computer (the autonomous agent environment) operates ProposalPilot's business operations:

- Monitors the opportunity pipeline daily and flags high-priority pursuits
- Reviews proposal drafts for quality before client delivery
- Handles customer support triage
- Researches competitive intelligence on demand
- Writes and schedules content marketing

This role is independent of the product's AI routing — Computer-as-operator runs regardless of which provider powers the product itself.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui
- **Backend:** Supabase (PostgreSQL + pgvector + Storage + Auth)
- **AI (current):** Google Gemini via `@google/genai` — single `GEMINI_API_KEY`
- **AI (production target):** Perplexity Agent / Sonar / Embeddings APIs — single `PERPLEXITY_API_KEY`
