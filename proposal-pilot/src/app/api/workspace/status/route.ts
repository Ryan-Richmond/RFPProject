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
      .select("has_completed_onboarding, name")
      .eq("id", workspaceId)
      .single();

    const { data: profile, count: profileCount } = await supabase
      .from("client_profiles")
      .select("company_name", { count: "exact" })
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    return NextResponse.json({
      hasCompletedOnboarding: workspace?.has_completed_onboarding ?? false,
      hasProfile: (profileCount ?? 0) > 0,
      workspaceName: workspace?.name ?? null,
      companyName: profile?.company_name ?? null,
    });
  } catch (error) {
    console.error("Failed to fetch workspace status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch status" },
      { status: 500 }
    );
  }
}
