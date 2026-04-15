import { NextRequest, NextResponse } from "next/server";
import { uploadDocument } from "@/services/documents/upload";
import { getWorkspaceContext } from "@/lib/workspace";

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, workspaceId } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const type = request.nextUrl.searchParams.get("type");
    let query = supabase
      .from("source_documents")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (type === "company" || type === "rfp") {
      query = query.eq("document_type", type);
    }

    const { data: documents, error } = await query;

    if (error) {
      throw error;
    }

    const { data: chunks } = await supabase
      .from("evidence_chunks")
      .select("source_document_id")
      .eq("workspace_id", workspaceId);

    const chunkCounts = (chunks || []).reduce<Record<string, number>>(
      (acc, chunk) => {
        acc[chunk.source_document_id] = (acc[chunk.source_document_id] || 0) + 1;
        return acc;
      },
      {}
    );

    return NextResponse.json(
      (documents || []).map((document) => ({
        ...document,
        chunk_count: chunkCounts[document.id] || 0,
      }))
    );
  } catch (error) {
    console.error("Documents GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, workspaceId } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const documentType = formData.get("documentType") || formData.get("type");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (documentType !== "company" && documentType !== "rfp") {
      return NextResponse.json(
        { error: "documentType must be 'company' or 'rfp'" },
        { status: 400 }
      );
    }

    const document = await uploadDocument(file, workspaceId, documentType);

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error("Documents POST error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to upload document",
      },
      { status: 500 }
    );
  }
}
