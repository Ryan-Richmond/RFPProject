import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { updateProposalActionItem } from "@/services/proposal-action-items";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params;
    const { user, workspaceId } = await getWorkspaceContext();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!workspaceId) return NextResponse.json({ error: "No workspace found" }, { status: 404 });

    const body = await request.json();
    const actionItem = await updateProposalActionItem(id, workspaceId, itemId, body.patch || {});
    return NextResponse.json({ actionItem });
  } catch (error) {
    console.error("Action item PATCH error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update action item" },
      { status: 500 }
    );
  }
}
