/**
 * Compliance Checker Service
 *
 * Verifies that every extracted requirement is addressed before export.
 * Uses Perplexity Agent API for all AI operations.
 */

import { callAgentAPI } from "@/lib/ai/perplexity";
import { createClient } from "@/lib/supabase/server";

// ---- Output Types ----

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

// ---- Service Functions ----

/**
 * Run a compliance check against the current proposal draft.
 */
export async function checkCompliance(
  proposalId: string,
  workspaceId: string
): Promise<ComplianceCheckResult> {
  const supabase = await createClient();

  // 1. Fetch proposal draft and sections
  const { data: draft } = await supabase
    .from("proposal_drafts")
    .select("*, proposal_sections(*), solicitations(*)")
    .eq("id", proposalId)
    .single();

  if (!draft) throw new Error(`Proposal draft ${proposalId} not found`);

  // 2. Fetch extracted requirements
  const { data: requirements } = await supabase
    .from("extracted_requirements")
    .select("*")
    .eq("solicitation_id", draft.solicitation_id);

  if (!requirements || requirements.length === 0) {
    throw new Error("No requirements found. Run RFP analysis first.");
  }

  const sections = draft.proposal_sections || [];
  const sectionTexts = sections
    .map(
      (s: { title: string; content: string }) =>
        `## ${s.title}\n${s.content}`
    )
    .join("\n\n");

  // 3. Call Perplexity Agent API for compliance check
  const response = await callAgentAPI(
    {
      input: `Check this proposal draft against the extracted requirements.

REQUIREMENTS:
${requirements.map((r) => `- ${r.requirement_id} (${r.category}, ${r.evaluation_weight} weight): ${r.text}`).join("\n")}

PROPOSAL DRAFT:
${sectionTexts.slice(0, 80000)}

For each requirement, determine:
1. Is it addressed? (addressed / partially_addressed / weak / unaddressed)
2. Where in the draft? (section and paragraph reference)
3. What's the issue? (if not fully addressed)
4. What's your suggestion? (how to fix)

Also check format compliance:
- Are all section headings present?
- Is content proportional to evaluation weights?
- Are there any format issues?

Return JSON:
{
  "requirement_status": [
    {
      "id": "REQ-001",
      "status": "addressed" | "partially_addressed" | "weak" | "unaddressed",
      "draft_location": "Section X, para Y",
      "issue": "optional issue description",
      "suggestion": "optional suggestion"
    }
  ],
  "format_issues": [
    { "issue": "description", "severity": "critical" | "high" | "medium" | "low" }
  ]
}`,
      instructions:
        "Be thorough and strict. Every requirement must be assessed. Semantic matching, not just keywords. Return ONLY valid JSON.",
      model: "anthropic/claude-sonnet-4-6",
    },
    { workspaceId, operationType: "compliance" }
  );

  let parsed: {
    requirement_status: RequirementStatus[];
    format_issues: FormatIssue[];
  };

  try {
    const cleaned = response.outputText.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = {
      requirement_status: requirements.map((r) => ({
        id: r.requirement_id,
        status: "unaddressed" as const,
        issue: "Unable to perform automated compliance check",
      })),
      format_issues: [
        {
          issue: "Compliance check parsing error — manual review recommended",
          severity: "high" as const,
        },
      ],
    };
  }

  // Calculate overall score
  const total = parsed.requirement_status.length;
  const addressedCount = parsed.requirement_status.filter(
    (r) => r.status === "addressed"
  ).length;
  const partialCount = parsed.requirement_status.filter(
    (r) => r.status === "partially_addressed"
  ).length;

  const overallScore = total > 0
    ? Math.round(((addressedCount + partialCount * 0.5) / total) * 100) / 100
    : 0;

  const criticalIssues = parsed.format_issues.filter(
    (f) => f.severity === "critical"
  ).length;
  const unaddressedCount = parsed.requirement_status.filter(
    (r) => r.status === "unaddressed"
  ).length;

  let recommendation: string;
  if (overallScore >= 0.9 && criticalIssues === 0) {
    recommendation = "PASS — Ready for submission review";
  } else if (overallScore >= 0.75) {
    recommendation = `PASS — ${unaddressedCount + criticalIssues} items need attention`;
  } else {
    recommendation = `FAIL — ${unaddressedCount} requirements unaddressed, ${criticalIssues} critical format issues`;
  }

  const result: ComplianceCheckResult = {
    overall_score: overallScore,
    recommendation,
    requirement_status: parsed.requirement_status,
    format_issues: parsed.format_issues,
  };

  // Save findings to Supabase
  if (parsed.requirement_status.length > 0) {
    await supabase.from("compliance_findings").insert(
      parsed.requirement_status.map((rs) => ({
        proposal_draft_id: proposalId,
        workspace_id: workspaceId,
        requirement_id: rs.id,
        status: rs.status,
        draft_location: rs.draft_location || null,
        issue: rs.issue || null,
        suggestion: rs.suggestion || null,
      }))
    );
  }

  return result;
}
