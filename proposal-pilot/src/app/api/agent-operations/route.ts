import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";

export async function GET() {
  try {
    const { supabase, user, workspaceId } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    // Fetch recent agent operations
    const { data: operations, error } = await supabase
      .from("agent_operations")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    // Compute summary stats
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisWeek = (operations || []).filter(
      (op) => new Date(op.created_at) >= weekAgo
    );

    const stats = {
      totalOperations: thisWeek.length,
      discoveryCount: thisWeek.filter((op) => op.operation_type === "discovery").length,
      analysisCount: thisWeek.filter((op) => op.operation_type === "analysis").length,
      draftingCount: thisWeek.filter((op) => op.operation_type === "drafting").length,
      complianceCount: thisWeek.filter((op) => op.operation_type === "compliance").length,
      scoringCount: thisWeek.filter((op) => op.operation_type === "scoring").length,
      runningCount: (operations || []).filter((op) => op.status === "running").length,
    };

    return NextResponse.json({ operations: operations || [], stats });
  } catch (error) {
    console.error("Agent operations API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent operations" },
      { status: 500 }
    );
  }
}
