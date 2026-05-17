/**
 * Proposal Drafter Service
 *
 * Generates grounded first-draft proposals aligned to the solicitation
 * and company evidence. Uses Perplexity Agent API for all AI operations.
 */

import { callAgentAPI } from "@/lib/ai/gemini";
import { createClient } from "@/lib/supabase/server";
import { searchEvidence } from "@/services/knowledge-base";
import { generateOutline, getOutlineSections } from "@/services/proposal-outline";

// ---- Output Types ----

export interface ProposalDraftResult {
  proposal_id: string;
  sections: ProposalSection[];
  unresolved_requirements: string[];
  total_word_count: number;
}

export interface ProposalSection {
  id: string;
  outline_section_id?: string | null;
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
  source_document_id: string;
  source_document_name: string;
  locator: string;
  excerpt: string;
}

function buildLocator(category: string | null | undefined, index: number) {
  const readable = (category || "evidence")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return `${readable} · Excerpt ${index + 1}`;
}

function humanizeCitationsInContent(
  content: string,
  evidence: Array<{
    id: string;
    source_document_name?: string | null;
    source_document_id?: string;
    category?: string | null;
  }>
): string {
  if (!content) return content;

  const labelByEvidenceId = new Map<string, string>();
  evidence.forEach((chunk, index) => {
    const docName =
      chunk.source_document_name?.trim() ||
      (chunk.source_document_id ? `Source ${index + 1}` : `Source ${index + 1}`);
    const categorySuffix = chunk.category
      ? ` § ${chunk.category.replace(/_/g, " ")}`
      : "";
    labelByEvidenceId.set(chunk.id, `${docName}${categorySuffix}`);
  });

  return content.replace(
    /\[\s*Evidence(?:\s*[:#])?\s*([^\]]+?)\s*\]/gi,
    (match, rawId: string) => {
      const id = rawId.trim();
      const label = labelByEvidenceId.get(id);
      if (label) return `[${label}]`;
      const partial = Array.from(labelByEvidenceId.entries()).find(([key]) =>
        key.startsWith(id) || id.startsWith(key)
      );
      if (partial) return `[${partial[1]}]`;
      return "";
    }
  );
}

interface ExistingSectionSnapshot {
  id: string;
  title: string;
  content: string;
  review_status: "pending" | "accepted" | "rejected" | "edited";
  requirement_mappings?: string[] | null;
  placeholders?: string[] | null;
  confidence?: "high" | "medium" | "low" | null;
  outline_section_id?: string | null;
  section_order: number;
}

interface DraftSectionDefinition {
  key: string;
  title: string;
  outlineSectionId?: string | null;
  sectionNumber?: string | null;
  volume?: string | null;
  instructions?: string | null;
  sourceRefs?: string[];
  targetWordCount?: number | null;
  mappedRequirementIds?: string[];
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

  const { data: existingSections } = await supabase
    .from("proposal_sections")
    .select(
      "id, title, content, review_status, requirement_mappings, placeholders, confidence, outline_section_id, section_order"
    )
    .eq("proposal_draft_id", proposalId)
    .eq("workspace_id", workspaceId)
    .order("section_order", { ascending: true });

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

  // 4. Build or load a solicitation-driven outline. Fallback sections keep older
  // proposals draftable if an outline has not been generated yet.
  let outlineSections = await getOutlineSections(proposalId, workspaceId);
  if (outlineSections.length === 0) {
    outlineSections = await generateOutline(proposalId, workspaceId);
  }

  const sectionDefs: DraftSectionDefinition[] = outlineSections.length > 0
    ? outlineSections.map((section) => ({
        key: section.section_type,
        title: section.title,
        outlineSectionId: section.id,
        sectionNumber: section.section_number,
        volume: section.volume,
        instructions: section.instructions,
        sourceRefs: section.source_refs,
        targetWordCount: section.target_word_count,
        mappedRequirementIds: section.mapped_requirement_ids,
      }))
    : [
        { key: "executive_summary", title: "Executive Summary" },
        { key: "technical", title: "Technical Approach" },
        { key: "management", title: "Management Approach" },
        { key: "past_performance", title: "Past Performance" },
      ];

  // 5. Retrieve relevant evidence from knowledge base for each planned section.
  const evidenceBySection: Record<string, Awaited<ReturnType<typeof searchEvidence>>> = {};

  for (const sectionDef of sectionDefs) {
    const mappedIds = sectionDef.mappedRequirementIds || [];
    const sectionReqs = requirements.filter(
      (r) =>
        mappedIds.includes(r.requirement_id) ||
        r.category === sectionDef.key ||
        sectionDef.key === "executive_summary"
    );

    if (sectionReqs.length > 0) {
      const query = [
        sectionDef.title,
        sectionDef.instructions || "",
        sectionReqs.map((r) => r.text).join(" "),
      ]
        .filter(Boolean)
        .join(" ");
      evidenceBySection[sectionDef.title] = await searchEvidence(query, workspaceId, 10);
    }
  }

  // 6. Generate sections via Perplexity Agent API (Claude Opus for highest quality)

  const sections: ProposalSection[] = [];
  const unresolvedRequirements: string[] = [];

  for (const sectionDef of sectionDefs) {
    const sectionReqs = requirements.filter(
      (r) =>
        (sectionDef.mappedRequirementIds || []).includes(r.requirement_id) ||
        r.category === sectionDef.key ||
        sectionDef.key === "executive_summary"
    );

    const evidence = evidenceBySection[sectionDef.title] || [];
    const evidenceContext = evidence
      .map((e, index) => {
        const docLabel =
          e.source_document_name?.trim() || `Source ${index + 1}`;
        const categorySuffix = e.category
          ? ` § ${e.category.replace(/_/g, " ")}`
          : "";
        return `[${docLabel}${categorySuffix}] (id=${e.id}): ${e.content.slice(0, 500)}`;
      })
      .join("\n\n");

    const response = await callAgentAPI(
      {
        input: `Generate the "${sectionDef.title}" section for a government proposal.

SOLICITATION: ${draft.solicitations?.title || "Unknown"}
AGENCY: ${draft.solicitations?.agency || "Unknown"}
${sectionDef.sectionNumber ? `OUTLINE SECTION: ${sectionDef.sectionNumber}` : ""}
${sectionDef.volume ? `VOLUME: ${sectionDef.volume}` : ""}
${sectionDef.targetWordCount ? `TARGET WORD COUNT: ${sectionDef.targetWordCount}` : ""}
${sectionDef.sourceRefs?.length ? `SOURCE REFERENCES: ${sectionDef.sourceRefs.join(", ")}` : ""}
${sectionDef.instructions ? `SECTION INSTRUCTIONS: ${sectionDef.instructions}` : ""}

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
  "content": "Full section text in plain prose paragraphs. Do NOT use markdown headings (no '#' characters) — the section title is rendered separately. Cite evidence inline using the human-readable label shown in brackets above the evidence (e.g., [Past Performance Capability Statement § past performance] or [Smith Past Performance Vol II § technical approach]). NEVER write the raw evidence id. Tag requirement coverage as [Addresses: REQ-XXX].",
  "requirement_mappings": ["REQ-001", ...],
  "placeholders": ["description of any gaps"],
  "confidence": "high" | "medium" | "low"
}`,
        instructions:
          "Write polished, professional proposal prose. No markdown headings or '#' characters anywhere in 'content'. Use the bracketed document label (the part before the parenthesized id=) when citing evidence — never emit the raw id. Mark gaps as [PLACEHOLDER: description]. Do not invent capabilities or past performance not in the evidence. Return ONLY valid JSON.",
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

    const citations: Citation[] = evidence.map((e, index) => ({
      evidence_id: e.id,
      source_document_id: e.source_document_id,
      source_document_name:
        e.source_document_name?.trim() || `Source ${index + 1}`,
      locator: buildLocator(e.category, index),
      excerpt: e.content.slice(0, 200),
    }));

    const polishedContent = humanizeCitationsInContent(
      sectionData.content,
      evidence
    );
    const wordCount = polishedContent.trim().split(/\s+/).length;

    sections.push({
      id: `section_${sectionDef.key}_${sections.length + 1}`,
      outline_section_id: sectionDef.outlineSectionId || null,
      title: sectionDef.title,
      content: polishedContent,
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
  const nextVersion =
    existingSections && existingSections.length > 0
      ? (draft.version || 1) + 1
      : draft.version || 1;

  if (existingSections && existingSections.length > 0) {
    const { error: revisionSnapshotError } = await supabase
      .from("proposal_section_revisions")
      .insert(
        (existingSections as ExistingSectionSnapshot[]).map((section) => ({
          proposal_draft_id: proposalId,
          proposal_section_id: section.id,
          workspace_id: workspaceId,
          actor_type: "system",
          change_type: "superseded",
          section_title: section.title,
          content: section.content,
          review_status: section.review_status,
          metadata: {
            version: draft.version || 1,
            section_order: section.section_order,
            requirement_mappings: section.requirement_mappings || [],
            placeholders: section.placeholders || [],
            confidence: section.confidence || null,
            outline_section_id: section.outline_section_id || null,
            reason: "draft_regenerated",
          },
        }))
      );

    if (revisionSnapshotError) {
      throw revisionSnapshotError;
    }
  }

  // Save to Supabase
  await supabase
    .from("proposal_sections")
    .delete()
    .eq("proposal_draft_id", proposalId);

  await supabase
    .from("proposal_drafts")
    .update({
      status: "draft",
      version: nextVersion,
      total_word_count: totalWordCount,
    })
    .eq("id", proposalId);

  await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    action: existingSections && existingSections.length > 0
      ? "proposal_draft_regenerated"
      : "proposal_draft_generated",
    entity_type: "proposal_draft",
    entity_id: proposalId,
    metadata: {
      version: nextVersion,
      outline_driven: outlineSections.length > 0,
      sections_created: sections.length,
      total_word_count: totalWordCount,
      unresolved_requirements: unresolvedRequirements,
    },
  });

  if (outlineSections.length > 0) {
    await supabase
      .from("proposal_outline_sections")
      .update({ status: "ai_drafted" })
      .eq("proposal_draft_id", proposalId)
      .eq("workspace_id", workspaceId);
  }

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
        outline_section_id: section.outline_section_id || null,
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
          source_document_name: c.source_document_name,
          excerpt: c.excerpt,
        }))
      );
    }

    if (savedSection) {
      await supabase.from("proposal_section_revisions").insert({
        proposal_draft_id: proposalId,
        proposal_section_id: savedSection.id,
        workspace_id: workspaceId,
        actor_type: "ai",
        change_type: "generated",
        section_title: section.title,
        content: section.content,
        review_status: "pending",
        metadata: {
          version: nextVersion,
          section_order: i + 1,
          outline_section_id: section.outline_section_id || null,
          requirement_mappings: section.requirement_mappings,
          placeholders: section.placeholders,
          confidence: section.confidence,
          outline_driven: outlineSections.length > 0,
          citations: section.citations.map((citation) => ({
            evidence_id: citation.evidence_id,
            source_document_id: citation.source_document_id,
            source_document_name: citation.source_document_name,
            locator: citation.locator,
          })),
        },
      });
    }
  }

  return {
    proposal_id: proposalId,
    sections,
    unresolved_requirements: unresolvedRequirements,
    total_word_count: totalWordCount,
  };
}

