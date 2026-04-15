import { NextRequest, NextResponse } from "next/server";
import { generateDraft } from "@/services/proposal-drafter";
import { getWorkspaceContext } from "@/lib/workspace";

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

    const body = await request.json().catch(() => ({}));
    const result = await generateDraft(id, workspaceId, {
      win_themes: body.winThemes,
      emphasis: body.emphasis,
    });

    await supabase
      .from("solicitations")
      .update({ status: "draft_ready" })
      .eq("id", proposal.solicitation_id)
      .eq("workspace_id", workspaceId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Proposal draft error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate draft",
      },
      { status: 500 }
    );
  }
}
