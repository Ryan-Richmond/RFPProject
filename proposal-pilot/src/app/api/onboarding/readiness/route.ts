import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { getOnboardingReadiness } from "@/services/onboarding/readiness";

export async function GET() {
  try {
    const { user, workspaceId } = await getWorkspaceContext();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    return NextResponse.json(await getOnboardingReadiness(workspaceId));
  } catch (error) {
    console.error("Onboarding readiness error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute readiness" },
      { status: 500 }
    );
  }
}
