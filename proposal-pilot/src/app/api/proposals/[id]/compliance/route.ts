import { NextRequest, NextResponse } from "next/server";
import { checkCompliance } from "@/services/compliance-checker";
import { getWorkspaceContext } from "@/lib/workspace";

export async function POST(
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

    const { data: proposal } = await supabase
      .from("proposal_drafts")
      .select("id")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    const result = await checkCompliance(id, workspaceId);

    await supabase
      .from("proposal_drafts")
      .update({ status: "in_review" })
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Proposal compliance error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to run compliance",
      },
      { status: 500 }
    );
  }
}
