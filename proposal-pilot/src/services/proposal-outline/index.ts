/**
 * Proposal Outline Service
 *
 * Converts extracted requirements and compliance matrix rows into an editable,
 * solicitation-driven proposal outline. Draft generation consumes this outline
 * instead of relying on a fixed four-section template whenever outline sections
 * are available.
 */

import { callAgentAPI } from "@/lib/ai/gemini";
import { createClient } from "@/lib/supabase/server";

export type OutlineSectionType =
  | "executive_summary"
  | "technical"
  | "management"
  | "past_performance"
  | "pricing"
  | "resume"
  | "attachment"
  | "form"
  | "compliance"
  | "other";

export type OutlineStatus =
  | "planned"
  | "approved"
  | "ai_drafted"
  | "in_review"
  | "needs_revision"
  | "approved_for_export"
  | "blocked";

export interface ProposalOutlineSection {
  id?: string;
  proposal_draft_id?: string;
  workspace_id?: string;
  parent_section_id?: string | null;
  section_number?: string | null;
  title: string;
  volume?: string | null;
  section_type: OutlineSectionType;
  section_order: number;
  page_limit?: number | null;
  target_word_count?: number | null;
  evaluation_weight?: "high" | "medium" | "low" | null;
  instructions?: string | null;
  source_refs: string[];
  mapped_requirement_ids: string[];
  owner_user_id?: string | null;
  reviewer_user_id?: string | null;
  status: OutlineStatus;
}

type RequirementRow = {
  requirement_id: string;
  category: string;
  text: string;
  section_ref?: string | null;
  evaluation_weight?: "high" | "medium" | "low" | null;
};

type ComplianceMatrixRow = {
  instruction_ref: string;
  instruction_text: string;
  evaluation_ref?: string | null;
  evaluation_text?: string | null;
  mapped_requirements?: string[] | null;
};

function cleanJson(text: string): string {
  return text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
}

function normalizeSectionType(value?: string | null): OutlineSectionType {
  const normalized = (value || "").toLowerCase().replace(/[\s-]+/g, "_");
  const allowed: OutlineSectionType[] = [
    "executive_summary",
    "technical",
    "management",
    "past_performance",
    "pricing",
    "resume",
    "attachment",
    "form",
    "compliance",
    "other",
  ];

  return allowed.includes(normalized as OutlineSectionType)
    ? (normalized as OutlineSectionType)
    : "other";
}

function normalizeWeight(value?: string | null): "high" | "medium" | "low" | null {
  if (value === "high" || value === "medium" || value === "low") return value;
  return null;
}

function sectionTypeForCategory(category: string): OutlineSectionType {
  if (category === "technical") return "technical";
  if (category === "management") return "management";
  if (category === "past_performance") return "past_performance";
  if (category === "pricing") return "pricing";
  if (category === "submission_format" || category === "compliance") return "compliance";
  return "other";
}

function titleForType(type: OutlineSectionType): string {
  switch (type) {
    case "executive_summary":
      return "Executive Summary";
    case "technical":
      return "Technical Approach";
    case "management":
      return "Management Approach";
    case "past_performance":
      return "Past Performance";
    case "pricing":
      return "Price Volume";
    case "compliance":
      return "Compliance and Submission Requirements";
    case "resume":
      return "Key Personnel Resumes";
    case "attachment":
      return "Attachments";
    case "form":
      return "Required Forms";
    default:
      return "Proposal Section";
  }
}

function strongestWeight(requirements: RequirementRow[]): "high" | "medium" | "low" | null {
  if (requirements.some((req) => req.evaluation_weight === "high")) return "high";
  if (requirements.some((req) => req.evaluation_weight === "medium")) return "medium";
  if (requirements.some((req) => req.evaluation_weight === "low")) return "low";
  return null;
}

function fallbackOutline(
  requirements: RequirementRow[],
  complianceMatrix: ComplianceMatrixRow[]
): ProposalOutlineSection[] {
  const sections: ProposalOutlineSection[] = [
    {
      title: "Executive Summary",
      section_type: "executive_summary",
      section_order: 1,
      target_word_count: 800,
      evaluation_weight: "high",
      instructions:
        "Summarize the proposed solution, win themes, evaluator value, and evidence-backed differentiators.",
      source_refs: [],
      mapped_requirement_ids: requirements.map((req) => req.requirement_id),
      status: "approved",
    },
  ];

  const grouped = new Map<OutlineSectionType, RequirementRow[]>();
  for (const requirement of requirements) {
    const type = sectionTypeForCategory(requirement.category);
    grouped.set(type, [...(grouped.get(type) || []), requirement]);
  }

  const typeOrder: OutlineSectionType[] = [
    "technical",
    "management",
    "past_performance",
    "pricing",
    "compliance",
    "other",
  ];

  for (const type of typeOrder) {
    const sectionRequirements = grouped.get(type) || [];
    if (sectionRequirements.length === 0) continue;

    const mappedRequirementIds = sectionRequirements.map((req) => req.requirement_id);
    const relevantMatrix = complianceMatrix.filter((entry) =>
      (entry.mapped_requirements || []).some((id) => mappedRequirementIds.includes(id))
    );
    const sourceRefs = [
      ...sectionRequirements.map((req) => req.section_ref).filter(Boolean),
      ...relevantMatrix.map((entry) => entry.instruction_ref).filter(Boolean),
      ...relevantMatrix.map((entry) => entry.evaluation_ref).filter(Boolean),
    ] as string[];

    sections.push({
      title: titleForType(type),
      section_type: type,
      section_order: sections.length + 1,
      target_word_count: type === "compliance" ? 500 : 1200,
      evaluation_weight: strongestWeight(sectionRequirements),
      instructions: relevantMatrix.length
        ? relevantMatrix
            .map((entry) => `${entry.instruction_ref}: ${entry.instruction_text}`)
            .join("\n")
        : `Address ${sectionRequirements.length} ${type.replace(/_/g, " ")} requirement(s).`,
      source_refs: [...new Set(sourceRefs)],
      mapped_requirement_ids: mappedRequirementIds,
      status: "approved",
    });
  }

  return sections;
}

