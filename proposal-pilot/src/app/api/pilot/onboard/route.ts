import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { upsertPilotWorkspace } from "@/services/pilot";

export async function POST(request: NextRequest) {
  try {
    const { user, workspaceId } = await getWorkspaceContext();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!workspaceId) return NextResponse.json({ error: "No workspace found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const status =
      body.status === "onboarding" ||
      body.status === "active" ||
      body.status === "paused" ||
      body.status === "completed"
        ? body.status
        : "onboarding";

    const pilotWorkspace = await upsertPilotWorkspace({
      workspaceId,
      ownerUserId: user.id,
      status,
      kickoffNotes: typeof body.kickoffNotes === "string" ? body.kickoffNotes : undefined,
      successCriteria:
        body.successCriteria && typeof body.successCriteria === "object"
          ? body.successCriteria
          : undefined,
    });

    return NextResponse.json({ message: "Pilot workspace updated", pilotWorkspace });
  } catch (error) {
    console.error("Pilot onboard API error", error);
    return NextResponse.json({ error: "Failed to update pilot workspace" }, { status: 500 });
  }
}
