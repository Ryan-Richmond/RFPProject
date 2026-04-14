# ProposalPilot — Project Instructions

@AGENTS.md

## AI Architecture — Perplexity-Native

ProposalPilot is built on Perplexity's API platform. All AI operations route through a single PERPLEXITY_API_KEY. There are no other AI providers.

### API Layer Map
| Function | Perplexity API | Model |
|---|---|---|
| RFP analysis & extraction | Agent API | anthropic/claude-sonnet-4-6 |
| Proposal drafting | Agent API | anthropic/claude-opus-4-6 |
| Compliance checking | Agent API | anthropic/claude-sonnet-4-6 |
| Opportunity discovery | Agent API + web_search tool | sonar-pro |
| Agency research & intel | Agent API + web_search tool | sonar-pro |
| Win probability estimation | Agent API + web_search tool | anthropic/claude-sonnet-4-6 |
| Knowledge base embeddings | Embeddings API | sonar-embedding |
| Fast web-grounded Q&A | Sonar API | sonar-pro |

### How Computer Operates the Business
Beyond the product's API calls, Perplexity Computer (the autonomous agent environment) operates ProposalPilot's business operations:
- Monitors the opportunity pipeline daily and flags high-priority pursuits
- Reviews proposal drafts for quality before client delivery
- Handles customer support triage
- Researches competitive intelligence on demand
- Writes and schedules content marketing

Perplexity Computer is both the AI infrastructure of the product AND the operator of the company.

## Tech Stack
- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui
- **Backend:** Supabase (PostgreSQL + pgvector + Storage + Auth)
- **AI:** Perplexity Agent API, Sonar API, Embeddings API (ONLY provider)
- **Environment:** Single `PERPLEXITY_API_KEY` for all AI operations
