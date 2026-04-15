import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";

export async function POST(
  request: NextRequest,
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

    const body = await request.json();
    const sectionId = body.sectionId as string | undefined;
    const content = body.content as string | undefined;
    const reviewStatus = body.reviewStatus as
      | "pending"
      | "accepted"
      | "rejected"
      | "edited"
      | undefined;

    if (!sectionId) {
      return NextResponse.json({ error: "sectionId is required" }, { status: 400 });
    }

    const { data: section } = await supabase
      .from("proposal_sections")
      .select("id")
      .eq("id", sectionId)
      .eq("proposal_draft_id", id)
      .eq("workspace_id", workspaceId)
      .single();

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    const payload: Record<string, unknown> = {};
    if (typeof content === "string") {
      payload.content = content;
      payload.word_count = content.trim() ? content.trim().split(/\s+/).length : 0;
    }
    if (reviewStatus) {
      payload.review_status = reviewStatus;
    }

    const { data: updated, error } = await supabase
      .from("proposal_sections")
      .update(payload)
      .eq("id", sectionId)
      .eq("proposal_draft_id", id)
      .eq("workspace_id", workspaceId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    await supabase
      .from("proposal_drafts")
      .update({ status: "in_review" })
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    return NextResponse.json({ section: updated });
  } catch (error) {
    console.error("Proposal review error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save review",
      },
      { status: 500 }
    );
  }
}
