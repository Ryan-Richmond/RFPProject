import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user, workspaceId } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));

    if (typeof body.has_completed_onboarding !== "boolean") {
      return NextResponse.json(
        { error: "Invalid payload: has_completed_onboarding must be a boolean" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("workspaces")
      .update({ has_completed_onboarding: body.has_completed_onboarding })
      .eq("id", workspaceId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update onboarding state:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update state" },
      { status: 500 }
    );
  }
}