function normalizeOutline(rawSections: Array<Record<string, unknown>>): ProposalOutlineSection[] {
  return rawSections
    .map((raw, index) => {
      const mappedRequirementIds = Array.isArray(raw.mapped_requirement_ids)
        ? raw.mapped_requirement_ids
        : Array.isArray(raw.mappedRequirementIds)
        ? raw.mappedRequirementIds
        : [];
      const sourceRefs = Array.isArray(raw.source_refs)
        ? raw.source_refs
        : Array.isArray(raw.sourceRefs)
        ? raw.sourceRefs
        : [];

      return {
        parent_section_id: null,
        section_number: (raw.section_number as string) || (raw.sectionNumber as string) || null,
        title: (raw.title as string) || `Proposal Section ${index + 1}`,
        volume: (raw.volume as string) || null,
        section_type: normalizeSectionType(
          (raw.section_type as string) || (raw.sectionType as string)
        ),
        section_order: Number(raw.section_order || raw.sectionOrder || index + 1),
        page_limit:
          raw.page_limit === null || raw.pageLimit === null
            ? null
            : Number(raw.page_limit || raw.pageLimit) || null,
        target_word_count:
          raw.target_word_count === null || raw.targetWordCount === null
            ? null
            : Number(raw.target_word_count || raw.targetWordCount) || null,
        evaluation_weight: normalizeWeight(
          (raw.evaluation_weight as string) || (raw.evaluationWeight as string)
        ),
        instructions: (raw.instructions as string) || null,
        source_refs: sourceRefs.map(String).filter(Boolean),
        mapped_requirement_ids: mappedRequirementIds.map(String).filter(Boolean),
        owner_user_id: null,
        reviewer_user_id: null,
        status: "approved" as const,
      };
    })
    .filter((section) => section.title.trim().length > 0)
    .sort((left, right) => left.section_order - right.section_order)
    .map((section, index) => ({ ...section, section_order: index + 1 }));
}

export async function getOutlineSections(
  proposalId: string,
  workspaceId: string
): Promise<ProposalOutlineSection[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("proposal_outline_sections")
    .select("*")
    .eq("proposal_draft_id", proposalId)
    .eq("workspace_id", workspaceId)
    .order("section_order", { ascending: true });

  return (data || []) as ProposalOutlineSection[];
}

