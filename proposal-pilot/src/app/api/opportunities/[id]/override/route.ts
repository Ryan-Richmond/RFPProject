import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import {
  applyRecommendationOverride,
  clearRecommendationOverride,
} from "@/services/opportunity-scoring/explainability";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, workspaceId } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const recommendation = body.recommendation;
    const reason = typeof body.reason === "string" ? body.reason : undefined;

    if (!["pursue", "monitor", "pass"].includes(recommendation)) {
      return NextResponse.json(
        { error: "Invalid recommendation. Use pursue|monitor|pass." },
        { status: 400 }
      );
    }

    await applyRecommendationOverride({
      workspaceId,
      samOpportunityId: id,
      recommendation,
      reason,
      userId: user.id,
    });

    return NextResponse.json({
      message: "Recommendation override saved",
      workspaceId,
      samOpportunityId: id,
      recommendation,
      reason: reason || null,
    });
  } catch (error) {
    console.error("Override API error", error);
    return NextResponse.json({ error: "Failed to save override" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, workspaceId } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    await clearRecommendationOverride(workspaceId, id);

    return NextResponse.json({
      message: "Recommendation override cleared",
      workspaceId,
      samOpportunityId: id,
    });
  } catch (error) {
    console.error("Override clear API error", error);
    return NextResponse.json({ error: "Failed to clear override" }, { status: 500 });
  }
}
