import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";

type MatchStatus = "suggested" | "confirmed" | "overridden" | "rejected";

const VALID_STATUSES: MatchStatus[] = [
  "suggested",
  "confirmed",
  "overridden",
  "rejected",
];

/**
 * Update the status of a requirement→capability match row. Used by the
 * Requirements Matrix UI to confirm, reject, or override a suggestion.
 *
 * Also keeps the denormalized cache on `extracted_requirements.matched_evidence_ids`
 * in sync: confirmed/overridden IDs are in the cache; suggested/rejected are not.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  try {
    const { id: proposalId, matchId } = await params;
    const { supabase, user, workspaceId } = await getWorkspaceContext();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!workspaceId) return NextResponse.json({ error: "No workspace found" }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as { status?: string };
    const status = body.status as MatchStatus | undefined;
    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    // Confirm the match belongs to this workspace and to this proposal's solicitation.
    const { data: proposal } = await supabase
      .from("proposal_drafts")
      .select("solicitation_id")
      .eq("id", proposalId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    const { data: match } = await supabase
      .from("requirement_capability_matches")
      .select(
        "id, requirement_id, evidence_chunk_id, workspace_id, extracted_requirements!inner(solicitation_id)"
      )
      .eq("id", matchId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const linkedRequirement = match.extracted_requirements as unknown as
      | { solicitation_id: string }
      | { solicitation_id: string }[]
      | null;
    const solicitationOnMatch = Array.isArray(linkedRequirement)
      ? linkedRequirement[0]?.solicitation_id
      : linkedRequirement?.solicitation_id;
    if (solicitationOnMatch !== proposal.solicitation_id) {
      return NextResponse.json(
        { error: "Match does not belong to this proposal's solicitation" },
        { status: 403 }
      );
    }

    const { error: updateError } = await supabase
      .from("requirement_capability_matches")
      .update({
        status,
        overridden_by: status === "overridden" ? user.id : null,
      })
      .eq("id", matchId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Refresh the matched_evidence_ids cache on the parent requirement so the
    // Analysis tab and any list views stay accurate.
    const { data: confirmedRows } = await supabase
      .from("requirement_capability_matches")
      .select("evidence_chunk_id")
      .eq("requirement_id", match.requirement_id)
      .in("status", ["confirmed", "overridden"]);

    await supabase
      .from("extracted_requirements")
      .update({
        matched_evidence_ids: (confirmedRows || []).map(
          (r) => r.evidence_chunk_id as string
        ),
      })
      .eq("id", match.requirement_id);

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    console.error("Match status PATCH failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
