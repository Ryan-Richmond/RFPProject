import { createClient } from "@/lib/supabase/server";

export type ActionItemSource =
  | "placeholder"
  | "compliance_finding"
  | "low_confidence"
  | "pending_review"
  | "manual";

export type ActionItemSeverity = "critical" | "high" | "medium" | "low";
export type ActionItemStatus = "open" | "in_progress" | "blocked" | "resolved" | "accepted_risk";

type ProposalSectionRow = {
  id: string;
  outline_section_id?: string | null;
  title: string;
  placeholders?: string[] | null;
  confidence?: "high" | "medium" | "low" | null;
  review_status?: "pending" | "accepted" | "rejected" | "edited" | null;
};

type ComplianceFindingRow = {
  id: string;
  requirement_id: string;
  status: "addressed" | "partially_addressed" | "weak" | "unaddressed";
  draft_location?: string | null;
  issue?: string | null;
  suggestion?: string | null;
};

type ActionItemPayload = {
  proposal_draft_id: string;
  proposal_section_id?: string | null;
  outline_section_id?: string | null;
  workspace_id: string;
  source: ActionItemSource;
  source_key: string;
  requirement_id?: string | null;
  title: string;
  description?: string | null;
  severity: ActionItemSeverity;
};

function severityForFinding(status: ComplianceFindingRow["status"]): ActionItemSeverity {
  if (status === "unaddressed") return "critical";
  if (status === "weak") return "high";
  if (status === "partially_addressed") return "medium";
  return "low";
}

function normalizePlaceholder(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function buildActionItems(params: {
  proposalId: string;
  workspaceId: string;
  sections: ProposalSectionRow[];
  findings: ComplianceFindingRow[];
}): ActionItemPayload[] {
  const { proposalId, workspaceId, sections, findings } = params;
  const items: ActionItemPayload[] = [];

  for (const section of sections) {
    (section.placeholders || []).forEach((placeholder, index) => {
      items.push({
        proposal_draft_id: proposalId,
        proposal_section_id: section.id,
        outline_section_id: section.outline_section_id || null,
        workspace_id: workspaceId,
        source: "placeholder",
        source_key: `placeholder:${section.id}:${index}:${normalizePlaceholder(placeholder)}`,
        title: `Resolve placeholder in ${section.title}`,
        description: placeholder,
        severity: "high",
      });
    });

    if (section.confidence === "low") {
      items.push({
        proposal_draft_id: proposalId,
        proposal_section_id: section.id,
        outline_section_id: section.outline_section_id || null,
        workspace_id: workspaceId,
        source: "low_confidence",
        source_key: `low_confidence:${section.id}`,
        title: `Review low-confidence section: ${section.title}`,
        description: "AI marked this section as low confidence. Confirm evidence, claims, and required details before export.",
        severity: "medium",
      });
    }

    if (section.review_status === "pending") {
      items.push({
        proposal_draft_id: proposalId,
        proposal_section_id: section.id,
        outline_section_id: section.outline_section_id || null,
        workspace_id: workspaceId,
        source: "pending_review",
        source_key: `pending_review:${section.id}`,
        title: `Review section: ${section.title}`,
        description: "This section is still pending human review.",
        severity: "medium",
      });
    }
  }

  for (const finding of findings) {
    if (!["partially_addressed", "weak", "unaddressed"].includes(finding.status)) {
      continue;
    }

    items.push({
      proposal_draft_id: proposalId,
      workspace_id: workspaceId,
      source: "compliance_finding",
      source_key: `compliance_finding:${finding.id}:${finding.status}`,
      requirement_id: finding.requirement_id,
      title: `Fix ${finding.requirement_id}: ${finding.status.replace(/_/g, " ")}`,
      description: [finding.issue, finding.suggestion].filter(Boolean).join("\n\n") || "Compliance finding requires review.",
      severity: severityForFinding(finding.status),
    });
  }

  return items;
}

export async function syncProposalActionItems(proposalId: string, workspaceId: string) {
  const supabase = await createClient();

  const { data: proposal } = await supabase
    .from("proposal_drafts")
    .select("id")
    .eq("id", proposalId)
    .eq("workspace_id", workspaceId)
    .single();

  if (!proposal) throw new Error(`Proposal ${proposalId} not found`);

  const [{ data: sections }, { data: findings }, { data: existing }] = await Promise.all([
    supabase
      .from("proposal_sections")
      .select("id, outline_section_id, title, placeholders, confidence, review_status")
      .eq("proposal_draft_id", proposalId)
      .eq("workspace_id", workspaceId),
    supabase
      .from("compliance_findings")
      .select("id, requirement_id, status, draft_location, issue, suggestion")
      .eq("proposal_draft_id", proposalId)
      .eq("workspace_id", workspaceId),
    supabase
      .from("proposal_action_items")
      .select("id, source_key, status")
      .eq("proposal_draft_id", proposalId)
      .eq("workspace_id", workspaceId),
  ]);

  const generated = buildActionItems({
    proposalId,
    workspaceId,
    sections: (sections || []) as ProposalSectionRow[],
    findings: (findings || []) as ComplianceFindingRow[],
  });
  const generatedKeys = new Set(generated.map((item) => item.source_key));
  const existingRows = (existing || []) as Array<{ id: string; source_key: string; status: ActionItemStatus }>;
  const staleIds = existingRows
    .filter((item) =>
      !generatedKeys.has(item.source_key) &&
      item.status !== "resolved" &&
      item.status !== "accepted_risk"
    )
    .map((item) => item.id);

  if (staleIds.length > 0) {
    await supabase
      .from("proposal_action_items")
      .update({ status: "resolved" })
      .in("id", staleIds)
      .eq("workspace_id", workspaceId);
  }

  if (generated.length > 0) {
    const { error } = await supabase
      .from("proposal_action_items")
      .upsert(generated, { onConflict: "proposal_draft_id,source_key" });
    if (error) throw error;
  }

  return getProposalActionItems(proposalId, workspaceId);
}

export async function getProposalActionItems(proposalId: string, workspaceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proposal_action_items")
    .select("*, proposal_sections(id, title, section_order), proposal_outline_sections(id, title, section_number)")
    .eq("proposal_draft_id", proposalId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function updateProposalActionItem(
  proposalId: string,
  workspaceId: string,
  itemId: string,
  patch: {
    owner_user_id?: string | null;
    status?: ActionItemStatus;
    severity?: ActionItemSeverity;
    due_at?: string | null;
    title?: string;
    description?: string | null;
  }
) {
  const supabase = await createClient();
  const allowed: Record<string, unknown> = {};

  for (const key of ["owner_user_id", "status", "severity", "due_at", "title", "description"] as const) {
    if (key in patch) allowed[key] = patch[key];
  }

  const { data, error } = await supabase
    .from("proposal_action_items")
    .update(allowed)
    .eq("id", itemId)
    .eq("proposal_draft_id", proposalId)
    .eq("workspace_id", workspaceId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
