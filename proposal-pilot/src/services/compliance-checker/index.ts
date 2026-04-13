/**
 * Compliance Checker Service
 *
 * Verifies that every extracted requirement is addressed before export.
 * See AGENTS.md — Skill 4 for full specification.
 */

// ---- Output Types (from AGENTS.md structured JSON) ----

export interface ComplianceCheckResult {
  overall_score: number;
  recommendation: string;
  requirement_status: RequirementStatus[];
  format_issues: FormatIssue[];
}

export interface RequirementStatus {
  id: string;
  status: "addressed" | "partially_addressed" | "weak" | "unaddressed";
  draft_location?: string;
  issue?: string;
  suggestion?: string;
}

export interface FormatIssue {
  issue: string;
  severity: "critical" | "high" | "medium" | "low";
}

// ---- Service Functions (stubs for Epic 5) ----

/**
 * Run a compliance check against the current proposal draft.
 */
export async function checkCompliance(
  proposalId: string,
  workspaceId: string
): Promise<ComplianceCheckResult> {
  // TODO: Epic 5 implementation
  // 1. Fetch extracted requirements
  // 2. Fetch current draft sections
  // 3. For each requirement:
  //    a. Semantic match against draft (Claude + pgvector via Vertex AI)
  //    b. Rate coverage: addressed / partially / weak / unaddressed
  // 4. Check format compliance:
  //    a. Page/word limits
  //    b. Required headings
  //    c. Required attachments
  // 5. Calculate overall score
  // 6. Generate recommendation

  throw new Error("Compliance Checker not yet implemented — Epic 5");
}
