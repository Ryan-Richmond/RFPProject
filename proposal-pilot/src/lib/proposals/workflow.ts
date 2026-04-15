export interface ProposalWorkflow {
  id: string;
  status: string;
  total_word_count?: number | null;
  requirements_count: number;
  readiness: {
    green: number;
    yellow: number;
    red: number;
  };
  proposal_sections: Array<{ id: string }>;
  compliance_findings: Array<{
    id: string;
    status: "addressed" | "partially_addressed" | "weak" | "unaddressed";
  }>;
  solicitations: {
    id: string;
    title: string;
    agency?: string | null;
    classification?: string | null;
    due_date?: string | null;
    status: string;
  };
}

export type WorkflowStatus =
  | "analyzing"
  | "analysis_ready"
  | "draft_ready"
  | "in_review"
  | string;

export function getWorkflowStatus(proposal: ProposalWorkflow): WorkflowStatus {
  if (proposal.compliance_findings.length > 0) {
    return "in_review";
  }

  if (proposal.proposal_sections.length > 0) {
    return "draft_ready";
  }

  if (proposal.solicitations.status === "analyzed") {
    return "analysis_ready";
  }

  return proposal.solicitations.status;
}

export function getReadinessTotal(
  readiness: ProposalWorkflow["readiness"]
): number {
  return readiness.green + readiness.yellow + readiness.red;
}

export function formatRelativeDate(date: string): string {
  const value = new Date(date);
  const diffMinutes = Math.floor((Date.now() - value.getTime()) / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
  return value.toLocaleDateString();
}
