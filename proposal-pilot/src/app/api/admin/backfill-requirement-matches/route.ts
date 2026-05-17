import { NextResponse } from "next/server";
import { matchRequirementsToCapabilities } from "@/services/requirement-matcher";
import { getWorkspaceContext } from "@/lib/workspace";

/**
 * One-shot backfill: run the requirement-to-capability matcher across every
 * solicitation in the caller's workspace. Idempotent — the matcher wipes and
 * rewrites match rows per requirement.
 *
 * Scoped to the caller's workspace, so any workspace member can trigger it.
 * If we need a cross-workspace admin sweep later, add a service-role variant.
 */
export async function POST() {
  try {
    const { supabase, user, workspaceId } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const { data: solicitations, error } = await supabase
      .from("solicitations")
      .select("id, title, solicitation_number")
      .eq("workspace_id", workspaceId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results: Array<{
      solicitation_id: string;
      title: string;
      ok: boolean;
      error?: string;
      requirements_processed?: number;
      matches_written?: number;
      auto_confirmed?: number;
      readiness_counts?: { green: number; yellow: number; red: number };
    }> = [];

    for (const sol of solicitations || []) {
      try {
        const summary = await matchRequirementsToCapabilities(sol.id, workspaceId);
        results.push({
          solicitation_id: sol.id,
          title: sol.title,
          ok: true,
          ...summary,
        });
      } catch (err) {
        results.push({
          solicitation_id: sol.id,
          title: sol.title,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({
      workspace_id: workspaceId,
      total: results.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    });
  } catch (error) {
    console.error("Backfill error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backfill failed" },
      { status: 500 }
    );
  }
}
