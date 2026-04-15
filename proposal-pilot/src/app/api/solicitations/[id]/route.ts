import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";

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
