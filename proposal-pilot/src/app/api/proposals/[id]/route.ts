import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";

type ProposalSectionSummary = {
  section_order?: number | null;
};

type ComplianceFindingSummary = {
  requirement_id?: string | null;
};

export async function GET(
  _request: NextRequest,
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

    const { data: proposal, error } = await supabase
      .from("proposal_drafts")
      .select(
        `
        *,
        solicitations(*, source_documents(*)),
        proposal_sections(*, citations(*)),
        compliance_findings(*)
      `
      )
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();

    if (error || !proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    const solicitationId = proposal.solicitation_id;

    const [{ data: requirements }, { data: complianceMatrix }] = await Promise.all([
      supabase
        .from("extracted_requirements")
        .select("*")
        .eq("solicitation_id", solicitationId)
        .order("created_at", { ascending: true }),
      supabase
        .from("compliance_matrix_entries")
        .select("*")
        .eq("solicitation_id", solicitationId)
        .order("created_at", { ascending: true }),
    ]);

    return NextResponse.json({
      ...proposal,
      proposal_sections: ((proposal.proposal_sections || []) as ProposalSectionSummary[]).sort(
        (a: ProposalSectionSummary, b: ProposalSectionSummary) =>
          (a.section_order || 0) - (b.section_order || 0)
      ),
      compliance_findings: (
        (proposal.compliance_findings || []) as ComplianceFindingSummary[]
      ).sort((a: ComplianceFindingSummary, b: ComplianceFindingSummary) =>
        String(a.requirement_id || "").localeCompare(
          String(b.requirement_id || "")
        )
      ),
      requirements: requirements || [],
      compliance_matrix: complianceMatrix || [],
    });
  } catch (error) {
    console.error("Proposal detail error:", error);
    return NextResponse.json(
      { error: "Failed to fetch proposal" },
      { status: 500 }
    );
  }
}
