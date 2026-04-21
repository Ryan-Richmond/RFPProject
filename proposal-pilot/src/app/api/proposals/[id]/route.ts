import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";

type ProposalSectionSummary = {
  id: string;
  title: string;
  section_order?: number | null;
};

type ComplianceFindingSummary = {
  requirement_id?: string | null;
};

type ProposalSectionRevisionSummary = {
  id: string;
  proposal_section_id?: string | null;
  section_title: string;
  actor_type: "ai" | "user" | "system";
  change_type:
    | "generated"
    | "edited"
    | "accepted"
    | "rejected"
    | "superseded";
  review_status?: "pending" | "accepted" | "rejected" | "edited" | null;
  content: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
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

    const [
      { data: requirements },
      { data: complianceMatrix },
      { data: revisions },
      { data: outcome },
    ] = await Promise.all([
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
      supabase
        .from("proposal_section_revisions")
        .select("*")
        .eq("proposal_draft_id", id)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
      supabase
        .from("proposal_outcomes")
        .select("*")
        .eq("solicitation_id", solicitationId)
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const revisionsBySection = ((revisions || []) as ProposalSectionRevisionSummary[]).reduce<
      Record<string, ProposalSectionRevisionSummary[]>
    >((acc, revision) => {
      const key = revision.proposal_section_id || revision.section_title;
      if (!acc[key]) {
        acc[key] = [];
      }

      acc[key].push(revision);
      return acc;
    }, {});

    const sortedSections = ((proposal.proposal_sections || []) as ProposalSectionSummary[])
      .sort(
        (a: ProposalSectionSummary, b: ProposalSectionSummary) =>
          (a.section_order || 0) - (b.section_order || 0)
      )
      .map((section) => ({
        ...section,
        revisions:
          revisionsBySection[section.id] ||
          revisionsBySection[section.title] ||
          [],
      }));

    return NextResponse.json({
      ...proposal,
      proposal_sections: sortedSections,
      compliance_findings: (
        (proposal.compliance_findings || []) as ComplianceFindingSummary[]
      ).sort((a: ComplianceFindingSummary, b: ComplianceFindingSummary) =>
        String(a.requirement_id || "").localeCompare(
          String(b.requirement_id || "")
        )
      ),
      section_revisions: revisions || [],
      proposal_outcome: outcome || null,
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
