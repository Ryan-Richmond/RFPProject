/**
 * Proposal Drafter Service
 *
 * Generates grounded first-draft proposals aligned to the solicitation
 * and company evidence. Uses Perplexity Agent API for all AI operations.
 */

import { callAgentAPI } from "@/lib/ai/perplexity";
import { createClient } from "@/lib/supabase/server";
import { searchEvidence } from "@/services/knowledge-base";

// ---- Output Types ----

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

// ---- Service Functions ----

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
  const supabase = await createClient();

  // 1. Fetch the proposal draft and its solicitation
  const { data: draft } = await supabase
    .from("proposal_drafts")
    .select("*, solicitations(*)")
    .eq("id", proposalId)
    .single();

  if (!draft) throw new Error(`Proposal draft ${proposalId} not found`);

  // 2. Fetch requirements
  const { data: requirements } = await supabase
    .from("extracted_requirements")
    .select("*")
    .eq("solicitation_id", draft.solicitation_id);

  if (!requirements || requirements.length === 0) {
    throw new Error("No requirements found. Run RFP analysis first.");
  }

  // 3. Fetch compliance matrix
  const { data: complianceMatrix } = await supabase
    .from("compliance_matrix_entries")
    .select("*")
    .eq("solicitation_id", draft.solicitation_id);

  // 4. Retrieve relevant evidence from knowledge base
  const evidenceBySection: Record<string, Awaited<ReturnType<typeof searchEvidence>>> = {};

  const sectionTypes = ["technical", "management", "past_performance"] as const;
  for (const sectionType of sectionTypes) {
    const sectionReqs = requirements.filter((r) => r.category === sectionType);
    if (sectionReqs.length > 0) {
      const query = sectionReqs.map((r) => r.text).join(" ");
      evidenceBySection[sectionType] = await searchEvidence(query, workspaceId, 10);
    }
  }

  // 5. Generate sections via Perplexity Agent API (Claude Opus for highest quality)
  const sectionDefs = [
    { key: "executive_summary", title: "Executive Summary" },
    { key: "technical", title: "Technical Approach" },
    { key: "management", title: "Management Approach" },
    { key: "past_performance", title: "Past Performance" },
  ];

  const sections: ProposalSection[] = [];
  const unresolvedRequirements: string[] = [];

  for (const sectionDef of sectionDefs) {
    const sectionReqs = requirements.filter(
      (r) =>
        r.category === sectionDef.key ||
        (sectionDef.key === "executive_summary")
    );

    const evidence = evidenceBySection[sectionDef.key] || [];
    const evidenceContext = evidence
      .map(
        (e) =>
          `[Evidence ${e.id}] (${e.category}): ${e.content.slice(0, 500)}`
      )
      .join("\n\n");

    const response = await callAgentAPI(
      {
        input: `Generate the "${sectionDef.title}" section for a government proposal.

SOLICITATION: ${draft.solicitations?.title || "Unknown"}
AGENCY: ${draft.solicitations?.agency || "Unknown"}

REQUIREMENTS TO ADDRESS:
${sectionReqs.map((r) => `- ${r.requirement_id}: ${r.text}`).join("\n")}

COMPLIANCE MATRIX:
${(complianceMatrix || [])
  .filter((cm) =>
    cm.mapped_requirements?.some((mr: string) =>
      sectionReqs.some((sr) => sr.requirement_id === mr)
    )
  )
  .map((cm) => `${cm.instruction_ref}: ${cm.instruction_text}`)
  .join("\n")}

COMPANY EVIDENCE (from knowledge base):
${evidenceContext || "No evidence available — use [PLACEHOLDER] markers."}

${options?.win_themes ? `WIN THEMES: ${options.win_themes.join(", ")}` : ""}
${options?.emphasis ? `EMPHASIS: ${options.emphasis}` : ""}

Return JSON:
{
  "content": "full section text with inline citations [Evidence: id] and requirement mappings [Addresses: REQ-XXX]",
  "requirement_mappings": ["REQ-001", ...],
  "placeholders": ["description of any gaps"],
  "confidence": "high" | "medium" | "low"
}`,
        instructions:
          "Write in professional proposal language. Every factual claim must cite an evidence chunk. Mark gaps as [PLACEHOLDER: description]. Do not invent capabilities or past performance not in the evidence. Return ONLY valid JSON.",
        model: "anthropic/claude-opus-4-6",
      },
      { workspaceId, operationType: "drafting" }
    );

    let sectionData: {
      content: string;
      requirement_mappings: string[];
      placeholders: string[];
      confidence: "high" | "medium" | "low";
    };

    try {
      const cleaned = response.outputText.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      sectionData = JSON.parse(cleaned);
    } catch {
      sectionData = {
        content: response.outputText,
        requirement_mappings: sectionReqs.map((r) => r.requirement_id),
        placeholders: ["Section may need manual review — parsing error"],
        confidence: "low",
      };
    }

    const citations: Citation[] = evidence.map((e) => ({
      evidence_id: e.id,
      source_document: e.source_document_id,
      excerpt: e.content.slice(0, 200),
    }));

    const wordCount = sectionData.content.split(/\s+/).length;

    sections.push({
      id: `section_${sectionDef.key}`,
      title: sectionDef.title,
      content: sectionData.content,
      requirement_mappings: sectionData.requirement_mappings,
      citations,
      placeholders: sectionData.placeholders,
      confidence: sectionData.confidence,
      word_count: wordCount,
    });

    if (sectionData.placeholders.length > 0) {
      unresolvedRequirements.push(
        ...sectionData.placeholders.map(
          (p) => `[${sectionDef.title}] ${p}`
        )
      );
    }
  }

  const totalWordCount = sections.reduce((sum, s) => sum + s.word_count, 0);

  // Save to Supabase
  await supabase
    .from("proposal_drafts")
    .update({
      status: "draft",
      total_word_count: totalWordCount,
    })
    .eq("id", proposalId);

  // Save sections
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const { data: savedSection } = await supabase
      .from("proposal_sections")
      .insert({
        proposal_draft_id: proposalId,
        workspace_id: workspaceId,
        title: section.title,
        content: section.content,
        section_order: i + 1,
        requirement_mappings: section.requirement_mappings,
        placeholders: section.placeholders,
        confidence: section.confidence,
        word_count: section.word_count,
      })
      .select("id")
      .single();

    // Save citations for this section
    if (savedSection && section.citations.length > 0) {
      await supabase.from("citations").insert(
        section.citations.map((c) => ({
          proposal_section_id: savedSection.id,
          evidence_chunk_id: c.evidence_id,
          workspace_id: workspaceId,
          source_document_name: c.source_document,
          excerpt: c.excerpt,
        }))
      );
    }
  }

  return {
    proposal_id: proposalId,
    sections,
    unresolved_requirements: unresolvedRequirements,
    total_word_count: totalWordCount,
  };
}
