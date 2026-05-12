import { NextResponse } from "next/server";
import { runFullDiscoveryCycle } from "@/services/opportunity-discovery";
import { enrichTopOpportunitiesWithAI } from "@/services/opportunity-scoring/ai-enrichment";
import { getWorkspaceContext } from "@/lib/workspace";

export async function POST() {
  try {
    const { user, workspaceId } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const result = await runFullDiscoveryCycle(workspaceId);

    // Chain AI enrichment so users immediately see summaries + value estimates
    // for the top results without a second manual step.
    let enrichment: { processed: number; enriched: number; failed: number } | null = null;
    try {
      enrichment = await enrichTopOpportunitiesWithAI(workspaceId, {
        topK: 30,
        minDeterministicScore: 30,
      });
    } catch (err) {
      console.error("Auto-enrichment after discovery failed:", err);
    }

    return NextResponse.json({
      message: "Discovery completed",
      workspaceId,
      ...result,
      enrichment,
    });
  } catch (error) {
    console.error("Discovery API error:", error);
    return NextResponse.json(
      { error: "Failed to start discovery" },
      { status: 500 }
    );
  }
}
