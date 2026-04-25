import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { getPilotReadiness } from "@/services/pilot";

export async function GET() {
  try {
    const { user, workspaceId } = await getWorkspaceContext();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!workspaceId) return NextResponse.json({ error: "No workspace found" }, { status: 404 });

    const readiness = await getPilotReadiness(workspaceId);
    return NextResponse.json({ workspaceId, ...readiness });
  } catch (error) {
    console.error("Pilot readiness API error", error);
    return NextResponse.json({ error: "Failed to compute readiness" }, { status: 500 });
  }
}
