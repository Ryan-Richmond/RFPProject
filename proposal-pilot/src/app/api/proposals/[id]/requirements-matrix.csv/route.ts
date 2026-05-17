import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";

/**
 * Export the Requirements Matrix as CSV: one row per requirement, with its
 * strongest (or first confirmed) capability match and the draft section that
 * addresses it. Capture managers and reviewers walk this artifact pre-submission.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proposalId } = await params;
    const { supabase, user, workspaceId } = await getWorkspaceContext();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const { data: proposal } = await supabase
      .from("proposal_drafts")
      .select("solicitation_id, solicitations(title, solicitation_number)")
      .eq("id", proposalId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    const { data: requirements } = await supabase
      .from("extracted_requirements")
      .select("id, requirement_id, category, text, section_ref, evaluation_weight, readiness_score")
      .eq("solicitation_id", proposal.solicitation_id)
      .order("requirement_id", { ascending: true });

    const reqs = requirements || [];
    const reqIds = reqs.map((r) => r.id as string);

    const { data: matches } = reqIds.length
      ? await supabase
          .from("requirement_capability_matches")
          .select(
            `id, requirement_id, similarity_score, llm_confidence, llm_justification, status,
             evidence_chunks ( source_document_id )`
          )
          .in("requirement_id", reqIds)
          .order("similarity_score", { ascending: false })
      : { data: [] as Array<{
          requirement_id: string;
          similarity_score: number;
          llm_confidence: string | null;
          llm_justification: string | null;
          status: string;
          evidence_chunks: { source_document_id: string | null } | null;
        }> };

    const matchRows = matches || [];
    const docIds = Array.from(
      new Set(
        matchRows
          .map((m) => (m.evidence_chunks as { source_document_id: string | null } | null)?.source_document_id)
          .filter((d): d is string => typeof d === "string" && d.length > 0)
      )
    );
    const docNameById = new Map<string, string>();
    if (docIds.length > 0) {
      const { data: docs } = await supabase
        .from("source_documents")
        .select("id, filename")
        .in("id", docIds);
      for (const doc of docs || []) {
        if (doc?.id && doc?.filename) {
          docNameById.set(doc.id as string, doc.filename as string);
        }
      }
    }

    const { data: sections } = await supabase
      .from("proposal_sections")
      .select("title, requirement_mappings")
      .eq("proposal_draft_id", proposalId)
      .eq("workspace_id", workspaceId);

    const sectionTitleByReqId = new Map<string, string>();
    for (const section of sections || []) {
      const mappings = (section.requirement_mappings as string[]) || [];
      for (const reqRef of mappings) {
        if (!sectionTitleByReqId.has(reqRef)) {
          sectionTitleByReqId.set(reqRef, section.title as string);
        }
      }
    }

    const lines: string[] = [];
    lines.push(
      [
        "Requirement ID",
        "Category",
        "Requirement Text",
        "RFP Section",
        "Evaluation Weight",
        "Readiness",
        "Top Match Source",
        "Match Confidence",
        "Match Similarity",
        "Match Status",
        "Match Justification",
        "Draft Section",
      ]
        .map(csvCell)
        .join(",")
    );

    for (const req of reqs) {
      const reqMatches = matchRows.filter((m) => m.requirement_id === req.id);
      // Prefer confirmed/overridden, fall back to highest-similarity suggested.
      const preferred =
        reqMatches.find((m) => m.status === "confirmed" || m.status === "overridden") ||
        reqMatches[0] ||
        null;

      const sourceDocId = preferred
        ? (preferred.evidence_chunks as { source_document_id: string | null } | null)?.source_document_id
        : null;
      const matchSource = sourceDocId ? docNameById.get(sourceDocId) || "" : "";
      const draftSection =
        sectionTitleByReqId.get((req.requirement_id as string) || "") || "";

      lines.push(
        [
          req.requirement_id || "",
          req.category || "",
          req.text || "",
          req.section_ref || "",
          req.evaluation_weight || "",
          req.readiness_score || "",
          matchSource,
          preferred?.llm_confidence || "",
          preferred ? preferred.similarity_score.toFixed(3) : "",
          preferred?.status || "",
          preferred?.llm_justification || "",
          draftSection,
        ]
          .map(csvCell)
          .join(",")
      );
    }

    const csv = lines.join("\n");
    const solicitations = proposal.solicitations as
      | { solicitation_number?: string; title?: string }
      | { solicitation_number?: string; title?: string }[]
      | null;
    const sol = Array.isArray(solicitations) ? solicitations[0] : solicitations;
    const fileSlug = (sol?.solicitation_number || sol?.title || "proposal")
      .toString()
      .replace(/[^A-Za-z0-9_-]+/g, "_")
      .slice(0, 60);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="requirements-matrix-${fileSlug}.csv"`,
      },
    });
  } catch (error) {
    console.error("CSV export failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  // Always quote; double-up embedded quotes.
  return `"${s.replace(/"/g, '""')}"`;
}
