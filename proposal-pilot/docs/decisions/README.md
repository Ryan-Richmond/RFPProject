# Decision Log

Architecture decisions for ProposalPilot. One file per decision, numbered sequentially. Once a decision is **Accepted**, the file is immutable — supersede it with a new entry rather than editing in place.

CLAUDE.md and AGENTS.md link here. When the docs and the code disagree, an ADR is what closes the gap.

## When to write one

Write an ADR when a change would surprise a future contributor (or future Claude) reading the code cold. Good triggers:

- Swapping an AI provider, embedding model, or vector dimension
- Changing the data model in a way that affects more than one service
- Picking between two reasonable approaches where the choice isn't obvious from the code
- Deferring something you considered but rejected (so we don't re-litigate it)

If the answer to "why is it this way?" can't be inferred from the code in under five minutes, write the ADR.

## When NOT to write one

- Bug fixes
- Refactors that don't change behavior or contracts
- Routine feature work that follows existing patterns
- Anything captured well enough in the PR description

## Index

| #    | Title                                                             | Status   | Date       |
| ---- | ----------------------------------------------------------------- | -------- | ---------- |
| 0001 | [Gemini for development AI routing](0001-gemini-for-development-ai-routing.md) | Accepted | 2026-05-17 |

## Template

```markdown
# NNNN — Short title

- **Status:** Proposed | Accepted | Superseded by NNNN | Deprecated
- **Date:** YYYY-MM-DD
- **Deciders:** name(s)

## Context

What's the situation? What forced the decision? Include enough background that a future reader doesn't need to dig through git history to understand why this came up.

## Decision

What did we decide? Be specific — name the file, the model, the column, the threshold.

## Alternatives considered

What else was on the table, and why didn't we pick it? Saves re-litigation later.

## Consequences

What this enables, what it costs, what now becomes harder. Honest about tradeoffs.

## Revisit when

The conditions that would make us reconsider. ADRs are not forever — name what would flip them.
```
