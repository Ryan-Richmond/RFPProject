import { NextRequest, NextResponse } from "next/server";
import { indexDocument } from "@/services/knowledge-base";
import { getWorkspaceContext } from "@/lib/workspace";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const { supabase, user, workspaceId } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const { data: document } = await supabase
      .from("source_documents")
      .select("id, document_type")
      .eq("id", documentId)
      .eq("workspace_id", workspaceId)
      .single();

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.document_type !== "company") {
      return NextResponse.json(
        { error: "Only company documents can be indexed into the knowledge base" },
        { status: 400 }
      );
    }

    const result = await indexDocument(documentId, workspaceId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Knowledge base index error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to index document",
      },
      { status: 500 }
    );
  }
}
