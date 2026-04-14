<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

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
| Win probability estimation | Perplexity Agent API + web_search | anthropic/claude-sonnet-4-6 | Market-informed estimation |
| Embeddings generation | Perplexity Embeddings API | sonar-embedding | RAG vector storage |
| Fast web Q&A | Perplexity Sonar API | sonar-pro | Quick agency intel lookups |

**Note:** Vertex AI and direct Anthropic SDK calls have been fully removed. All AI operations route through Perplexity's APIs using a single `PERPLEXITY_API_KEY`.
