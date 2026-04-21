import { NextResponse } from "next/server";
import { runFullDiscoveryCycle } from "@/services/opportunity-discovery";
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

    return NextResponse.json({
      message: "Discovery completed",
      workspaceId,
      ...result,
    });
  } catch (error) {
    console.error("Discovery API error:", error);
    return NextResponse.json(
      { error: "Failed to start discovery" },
      { status: 500 }
    );
  }
}
