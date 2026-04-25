import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { enrichTopOpportunitiesWithAI } from "@/services/opportunity-scoring/ai-enrichment";
import { snapshotWorkspaceScoreHistory } from "@/services/opportunity-scoring/explainability";

export async function POST(request: NextRequest) {
  try {
    const { user, workspaceId } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const topK = typeof body.topK === "number" ? body.topK : undefined;
    const minDeterministicScore =
      typeof body.minDeterministicScore === "number" ? body.minDeterministicScore : undefined;

    const result = await enrichTopOpportunitiesWithAI(workspaceId, {
      topK,
      minDeterministicScore,
    });

    await snapshotWorkspaceScoreHistory(
      workspaceId,
      "ai_enrichment",
      "AI enrichment run completed"
    );

    return NextResponse.json({
      message: "AI enrichment complete",
      workspaceId,
      ...result,
    });
  } catch (error) {
    console.error("Opportunity enrichment API error", error);
    return NextResponse.json(
      { error: "Failed to enrich opportunities" },
      { status: 500 }
    );
  }
}
