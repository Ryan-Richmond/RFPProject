import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";

function contentDisposition(filename: string) {
  const asciiName = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  const encodedName = encodeURIComponent(filename);
  return `inline; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;
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

    const { data: document, error: documentError } = await supabase
      .from("source_documents")
      .select("id, workspace_id, filename, file_path, mime_type")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();

    if (documentError || !document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const { data: fileData, error: storageError } = await supabase.storage
      .from("documents")
      .download(document.file_path);

    if (storageError || !fileData) {
      return NextResponse.json(
        { error: storageError?.message || "Failed to open document" },
        { status: 404 }
      );
    }

    return new NextResponse(fileData, {
      headers: {
        "Content-Type": document.mime_type || "application/octet-stream",
        "Content-Disposition": contentDisposition(document.filename),
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    console.error("Document download error:", error);
    return NextResponse.json(
      { error: "Failed to open document" },
      { status: 500 }
    );
  }
}

