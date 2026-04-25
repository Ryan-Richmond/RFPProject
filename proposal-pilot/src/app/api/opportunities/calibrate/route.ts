import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { runWorkspaceCalibration } from "@/services/opportunity-scoring/feedback";

export async function POST() {
  try {
    const { user, workspaceId } = await getWorkspaceContext();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const result = await runWorkspaceCalibration(workspaceId, user.id);
    return NextResponse.json({
      message: "Calibration run completed",
      workspaceId,
      ...result,
    });
  } catch (error) {
    console.error("Calibration API error", error);
    return NextResponse.json({ error: "Failed to run calibration" }, { status: 500 });
  }
}
