# PRD Comparison: ProposalPilot vs. BidOS

## Sources Reviewed

- `ProposalPilot_PRD_v2.docx`
- `BidOS_PRD.docx`
- `Competition Strategy For Success.docx`
- `CLAUDE.md`
- `Agents.md`

## Executive Read

The two PRDs are directionally compatible, but they operate at different levels of specificity.

- `ProposalPilot` is the stronger competition-ready concept because it is vertical, operator-led, and tied to a massive, painful workflow with clear ROI.
- `BidOS` is useful as a product strategy lens. It contributes a tighter wedge mindset, stronger evidence-and-audit language, and a cleaner workflow framing.
- The competition strategy doc strongly favors a narrow, high-friction wedge with measurable outcomes over a broad "AI for everything" platform story.

The recommended synthesis is:

- Keep `ProposalPilot` as the product brand and initial market wedge.
- Position it as an AI-native operating layer for government proposal response workflows.
- Borrow `BidOS` ideas around evidence tracking, approval workflow, auditability, and phased expansion.
- Narrow the MVP to the minimum end-to-end loop that proves real value inside the 8-week build window.

## Where They Align

Both PRDs agree on the following core ideas:

- Two humans plus Perplexity Computer is the operating model.
- The product should be AI-native, not a thin wrapper around a single model.
- Knowledge-base retrieval and grounded outputs matter more than unconstrained generation.
- Human review remains required before final submission.
- The system should produce submission-ready output, not just raw text.
- The build must prove ROI quickly inside the competition timeline.
- Next.js, Supabase, and Perplexity Computer are reasonable implementation choices.

## Where ProposalPilot Is Stronger

`ProposalPilot_PRD_v2` contributes the strongest material in these areas:

- Clear vertical wedge: government contracting.
- Strong founder-market fit story.
- Large and defensible TAM narrative tied to federal plus state/local procurement.
- Deep domain-specific workflows: Section L/M mapping, readiness scoring, compliance matrix, past performance matching.
- Distinct go-to-market: PTACs, SBDCs, GovCon communities, consulting-led distribution.
- More complete competition framing and billion-dollar path.
- More detailed agent architecture that already matches the repo documents.

## Where BidOS Is Stronger

`BidOS_PRD.docx` contributes the strongest material in these areas:

- Cleaner wedge thinking and tighter scope.
- Stronger language around evidence-first outputs and citations.
- Better emphasis on review and approval workflow, not just generation.
- Better auditability framing.
- Simpler MVP definition that is easier to ship quickly.
- More credible sequencing from wedge to broader platform.

## Key Differences

## 1. Market Focus

- `ProposalPilot`: SMB government contractors, federal plus state/local.
- `BidOS`: Mid-market B2B vendors handling enterprise diligence workflows.

Implication:

- These should not be merged into a single launch market.
- The competition strategy favors choosing one painful, vertical workflow first.

## 2. Product Scope

- `ProposalPilot`: RFP ingestion, knowledge base, draft generation, compliance checking, win tracking, billing, opportunity scouting.
- `BidOS`: questionnaire upload, answer generation with citations, review workflow, export.

Implication:

- `ProposalPilot` is strategically stronger, but the MVP scope is too broad for 8 weeks unless trimmed.

## 3. Positioning

- `ProposalPilot`: vertical SaaS for GovCon proposal development.
- `BidOS`: horizontal operating system for enterprise response workflows.

Implication:

- The platform narrative should remain a long-term aspiration, not the MVP message.

## 4. Monetization

- `ProposalPilot`: freemium plus success fee.
- `BidOS`: setup fees, per-workflow pricing, subscription.

Implication:

- The success-fee model is a sharp differentiator, but it introduces legal and operational complexity.
- The MVP should support basic win tracking now and reserve automated fee collection for a later phase.

## 5. Competitive Fit

- `ProposalPilot` maps more directly to the strategy doc's preferred pattern: operator-led, domain-rich, bureaucratic, high-friction, high-value.
- `BidOS` is viable, but it reads more like a generalized enterprise workflow company and is less differentiated in the competition context.

## Synthesis Decisions for the Unified PRD

The unified PRD should make these explicit choices:

- Product name: `ProposalPilot`
- Initial wedge: AI-native operating system for government proposal response workflows
- Launch ICP: small-to-mid government contractors without large proposal teams
- MVP focus: upload RFP, extract requirements, ingest company evidence, generate grounded first draft, route through review, run compliance check, export
- Core differentiator: compliance-first, evidence-grounded proposal generation for GovCon
- Competition narrative: narrow wedge now, broader response-operations platform later
- Expansion path: after proving GovCon, extend into adjacent regulated response workflows rather than launching as a horizontal OS on day one

## What Should Be Deferred

To keep the unified doc realistic, these items should move out of the MVP core:

- Full opportunity scouting
- Fully autonomous onboarding
- Broad state/local template coverage across all jurisdictions
- Advanced team collaboration
- Automated success-fee invoicing and verification
- Broad "transaction OS" positioning in the launch narrative

## Recommended Final Framing

The strongest final story is:

`ProposalPilot is the AI-native operating system for government proposal response. It starts with the most painful, high-value workflow in GovCon: turning dense RFPs and fragmented past-performance evidence into compliant, reviewable first drafts with citations. Over time, it expands into the broader response and diligence operating layer for regulated enterprise workflows.`
