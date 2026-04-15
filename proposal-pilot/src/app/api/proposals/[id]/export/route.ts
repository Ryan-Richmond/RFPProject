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

type ExportMode = "annotated" | "clean";

type ExportSection = {
  title: string;
  content: string;
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
    const mode = (body.mode === "clean" ? "clean" : "annotated") as ExportMode;

    const { data: proposal, error } = await supabase
      .from("proposal_drafts")
      .select(
        `
        *,
        solicitations(*),
        proposal_sections(*, citations(*))
      `
      )
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();

    if (error || !proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    const sections = ((proposal.proposal_sections || []) as ExportSection[]).sort(
      (left, right) => (left.section_order || 0) - (right.section_order || 0)
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
            text: `Export Mode: ${mode === "clean" ? "Clean" : "Annotated"}`,
          }),
        ],
        spacing: { after: 240 },
      }),
    ];

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

      if (mode === "annotated") {
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

      if (mode === "annotated" && section.placeholders?.length) {
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

      if (mode === "annotated" && section.citations?.length) {
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
