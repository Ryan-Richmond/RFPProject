import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import {
  getProposalActionItems,
  syncProposalActionItems,
} from "@/services/proposal-action-items";

async function verifyProposal(id: string, workspaceId: string) {
  const { supabase } = await getWorkspaceContext();
  const { data } = await supabase
    .from("proposal_drafts")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();
  return data;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, workspaceId } = await getWorkspaceContext();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!workspaceId) return NextResponse.json({ error: "No workspace found" }, { status: 404 });

    const proposal = await verifyProposal(id, workspaceId);
    if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });

    const actionItems = await getProposalActionItems(id, workspaceId);
    return NextResponse.json({ actionItems });
  } catch (error) {
    console.error("Action items GET error:", error);
    return NextResponse.json({ error: "Failed to fetch action items" }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, workspaceId } = await getWorkspaceContext();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!workspaceId) return NextResponse.json({ error: "No workspace found" }, { status: 404 });

    const proposal = await verifyProposal(id, workspaceId);
    if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });

    const actionItems = await syncProposalActionItems(id, workspaceId);
    return NextResponse.json({ actionItems });
  } catch (error) {
    console.error("Action items sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync action items" },
      { status: 500 }
    );
  }
}
