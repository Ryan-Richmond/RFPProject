/**
 * RFP Analyzer Service
 *
 * Converts a solicitation into structured requirements and a compliance matrix.
 * See AGENTS.md — Skill 2 for full specification.
 */

// ---- Output Types (from AGENTS.md structured JSON) ----

export interface RFPAnalysisResult {
  solicitation_id: string;
  classification: "federal" | "state_local";
  agency: string;
  due_date: string;
  requirements: ExtractedRequirement[];
  compliance_matrix: ComplianceMatrixEntry[];
  ambiguities: Ambiguity[];
  readiness_summary: {
    green: number;
    yellow: number;
    red: number;
  };
}

export interface ExtractedRequirement {
  id: string;
  category:
    | "technical"
    | "management"
    | "past_performance"
    | "pricing"
    | "compliance"
    | "submission_format";
  text: string;
  section_ref: string;
  evaluation_weight: "high" | "medium" | "low";
  readiness_score: "green" | "yellow" | "red";
  matched_evidence_ids: string[];
}

export interface ComplianceMatrixEntry {
  instruction_ref: string;
  instruction_text: string;
  evaluation_ref: string;
  evaluation_text: string;
  mapped_requirements: string[];
}

export interface Ambiguity {
  id: string;
  text: string;
  section_ref: string;
  suggested_question: string;
}

// ---- Service Functions (stubs for Epic 3) ----

/**
 * Analyze an uploaded RFP document.
 */
export async function analyzeRFP(
  solicitationId: string,
  workspaceId: string
): Promise<RFPAnalysisResult> {
  // TODO: Epic 3 implementation
  // 1. Fetch document from Supabase Storage
  // 2. Parse with pdf-parse / mammoth.js
  // 3. Classify federal vs. state/local (Claude Sonnet via Vertex AI)
  // 4. Extract requirements (Claude long-context via Vertex AI)
  // 5. Generate compliance matrix
  // 6. Flag ambiguities
  // 7. Score readiness against knowledge base
  // 8. Optional: Perplexity Sonar for agency intel

  throw new Error("RFP Analyzer not yet implemented — Epic 3");
}
