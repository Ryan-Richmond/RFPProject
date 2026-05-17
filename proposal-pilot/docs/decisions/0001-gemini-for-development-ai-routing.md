# 0001 — Gemini for development AI routing

- **Status:** Accepted
- **Date:** 2026-05-17
- **Deciders:** Rodge

## Context

ProposalPilot was originally designed as Perplexity-native: all AI operations (Agent API for chat, Sonar for web-grounded Q&A, Embeddings API for RAG) route through a single `PERPLEXITY_API_KEY`. That intent is captured in the original PRD, CLAUDE.md, and AGENTS.md, and migration `005_perplexity_embedding_alignment.sql` widened the vector column from 768 to 1024 dims to align with `sonar-embedding`.

During development we needed faster iteration and lower friction than the Perplexity Agent API was giving us at the time, and a swap to Gemini was made. The code reflects this — every call site in `src/lib/ai/` and the service modules now goes through `src/lib/ai/gemini.ts`. The docs were not updated, which caused real confusion (Claude "corrected" the user mid-planning based on the stale doc tables).

## Decision

For the development environment, all AI operations route through Google Gemini, via the Google GenAI SDK:

| Operation                        | Model                | Notes                                    |
| -------------------------------- | -------------------- | ---------------------------------------- |
| Chat / extraction / drafting / compliance / scoring / coherence | `gemini-flash-latest` | Single model for all text generation     |
| Embeddings                       | `gemini-embedding-001` | 1024 dimensions, matches existing `vector(1024)` columns |

- Single env var: `GEMINI_API_KEY`
- All AI call sites import from `src/lib/ai/gemini.ts`
- `src/lib/ai/perplexity.ts` is kept in tree as the production target but is not called
- New AI work uses the same `callAgentAPI` / `generateEmbeddings` pattern from `gemini.ts` — same shape as the Perplexity wrapper, so the eventual swap back is a single-file change

The production target remains Perplexity-native. Original model assignments (e.g., `anthropic/claude-sonnet-4-6` for extraction, `anthropic/claude-opus-4-6` for drafting) can be passed as the `model:` parameter to call sites for documentation purposes — `gemini.ts` accepts and ignores it. When we cut to production, we lift those overrides.

## Alternatives considered

- **Stay on Perplexity through development.** Rejected for now — friction was high enough to slow iteration on the core matching and drafting work. We can revisit once that work stabilizes.
- **Dual provider with a feature flag.** Rejected as premature. Two providers means two sets of failure modes during the phase when we're still changing prompts and schemas. Single provider now, flag-based swap when we're closer to launch.

## Consequences

**Enables**

- Faster iteration on AI features (lower latency on flash-latest, simpler error surface)
- 1024-dim embeddings give more headroom for the requirement-to-capability matching work
- One quota, one dashboard, one set of logs to reason about during development

**Costs**

- Vendor split: dev runs on Google, production target is Perplexity. Costs/quotas are tracked separately.
- Any prompt engineering done now needs a regression pass when we swap back — Gemini and Claude-via-Perplexity respond differently to the same prompt.
- Web-grounded operations (Opportunity Discovery, Agency Research) lose the Sonar `web_search` tool. Those features either fall back to non-search Gemini or are temporarily degraded. Track in the relevant service modules.
- Embedding model lock-in: every capability chunk in `evidence_chunks` is now Gemini-embedded. Swapping the embedding model requires re-embedding the corpus, not just changing a config.

**Mandatory invariant**

Both sides of any cosine comparison must use the same embedding model. RFP requirement embeddings, capability chunk embeddings, and query embeddings all flow through `generateEmbeddings()` in `src/lib/ai/gemini.ts`. Do not mix models.

## Revisit when

- Perplexity Agent API stability/latency improves enough to remove the friction that motivated the swap
- We approach launch and need the production routing locked in (target: before the first paying pilot)
- Gemini pricing changes materially or a quota cap becomes blocking
- A capability we need (e.g., long-form web-grounded search with citations) is materially better on the Perplexity side
