import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";

export async function GET() {
  try {
    const { supabase, user, workspaceId } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("has_completed_onboarding")
      .eq("id", workspaceId)
      .single();

    const { count: profileCount } = await supabase
      .from("client_profiles")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    return NextResponse.json({
      hasCompletedOnboarding: workspace?.has_completed_onboarding ?? false,
      hasProfile: (profileCount ?? 0) > 0,
    });
  } catch (error) {
    console.error("Failed to fetch workspace status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch status" },
      { status: 500 }
    );
  }
}