/**
 * Regenerate a single proposal section, optionally seeded with user-provided
 * project context (e.g. specific details, values for placeholders).
 */
export async function regenerateSection(
  proposalId: string,
  sectionId: string,
  workspaceId: string,
  options: {
    projectContext?: string;
    placeholderValues?: Record<string, string>;
    emphasis?: string;
  }
): Promise<{
  section: {
    id: string;
    title: string;
    content: string;
    confidence: "high" | "medium" | "low";
    placeholders: string[];
    requirement_mappings: string[];
    word_count: number;
  };
}> {
  const supabase = await createClient();

  const { data: section } = await supabase
    .from("proposal_sections")
    .select(
      "id, title, content, review_status, requirement_mappings, placeholders, confidence, outline_section_id, section_order, proposal_draft_id"
    )
    .eq("id", sectionId)
    .eq("proposal_draft_id", proposalId)
    .eq("workspace_id", workspaceId)
    .single();

  if (!section) throw new Error(`Section ${sectionId} not found`);

  const { data: draft } = await supabase
    .from("proposal_drafts")
    .select("*, solicitations(*)")
    .eq("id", proposalId)
    .single();

  if (!draft) throw new Error(`Proposal draft ${proposalId} not found`);

  const { data: requirements } = await supabase
    .from("extracted_requirements")
    .select("*")
    .eq("solicitation_id", draft.solicitation_id);

  const mappedIds: string[] = section.requirement_mappings || [];
  type RequirementRow = { requirement_id: string; text: string };
  const sectionReqs = ((requirements || []) as RequirementRow[]).filter((r) =>
    mappedIds.includes(r.requirement_id)
  );

  let outlineMeta: {
    section_number?: string | null;
    volume?: string | null;
    instructions?: string | null;
    source_refs?: string[] | null;
    target_word_count?: number | null;
  } | null = null;

  if (section.outline_section_id) {
    const { data: outlineRow } = await supabase
      .from("proposal_outline_sections")
      .select(
        "section_number, volume, instructions, source_refs, target_word_count"
      )
      .eq("id", section.outline_section_id)
      .single();
    outlineMeta = outlineRow || null;
  }

  const query = [
    section.title,
    outlineMeta?.instructions || "",
    sectionReqs.map((r) => r.text).join(" "),
    options.projectContext || "",
  ]
    .filter(Boolean)
    .join(" ");

  const evidence = await searchEvidence(query, workspaceId, 10);
  const evidenceContext = evidence
    .map((e, index) => {
      const docLabel = e.source_document_name?.trim() || `Source ${index + 1}`;
      const categorySuffix = e.category
        ? ` § ${e.category.replace(/_/g, " ")}`
        : "";
      return `[${docLabel}${categorySuffix}] (id=${e.id}): ${e.content.slice(0, 500)}`;
    })
    .join("\n\n");

  const placeholderBlock = options.placeholderValues
    ? Object.entries(options.placeholderValues)
        .filter(([, v]) => v && v.trim().length > 0)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n")
    : "";

  const response = await callAgentAPI(
    {
      input: `Regenerate the "${section.title}" section of a government proposal using the user-supplied project details and the existing evidence base.

SOLICITATION: ${draft.solicitations?.title || "Unknown"}
AGENCY: ${draft.solicitations?.agency || "Unknown"}
${outlineMeta?.section_number ? `OUTLINE SECTION: ${outlineMeta.section_number}` : ""}
${outlineMeta?.volume ? `VOLUME: ${outlineMeta.volume}` : ""}
${outlineMeta?.target_word_count ? `TARGET WORD COUNT: ${outlineMeta.target_word_count}` : ""}
${outlineMeta?.source_refs?.length ? `SOURCE REFERENCES: ${outlineMeta.source_refs.join(", ")}` : ""}
${outlineMeta?.instructions ? `SECTION INSTRUCTIONS: ${outlineMeta.instructions}` : ""}

REQUIREMENTS TO ADDRESS:
${sectionReqs.map((r) => `- ${r.requirement_id}: ${r.text}`).join("\n") || "(none mapped)"}

CURRENT DRAFT (for reference — improve, do not regress):
${section.content}

USER-PROVIDED PROJECT DETAILS (use these to replace placeholders and customize the prose):
${options.projectContext?.trim() || "(none provided)"}

${placeholderBlock ? `PLACEHOLDER FILL-INS:\n${placeholderBlock}` : ""}

${options.emphasis ? `EMPHASIS: ${options.emphasis}` : ""}

COMPANY EVIDENCE (from knowledge base):
${evidenceContext || "No evidence available — keep claims general."}

Return JSON:
{
  "content": "Polished prose. No markdown headings or '#' characters. Cite using the bracketed document label shown above the evidence (e.g., [Capability Statement § past performance]). Never emit the raw id. Where user-provided details are given, weave them in naturally. Tag requirement coverage as [Addresses: REQ-XXX].",
  "requirement_mappings": ["REQ-001", ...],
  "placeholders": ["any remaining gaps after user details are applied"],
  "confidence": "high" | "medium" | "low"
}`,
      instructions:
        "Customize the section using the user-provided project details. Replace any [PLACEHOLDER:] markers when those details fill them. Do not invent facts beyond evidence or user input. No markdown headings. Cite by document label, not by id. Return ONLY valid JSON.",
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
    const cleaned = response.outputText
      .replace(/```json?\n?/g, "")
      .replace(/```/g, "")
      .trim();
    sectionData = JSON.parse(cleaned);
  } catch {
    sectionData = {
      content: response.outputText,
      requirement_mappings: mappedIds,
      placeholders: ["Section may need manual review — parsing error"],
      confidence: "low",
    };
  }

  const polishedContent = humanizeCitationsInContent(
    sectionData.content,
    evidence
  );
  const wordCount = polishedContent.trim()
    ? polishedContent.trim().split(/\s+/).length
    : 0;

  // Snapshot previous content
  await supabase.from("proposal_section_revisions").insert({
    proposal_draft_id: proposalId,
    proposal_section_id: section.id,
    workspace_id: workspaceId,
    actor_type: "system",
    change_type: "superseded",
    section_title: section.title,
    content: section.content,
    review_status: section.review_status,
    metadata: {
      section_order: section.section_order,
      requirement_mappings: section.requirement_mappings || [],
      placeholders: section.placeholders || [],
      confidence: section.confidence || null,
      outline_section_id: section.outline_section_id || null,
      reason: "section_regenerated",
    },
  });

  const { error: updateError } = await supabase
    .from("proposal_sections")
    .update({
      content: polishedContent,
      requirement_mappings: sectionData.requirement_mappings,
      placeholders: sectionData.placeholders,
      confidence: sectionData.confidence,
      word_count: wordCount,
      review_status: "pending",
    })
    .eq("id", sectionId);

  if (updateError) throw updateError;

  // Keep proposal_drafts.total_word_count in sync — the proposals list and
  // dashboard read this aggregate, so a single-section regen must refresh it
  // or users see stale totals until a full draft regenerate.
  const { data: allSections } = await supabase
    .from("proposal_sections")
    .select("word_count")
    .eq("proposal_draft_id", proposalId)
    .eq("workspace_id", workspaceId);

  const newTotalWordCount = ((allSections || []) as Array<{
    word_count: number | null;
  }>).reduce((sum, row) => sum + (row.word_count || 0), 0);

  await supabase
    .from("proposal_drafts")
    .update({ total_word_count: newTotalWordCount })
    .eq("id", proposalId)
    .eq("workspace_id", workspaceId);

  // Replace citations
  await supabase
    .from("citations")
    .delete()
    .eq("proposal_section_id", sectionId);

  if (evidence.length > 0) {
    await supabase.from("citations").insert(
      evidence.map((e, index) => ({
        proposal_section_id: sectionId,
        evidence_chunk_id: e.id,
        workspace_id: workspaceId,
        source_document_name:
          e.source_document_name?.trim() || `Source ${index + 1}`,
        excerpt: e.content.slice(0, 200),
      }))
    );
  }

  await supabase.from("proposal_section_revisions").insert({
    proposal_draft_id: proposalId,
    proposal_section_id: section.id,
    workspace_id: workspaceId,
    actor_type: "ai",
    change_type: "generated",
    section_title: section.title,
    content: polishedContent,
    review_status: "pending",
    metadata: {
      section_order: section.section_order,
      requirement_mappings: sectionData.requirement_mappings,
      placeholders: sectionData.placeholders,
      confidence: sectionData.confidence,
      outline_section_id: section.outline_section_id || null,
      reason: "section_regenerated",
      user_context_provided: Boolean(options.projectContext?.trim()),
    },
  });

  await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    action: "proposal_section_regenerated",
    entity_type: "proposal_section",
    entity_id: sectionId,
    metadata: {
      proposal_draft_id: proposalId,
      placeholders_remaining: sectionData.placeholders.length,
      user_context_provided: Boolean(options.projectContext?.trim()),
    },
  });

  return {
    section: {
      id: sectionId,
      title: section.title,
      content: polishedContent,
      confidence: sectionData.confidence,
      placeholders: sectionData.placeholders,
      requirement_mappings: sectionData.requirement_mappings,
      word_count: wordCount,
    },
  };
}
