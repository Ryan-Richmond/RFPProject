import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";

function deriveTitle(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

export async function POST(request: NextRequest) {
  try {
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

    const { data: existing } = await supabase
      .from("solicitations")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("source_document_id", sourceDocumentId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ solicitation: existing });
    }

    const { data: sourceDocument } = await supabase
      .from("source_documents")
      .select("*")
      .eq("id", sourceDocumentId)
      .eq("workspace_id", workspaceId)
      .single();

    if (!sourceDocument) {
      return NextResponse.json(
        { error: "Source document not found" },
        { status: 404 }
      );
    }

    if (sourceDocument.document_type !== "rfp") {
      return NextResponse.json(
        { error: "Only RFP documents can create solicitations" },
        { status: 400 }
      );
    }

    const { data: solicitation, error } = await supabase
      .from("solicitations")
      .insert({
        workspace_id: workspaceId,
        source_document_id: sourceDocumentId,
        solicitation_number: body.solicitationNumber || null,
        title: body.title || deriveTitle(sourceDocument.filename),
        agency: body.agency || null,
        classification: body.classification || null,
        due_date: body.dueDate || null,
        status: "analyzing",
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ solicitation }, { status: 201 });
  } catch (error) {
    console.error("Solicitations POST error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create solicitation",
      },
      { status: 500 }
    );
  }
}
