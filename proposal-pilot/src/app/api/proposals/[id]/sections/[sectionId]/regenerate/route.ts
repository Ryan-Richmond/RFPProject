import { NextRequest, NextResponse } from "next/server";
import { regenerateSection } from "@/services/proposal-drafter";
import { getWorkspaceContext } from "@/lib/workspace";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    const { id, sectionId } = await params;
    const { supabase, user, workspaceId } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const { data: proposal } = await supabase
      .from("proposal_drafts")
      .select("id")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const projectContext =
      typeof body.projectContext === "string" ? body.projectContext : undefined;
    const emphasis =
      typeof body.emphasis === "string" ? body.emphasis : undefined;
    const placeholderValues =
      body.placeholderValues && typeof body.placeholderValues === "object"
        ? (body.placeholderValues as Record<string, string>)
        : undefined;

    const result = await regenerateSection(id, sectionId, workspaceId, {
      projectContext,
      placeholderValues,
      emphasis,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Section regenerate error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to regenerate section",
      },
      { status: 500 }
    );
  }
}
