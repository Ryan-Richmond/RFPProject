import { NextRequest, NextResponse } from "next/server";
import { analyzeRFP } from "@/services/rfp-analyzer";
import { getWorkspaceContext } from "@/lib/workspace";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, user, workspaceId } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const { data: solicitation } = await supabase
      .from("solicitations")
      .select("id")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();

    if (!solicitation) {
      return NextResponse.json(
        { error: "Solicitation not found" },
        { status: 404 }
      );
    }

    const analysis = await analyzeRFP(id, workspaceId);

    await supabase
      .from("solicitations")
      .update({ status: "analyzed" })
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Solicitation analyze error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to analyze solicitation",
      },
      { status: 500 }
    );
  }
}
