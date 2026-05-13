import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

type ExportMode = "annotated" | "clean" | "review_package";

type ExportOutlineSection = {
  title: string;
  section_number?: string | null;
  volume?: string | null;
  section_type?: string | null;
  section_order?: number | null;
  page_limit?: number | null;
  target_word_count?: number | null;
  evaluation_weight?: string | null;
  instructions?: string | null;
  source_refs?: string[] | null;
  mapped_requirement_ids?: string[] | null;
  status?: string | null;
};

type ExportSection = {
  title: string;
  content: string;
  outline_section_id?: string | null;
  section_order?: number | null;
  requirement_mappings?: string[] | null;
  placeholders?: string[] | null;
  confidence?: string | null;
  review_status?: string | null;
  citations?: Array<{
    source_document_name?: string | null;
    excerpt?: string | null;
  }> | null;
};

type ExportRequirement = {
  requirement_id: string;
  category: string;
  text: string;
  section_ref?: string | null;
  evaluation_weight?: string | null;
  readiness_score?: string | null;
};

type ExportComplianceMatrixEntry = {
  instruction_ref: string;
  instruction_text: string;
  evaluation_ref?: string | null;
  evaluation_text?: string | null;
  mapped_requirements?: string[] | null;
};

type ExportComplianceFinding = {
  requirement_id: string;
  status: string;
  draft_location?: string | null;
  issue?: string | null;
  suggestion?: string | null;
};

type ExportActionItem = {
  title: string;
  description?: string | null;
  source: string;
  requirement_id?: string | null;
  severity: string;
  status: string;
  due_at?: string | null;
};

function stripAnnotations(content: string): string {
  return content
    .replace(/\[Evidence:[^\]]+\]/g, "")
    .replace(/\[Addresses:[^\]]+\]/g, "")
    .replace(/\[PLACEHOLDER:[^\]]+\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function toParagraphs(content: string): Paragraph[] {
  return content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        new Paragraph({
          children: [new TextRun(block)],
          spacing: { after: 180 },
        })
    );
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}

function exportModeLabel(mode: ExportMode): string {
  if (mode === "clean") return "Clean";
  if (mode === "review_package") return "Review Package";
  return "Annotated";
}

function addMetadataParagraph(
  children: Paragraph[],
  label: string,
  value?: string | number | null
) {
  if (value === undefined || value === null || value === "") return;
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: `${label}: `, bold: true }),
        new TextRun(String(value)),
      ],
      spacing: { after: 80 },
    })
  );
}

