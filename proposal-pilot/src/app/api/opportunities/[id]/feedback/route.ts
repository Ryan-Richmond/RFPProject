import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { recordOpportunityFeedback } from "@/services/opportunity-scoring/feedback";

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
    const eventType = body.eventType;

    if (
      ![
        "viewed",
        "saved",
        "dismissed",
        "pursued",
        "promoted",
        "override_set",
        "override_cleared",
      ].includes(eventType)
    ) {
      return NextResponse.json({ error: "Invalid eventType" }, { status: 400 });
    }

    await recordOpportunityFeedback({
      workspaceId,
      samOpportunityId: id,
      eventType,
      priorRecommendation: typeof body.priorRecommendation === "string" ? body.priorRecommendation : undefined,
      reasonTag: typeof body.reasonTag === "string" ? body.reasonTag : undefined,
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : undefined,
      actorUserId: user.id,
    });

    return NextResponse.json({ message: "Feedback event recorded" });
  } catch (error) {
    console.error("Feedback API error", error);
    return NextResponse.json({ error: "Failed to record feedback" }, { status: 500 });
  }
}
