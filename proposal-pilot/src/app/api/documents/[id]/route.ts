import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";

export async function DELETE(
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

    const { data: document, error: documentError } = await supabase
      .from("source_documents")
      .select("id, workspace_id, file_path")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();

    if (documentError || !document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const { error: storageError } = await supabase.storage
      .from("documents")
      .remove([document.file_path]);

    if (storageError) {
      console.warn("Document storage delete warning:", storageError.message);
    }

    const { error: deleteError } = await supabase
      .from("source_documents")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ status: "deleted" });
  } catch (error) {
    console.error("Document delete error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete document",
      },
      { status: 500 }
    );
  }
}

