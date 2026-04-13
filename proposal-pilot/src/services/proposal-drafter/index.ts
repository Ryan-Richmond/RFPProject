/**
 * Proposal Drafter Service
 *
 * Generates grounded first-draft proposals aligned to the solicitation
 * and company evidence. See AGENTS.md — Skill 3 for full specification.
 */

// ---- Output Types (from AGENTS.md structured JSON) ----

export interface ProposalDraftResult {
  proposal_id: string;
  sections: ProposalSection[];
  unresolved_requirements: string[];
  total_word_count: number;
}

export interface ProposalSection {
  id: string;
  title: string;
  content: string;
  requirement_mappings: string[];
  citations: Citation[];
  placeholders: string[];
  confidence: "high" | "medium" | "low";
  word_count: number;
}

export interface Citation {
  evidence_id: string;
  source_document: string;
  excerpt: string;
}

// ---- Service Functions (stubs for Epic 4) ----

/**
 * Generate a first-draft proposal from the compliance matrix and evidence base.
 */
export async function generateDraft(
  proposalId: string,
  workspaceId: string,
  options?: {
    win_themes?: string[];
    emphasis?: string;
  }
): Promise<ProposalDraftResult> {
  // TODO: Epic 4 implementation
  // 1. Fetch compliance matrix + requirements
  // 2. Plan sections (Claude via Vertex AI)
  // 3. For each section:
  //    a. Retrieve evidence (pgvector)
  //    b. Draft with citations (Claude long-context via Vertex AI)
  //    c. Mark unresolved as [PLACEHOLDER]
  //    d. Assign confidence score
  // 4. Cross-section coherence check (Claude Sonnet via Vertex AI)
  // 5. Readability pass

  throw new Error("Proposal Drafter not yet implemented — Epic 4");
}
