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
      .select(
        "id, title, content, review_status, requirement_mappings, placeholders, confidence, section_order"
      )
      .eq("id", sectionId)
      .eq("proposal_draft_id", id)
      .eq("workspace_id", workspaceId)
      .single();

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    const contentChanged =
      typeof content === "string" && content !== section.content;
    const statusChanged = Boolean(
      reviewStatus && reviewStatus !== section.review_status
    );

    if (!contentChanged && !statusChanged) {
      return NextResponse.json({ section });
    }

    const payload: Record<string, unknown> = {};
    if (contentChanged && typeof content === "string") {
      payload.content = content;
      payload.word_count = content.trim() ? content.trim().split(/\s+/).length : 0;
    }
    if (statusChanged && reviewStatus) {
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

    const actorUserId = user.id === "dev-user" ? null : user.id;
    const changeType = contentChanged
      ? "edited"
      : reviewStatus === "accepted"
      ? "accepted"
      : reviewStatus === "rejected"
      ? "rejected"
      : "edited";

    await supabase.from("proposal_section_revisions").insert({
      proposal_draft_id: id,
      proposal_section_id: updated.id,
      workspace_id: workspaceId,
      actor_type: "user",
      actor_user_id: actorUserId,
      change_type: changeType,
      section_title: updated.title,
      content: updated.content,
      review_status: updated.review_status,
      metadata: {
        previous_review_status: section.review_status,
        previous_word_count: section.content.trim()
          ? section.content.trim().split(/\s+/).length
          : 0,
        section_order: section.section_order,
        requirement_mappings: section.requirement_mappings || [],
        placeholders: section.placeholders || [],
        confidence: section.confidence || null,
      },
    });

    await supabase.from("audit_logs").insert({
      workspace_id: workspaceId,
      user_id: actorUserId,
      action: "proposal_section_review_updated",
      entity_type: "proposal_section",
      entity_id: updated.id,
      metadata: {
        proposal_draft_id: id,
        change_type: changeType,
        previous_review_status: section.review_status,
        next_review_status: updated.review_status,
        content_changed: contentChanged,
      },
    });

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