export async function generateOutline(
  proposalId: string,
  workspaceId: string,
  options?: { regenerate?: boolean }
): Promise<ProposalOutlineSection[]> {
  const supabase = await createClient();

  const { data: proposal } = await supabase
    .from("proposal_drafts")
    .select("id, solicitation_id, solicitations(title, agency, classification)")
    .eq("id", proposalId)
    .eq("workspace_id", workspaceId)
    .single();

  if (!proposal) throw new Error(`Proposal ${proposalId} not found`);

  if (!options?.regenerate) {
    const existing = await getOutlineSections(proposalId, workspaceId);
    if (existing.length > 0) return existing;
  }

  const [{ data: requirements }, { data: complianceMatrix }] = await Promise.all([
    supabase
      .from("extracted_requirements")
      .select("requirement_id, category, text, section_ref, evaluation_weight")
      .eq("solicitation_id", proposal.solicitation_id)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true }),
    supabase
      .from("compliance_matrix_entries")
      .select("instruction_ref, instruction_text, evaluation_ref, evaluation_text, mapped_requirements")
      .eq("solicitation_id", proposal.solicitation_id)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true }),
  ]);

  const requirementRows = (requirements || []) as RequirementRow[];
  const matrixRows = (complianceMatrix || []) as ComplianceMatrixRow[];

  if (requirementRows.length === 0) {
    throw new Error("No requirements found. Run RFP analysis before generating an outline.");
  }

  let outline = fallbackOutline(requirementRows, matrixRows);

  const solicitation = Array.isArray(proposal.solicitations)
    ? proposal.solicitations[0]
    : proposal.solicitations;

  const response = await callAgentAPI(
    {
      input: `Generate an annotated proposal outline for this government proposal.

SOLICITATION: ${solicitation?.title || "Unknown"}
AGENCY: ${solicitation?.agency || "Unknown"}
CLASSIFICATION: ${solicitation?.classification || "unclassified"}

REQUIREMENTS:
${requirementRows
  .map(
    (req) =>
      `- ${req.requirement_id} (${req.category}, ${req.evaluation_weight || "medium"}, ${req.section_ref || "no section ref"}): ${req.text}`
  )
  .join("\n")}

COMPLIANCE MATRIX:
${matrixRows
  .map(
    (entry) =>
      `- ${entry.instruction_ref}: ${entry.instruction_text} | Evaluation: ${entry.evaluation_ref || "n/a"} ${entry.evaluation_text || ""} | Requirements: ${(entry.mapped_requirements || []).join(", ")}`
  )
  .join("\n")}

Return JSON array only. Each object must include:
{
  "section_number": "1.0",
  "title": string,
  "volume": string | null,
  "section_type": "executive_summary" | "technical" | "management" | "past_performance" | "pricing" | "resume" | "attachment" | "form" | "compliance" | "other",
  "section_order": number,
  "page_limit": number | null,
  "target_word_count": number | null,
  "evaluation_weight": "high" | "medium" | "low" | null,
  "instructions": string,
  "source_refs": string[],
  "mapped_requirement_ids": string[]
}`,
      instructions:
        "You are a GovCon proposal manager. Build a practical, evaluator-aligned outline. Include an executive summary, preserve required volumes/sections when implied, map every requirement at least once, and keep sections granular enough for owner assignment. Return ONLY valid JSON.",
      model: "anthropic/claude-sonnet-4-6",
    },
    { workspaceId, operationType: "outline" }
  );

  try {
    const parsed = JSON.parse(cleanJson(response.outputText));
    const normalized = normalizeOutline(Array.isArray(parsed) ? parsed : [parsed]);
    if (normalized.length > 0) outline = normalized;
  } catch {
    // Keep deterministic fallback when the model response cannot be parsed.
  }

  await supabase
    .from("proposal_outline_sections")
    .delete()
    .eq("proposal_draft_id", proposalId)
    .eq("workspace_id", workspaceId);

  const { data: saved, error } = await supabase
    .from("proposal_outline_sections")
    .insert(
      outline.map((section) => ({
        proposal_draft_id: proposalId,
        workspace_id: workspaceId,
        parent_section_id: section.parent_section_id || null,
        section_number: section.section_number || null,
        title: section.title,
        volume: section.volume || null,
        section_type: section.section_type,
        section_order: section.section_order,
        page_limit: section.page_limit || null,
        target_word_count: section.target_word_count || null,
        evaluation_weight: section.evaluation_weight || null,
        instructions: section.instructions || null,
        source_refs: section.source_refs || [],
        mapped_requirement_ids: section.mapped_requirement_ids || [],
        owner_user_id: null,
        reviewer_user_id: null,
        status: section.status || "approved",
      }))
    )
    .select("*")
    .order("section_order", { ascending: true });

  if (error) throw error;

  await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    action: options?.regenerate ? "proposal_outline_regenerated" : "proposal_outline_generated",
    entity_type: "proposal_draft",
    entity_id: proposalId,
    metadata: {
      sections_created: saved?.length || 0,
      mapped_requirements: [...new Set(outline.flatMap((section) => section.mapped_requirement_ids))],
    },
  });

  return (saved || []) as ProposalOutlineSection[];
}

export async function updateOutlineSection(
  proposalId: string,
  workspaceId: string,
  sectionId: string,
  patch: Partial<ProposalOutlineSection>
): Promise<ProposalOutlineSection> {
  const supabase = await createClient();
  const allowedPatch: Record<string, unknown> = {};

  for (const key of [
    "section_number",
    "title",
    "volume",
    "section_type",
    "section_order",
    "page_limit",
    "target_word_count",
    "evaluation_weight",
    "instructions",
    "source_refs",
    "mapped_requirement_ids",
    "owner_user_id",
    "reviewer_user_id",
    "status",
  ] as const) {
    if (key in patch) allowedPatch[key] = patch[key];
  }

  if (typeof allowedPatch.section_type === "string") {
    allowedPatch.section_type = normalizeSectionType(allowedPatch.section_type);
  }
  if (typeof allowedPatch.evaluation_weight === "string") {
    allowedPatch.evaluation_weight = normalizeWeight(allowedPatch.evaluation_weight);
  }

  const { data, error } = await supabase
    .from("proposal_outline_sections")
    .update(allowedPatch)
    .eq("id", sectionId)
    .eq("proposal_draft_id", proposalId)
    .eq("workspace_id", workspaceId)
    .select("*")
    .single();

  if (error) throw error;
  return data as ProposalOutlineSection;
}
