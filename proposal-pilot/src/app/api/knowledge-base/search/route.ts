import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { searchEvidence } from "@/services/knowledge-base";

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
    const query = String(body.query || "").trim();
    const limit = Math.min(Math.max(Number(body.limit || 5), 1), 10);

    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const results = await searchEvidence(query, workspaceId, limit);
    const sourceDocumentIds = [...new Set(results.map((result) => result.source_document_id))];

    const { data: sourceDocuments } = sourceDocumentIds.length
      ? await supabase
          .from("source_documents")
          .select("id, filename")
          .in("id", sourceDocumentIds)
      : { data: [] as Array<{ id: string; filename: string }> };

    const filenameById = (sourceDocuments || []).reduce<Record<string, string>>(
      (acc, document) => {
        acc[document.id] = document.filename;
        return acc;
      },
      {}
    );

    return NextResponse.json(
      results.map((result) => ({
        ...result,
        source_document_name:
          filenameById[result.source_document_id] || result.source_document_id,
      }))
    );
  } catch (error) {
    console.error("Knowledge base search error:", error);
    return NextResponse.json(
      { error: "Failed to search knowledge base" },
      { status: 500 }
    );
  }
}
