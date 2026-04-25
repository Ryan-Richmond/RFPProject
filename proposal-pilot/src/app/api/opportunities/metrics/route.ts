import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { getWorkspaceFeedbackMetrics } from "@/services/opportunity-scoring/feedback";

export async function GET(request: NextRequest) {
  try {
    const { user, workspaceId } = await getWorkspaceContext();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const days = Number(request.nextUrl.searchParams.get("days") || "30");
    const metrics = await getWorkspaceFeedbackMetrics(workspaceId, Number.isNaN(days) ? 30 : days);

    return NextResponse.json({ workspaceId, ...metrics });
  } catch (error) {
    console.error("Metrics API error", error);
    return NextResponse.json({ error: "Failed to load feedback metrics" }, { status: 500 });
  }
}
