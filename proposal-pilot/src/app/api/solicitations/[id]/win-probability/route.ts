import { NextRequest, NextResponse } from "next/server";
import { estimateWinProbability } from "@/services/rfp-analyzer";
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

    const { data: solicitation } = await supabase
      .from("solicitations")
      .select("id")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();

    if (!solicitation) {
      return NextResponse.json(
        { error: "Solicitation not found" },
        { status: 404 }
      );
    }

    const result = await estimateWinProbability(id, workspaceId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Win probability error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to estimate win probability",
      },
      { status: 500 }
    );
  }
}
