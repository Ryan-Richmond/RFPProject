import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runFullDiscoveryCycle } from "@/services/opportunity-discovery";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's workspace
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    // Run discovery in background (non-blocking response)
    const workspaceId = membership.workspace_id;

    // Start the cycle — don't await for the full run
    runFullDiscoveryCycle(workspaceId).catch((error) => {
      console.error("Discovery cycle failed:", error);
    });

    return NextResponse.json({
      message: "Discovery started",
      workspaceId,
    });
  } catch (error) {
    console.error("Discovery API error:", error);
    return NextResponse.json(
      { error: "Failed to start discovery" },
      { status: 500 }
    );
  }
}