function addOutlineSectionAppendix(
  children: Paragraph[],
  outlineSections: ExportOutlineSection[]
) {
  if (outlineSections.length === 0) return;

  children.push(
    new Paragraph({
      text: "Approved Annotated Outline",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
    })
  );

  for (const outline of outlineSections) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${outline.section_number ? `${outline.section_number} ` : ""}${outline.title}`,
            bold: true,
          }),
        ],
        spacing: { after: 80 },
      })
    );
    addMetadataParagraph(children, "Type", outline.section_type || "other");
    addMetadataParagraph(children, "Weight", outline.evaluation_weight || "n/a");
    addMetadataParagraph(children, "Status", outline.status || "planned");
    addMetadataParagraph(children, "Target words", outline.target_word_count);
    addMetadataParagraph(children, "Page limit", outline.page_limit);
    addMetadataParagraph(children, "Source refs", outline.source_refs?.join(", "));
    addMetadataParagraph(children, "Mapped requirements", outline.mapped_requirement_ids?.join(", "));

    if (outline.instructions) {
      addMetadataParagraph(children, "Instructions", outline.instructions);
    }
  }
}

function addReviewPackageAppendices(
  children: Paragraph[],
  params: {
    sections: ExportSection[];
    outlineSections: ExportOutlineSection[];
    requirements: ExportRequirement[];
    complianceMatrix: ExportComplianceMatrixEntry[];
    findings: ExportComplianceFinding[];
    actionItems: ExportActionItem[];
  }
) {
  const { sections, outlineSections, requirements, complianceMatrix, findings, actionItems } = params;
  const placeholders = sections.flatMap((section) =>
    (section.placeholders || []).map((placeholder) => ({ section: section.title, placeholder }))
  );
  const lowConfidence = sections.filter((section) => section.confidence === "low");
  const pendingReview = sections.filter((section) => section.review_status !== "accepted");
  const weakFindings = findings.filter((finding) =>
    ["partially_addressed", "weak", "unaddressed"].includes(finding.status)
  );

  children.push(
    new Paragraph({
      text: "Export Readiness Summary",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
    })
  );

  for (const item of [
    `Outline sections: ${outlineSections.length}`,
    `Draft sections: ${sections.length}`,
    `Requirements: ${requirements.length}`,
    `Open placeholders: ${placeholders.length}`,
    `Weak/partial/unaddressed findings: ${weakFindings.length}`,
    `Low-confidence sections: ${lowConfidence.length}`,
    `Sections pending final acceptance: ${pendingReview.length}`,
    `Open action items: ${actionItems.filter((item) => !["resolved", "accepted_risk"].includes(item.status)).length}`,
  ]) {
    children.push(new Paragraph({ text: item, bullet: { level: 0 } }));
  }

  children.push(
    new Paragraph({
      text: "Compliance Matrix Appendix",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
    })
  );

  if (complianceMatrix.length === 0) {
    children.push(new Paragraph({ text: "No compliance matrix entries are available." }));
  } else {
    for (const entry of complianceMatrix) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: entry.instruction_ref, bold: true })],
          spacing: { after: 80 },
        })
      );
      children.push(new Paragraph({ text: entry.instruction_text, spacing: { after: 80 } }));
      addMetadataParagraph(children, "Evaluation", [entry.evaluation_ref, entry.evaluation_text].filter(Boolean).join(" — "));
      addMetadataParagraph(children, "Mapped requirements", entry.mapped_requirements?.join(", "));
    }
  }

  children.push(
    new Paragraph({
      text: "Requirement Coverage Appendix",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
    })
  );

  for (const requirement of requirements) {
    const finding = findings.find((item) => item.requirement_id === requirement.requirement_id);
    const mappedOutline = outlineSections
      .filter((section) => section.mapped_requirement_ids?.includes(requirement.requirement_id))
      .map((section) => section.title)
      .join(", ");
    const mappedDraft = sections
      .filter((section) => section.requirement_mappings?.includes(requirement.requirement_id))
      .map((section) => section.title)
      .join(", ");

    children.push(
      new Paragraph({
        children: [new TextRun({ text: requirement.requirement_id, bold: true })],
        spacing: { before: 120, after: 80 },
      })
    );
    addMetadataParagraph(children, "Category", requirement.category);
    addMetadataParagraph(children, "Source", requirement.section_ref);
    addMetadataParagraph(children, "Weight", requirement.evaluation_weight);
    addMetadataParagraph(children, "Readiness", requirement.readiness_score);
    addMetadataParagraph(children, "Outline section", mappedOutline || "Unmapped");
    addMetadataParagraph(children, "Draft section", mappedDraft || finding?.draft_location || "Unmapped");
    addMetadataParagraph(children, "Compliance status", finding?.status || "Not checked");
    if (finding?.issue) addMetadataParagraph(children, "Issue", finding.issue);
    if (finding?.suggestion) addMetadataParagraph(children, "Suggestion", finding.suggestion);
    children.push(new Paragraph({ text: requirement.text, spacing: { after: 120 } }));
  }


  children.push(
    new Paragraph({
      text: "Action Items Appendix",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
    })
  );

  if (actionItems.length === 0) {
    children.push(new Paragraph({ text: "No action items have been generated." }));
  } else {
    for (const item of actionItems) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: item.title, bold: true })],
          spacing: { before: 120, after: 80 },
        })
      );
      addMetadataParagraph(children, "Status", item.status.replace(/_/g, " "));
      addMetadataParagraph(children, "Severity", item.severity);
      addMetadataParagraph(children, "Source", item.source.replace(/_/g, " "));
      addMetadataParagraph(children, "Requirement", item.requirement_id);
      addMetadataParagraph(children, "Due", item.due_at ? new Date(item.due_at).toLocaleDateString() : null);
      if (item.description) children.push(new Paragraph({ text: item.description, spacing: { after: 80 } }));
    }
  }

  children.push(
    new Paragraph({
      text: "Open Placeholder Appendix",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
    })
  );

  if (placeholders.length === 0) {
    children.push(new Paragraph({ text: "No open placeholders found." }));
  } else {
    for (const item of placeholders) {
      children.push(
        new Paragraph({
          text: `${item.section}: ${item.placeholder}`,
          bullet: { level: 0 },
        })
      );
    }
  }

  children.push(
    new Paragraph({
      text: "Evidence Appendix",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
    })
  );

  const citations = sections.flatMap((section) =>
    (section.citations || []).map((citation) => ({ section: section.title, citation }))
  );

  if (citations.length === 0) {
    children.push(new Paragraph({ text: "No citations found." }));
  } else {
    for (const { section, citation } of citations) {
      const parts = [section, citation.source_document_name || "Evidence chunk", citation.excerpt || ""].filter(Boolean);
      children.push(new Paragraph({ text: parts.join(": "), bullet: { level: 0 } }));
    }
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, user, workspaceId } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const mode = (body.mode === "clean" || body.mode === "review_package"
      ? body.mode
      : "annotated") as ExportMode;

    const { data: proposal, error } = await supabase
      .from("proposal_drafts")
      .select(
        `
        *,
        solicitations(*),
        proposal_sections(*, citations(*)),
        proposal_outline_sections(*),
        compliance_findings(*),
        proposal_action_items(*)
      `
      )
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();

    if (error || !proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    const [{ data: requirements }, { data: complianceMatrix }] = await Promise.all([
      supabase
        .from("extracted_requirements")
        .select("requirement_id, category, text, section_ref, evaluation_weight, readiness_score")
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

    const sections = ((proposal.proposal_sections || []) as ExportSection[]).sort(
      (left, right) => (left.section_order || 0) - (right.section_order || 0)
    );
    const outlineSections = ((proposal.proposal_outline_sections || []) as ExportOutlineSection[]).sort(
      (left, right) => (left.section_order || 0) - (right.section_order || 0)
    );
    const findings = ((proposal.compliance_findings || []) as ExportComplianceFinding[]).sort(
      (left, right) => String(left.requirement_id).localeCompare(String(right.requirement_id))
    );
    const actionItems = ((proposal.proposal_action_items || []) as ExportActionItem[]).sort(
      (left, right) => String(left.status).localeCompare(String(right.status))
    );

    const children: Paragraph[] = [
      new Paragraph({
        text: proposal.solicitations?.title || "Proposal Draft",
        heading: HeadingLevel.TITLE,
        spacing: { after: 240 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Agency: ${proposal.solicitations?.agency || "Unknown"}`,
          }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Classification: ${
              proposal.solicitations?.classification || "unclassified"
            }`,
          }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Export Mode: ${exportModeLabel(mode)}`,
          }),
        ],
        spacing: { after: 240 },
      }),
    ];

    if ((mode === "annotated" || mode === "review_package") && outlineSections.length > 0) {
      addOutlineSectionAppendix(children, outlineSections);
    }

    for (const section of sections) {
      const sectionContent =
        mode === "clean" ? stripAnnotations(section.content) : section.content;

      children.push(
        new Paragraph({
          text: section.title,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
        })
      );

      if (mode !== "clean") {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Confidence: ", bold: true }),
              new TextRun(section.confidence || "unknown"),
              new TextRun({ text: "  |  Review status: ", bold: true }),
              new TextRun(section.review_status || "pending"),
            ],
            spacing: { after: 120 },
          })
        );

        if (section.requirement_mappings?.length) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: "Requirement mappings: ", bold: true }),
                new TextRun(section.requirement_mappings.join(", ")),
              ],
              spacing: { after: 120 },
            })
          );
        }
      }

      children.push(...toParagraphs(sectionContent));

      if (mode !== "clean" && section.placeholders?.length) {
        children.push(
          new Paragraph({
            text: "Open placeholders",
            heading: HeadingLevel.HEADING_2,
          })
        );

        for (const placeholder of section.placeholders) {
          children.push(
            new Paragraph({
              text: placeholder,
              bullet: { level: 0 },
            })
          );
        }
      }

      if (mode !== "clean" && section.citations?.length) {
        children.push(
          new Paragraph({
            text: "Evidence trace",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 180 },
          })
        );

        for (const citation of section.citations) {
          const parts = [
            citation.source_document_name || "Evidence chunk",
            citation.excerpt || "",
          ].filter(Boolean);

          children.push(
            new Paragraph({
              text: parts.join(": "),
              bullet: { level: 0 },
            })
          );
        }
      }
    }

    if (mode === "review_package") {
      addReviewPackageAppendices(children, {
        sections,
        outlineSections,
        requirements: (requirements || []) as ExportRequirement[],
        complianceMatrix: (complianceMatrix || []) as ExportComplianceMatrixEntry[],
        findings,
        actionItems,
      });
    }

    const document = new Document({
      sections: [{ children }],
    });

    const buffer = await Packer.toBuffer(document);
    const filename = sanitizeFilename(
      `${proposal.solicitations?.title || "proposal"}-${mode}.docx`
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Proposal export error:", error);
    return NextResponse.json(
      { error: "Failed to export proposal" },
      { status: 500 }
    );
  }
}
