import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";

type ProposalOutcome =
  | "won"
  | "lost"
  | "pending"
  | "no_bid";

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

    const { data: proposal } = await supabase
      .from("proposal_drafts")
      .select("id, solicitation_id")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    const body = await request.json();
    const outcome = body.outcome as ProposalOutcome | undefined;
    const notes = typeof body.notes === "string" ? body.notes : null;
    const contractValue =
      body.contractValue === "" || body.contractValue == null
        ? null
        : Number(body.contractValue);
    const awardDate =
      typeof body.awardDate === "string" && body.awardDate
        ? new Date(body.awardDate).toISOString()
        : null;

    if (!outcome || !["won", "lost", "pending", "no_bid"].includes(outcome)) {
      return NextResponse.json(
        { error: "A valid outcome is required" },
        { status: 400 }
      );
    }

    if (contractValue != null && Number.isNaN(contractValue)) {
      return NextResponse.json(
        { error: "contractValue must be a number" },
        { status: 400 }
      );
    }

    const { data: existing } = await supabase
      .from("proposal_outcomes")
      .select("id")
      .eq("solicitation_id", proposal.solicitation_id)
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const payload = {
      solicitation_id: proposal.solicitation_id,
      workspace_id: workspaceId,
      outcome,
      contract_value: contractValue,
      award_date: awardDate,
      notes,
    };

    const query = existing
      ? supabase
          .from("proposal_outcomes")
          .update(payload)
          .eq("id", existing.id)
      : supabase.from("proposal_outcomes").insert(payload);

    const { error } = await query;

    if (error) {
      throw error;
    }

    await supabase.from("audit_logs").insert({
      workspace_id: workspaceId,
      user_id: user.id === "dev-user" ? null : user.id,
      action: "proposal_outcome_updated",
      entity_type: "proposal_draft",
      entity_id: proposal.id,
      metadata: {
        solicitation_id: proposal.solicitation_id,
        outcome,
        contract_value: contractValue,
        award_date: awardDate,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Proposal outcome error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save proposal outcome",
      },
      { status: 500 }
    );
  }
}
