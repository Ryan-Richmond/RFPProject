import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";

export async function PATCH(
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
    const sourceDocumentId = body.sourceDocumentId as string | undefined;
    if (!sourceDocumentId) {
      return NextResponse.json(
        { error: "sourceDocumentId is required" },
        { status: 400 }
      );
    }

    const { data: doc } = await supabase
      .from("source_documents")
      .select("id, document_type, workspace_id")
      .eq("id", sourceDocumentId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!doc) {
      return NextResponse.json(
        { error: "Source document not found" },
        { status: 404 }
      );
    }
    if (doc.document_type !== "rfp") {
      return NextResponse.json(
        { error: "Only RFP documents can be attached to a solicitation" },
        { status: 400 }
      );
    }

    const { data: updated, error } = await supabase
      .from("solicitations")
      .update({ source_document_id: sourceDocumentId, status: "analyzing" })
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .select("*")
      .single();

    if (error || !updated) {
      return NextResponse.json(
        { error: error?.message || "Solicitation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ solicitation: updated });
  } catch (error) {
    console.error("Solicitation PATCH error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}

export async function GET(
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

    const { data: solicitation, error } = await supabase
      .from("solicitations")
      .select("*, source_documents(*)")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();

    if (error || !solicitation) {
      return NextResponse.json(
        { error: "Solicitation not found" },
        { status: 404 }
      );
    }

    const [{ data: requirements }, { data: complianceMatrix }] = await Promise.all([
      supabase
        .from("extracted_requirements")
        .select("*")
        .eq("solicitation_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("compliance_matrix_entries")
        .select("*")
        .eq("solicitation_id", id)
        .order("created_at", { ascending: true }),
    ]);

    return NextResponse.json({
      ...solicitation,
      requirements: requirements || [],
      compliance_matrix: complianceMatrix || [],
    });
  } catch (error) {
    console.error("Solicitations GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch solicitation" },
      { status: 500 }
    );
  }
}
