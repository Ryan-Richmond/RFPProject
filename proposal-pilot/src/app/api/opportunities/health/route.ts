import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import {
  checkWorkspaceFreshness,
  refreshWorkspaceSamQualityReport,
  refreshWorkspaceScoreDistributionSnapshot,
} from "@/services/opportunity-monitoring";

export async function GET() {
  try {
    const { user, workspaceId } = await getWorkspaceContext();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const [freshness, distributionSnapshot, qualityReport] = await Promise.all([
      checkWorkspaceFreshness(workspaceId),
      refreshWorkspaceScoreDistributionSnapshot(workspaceId),
      refreshWorkspaceSamQualityReport(workspaceId),
    ]);

    const supabase = await createClient();
    const { data: recentRuns } = await supabase
      .from("pipeline_run_metrics")
      .select("pipeline_type,status,duration_ms,rows_read,rows_written,error_message,started_at")
      .eq("workspace_id", workspaceId)
      .order("started_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      workspaceId,
      freshness,
      distributionSnapshot,
      qualityReport,
      recentRuns: recentRuns || [],
    });
  } catch (error) {
    console.error("Opportunity health API error", error);
    return NextResponse.json(
      { error: "Failed to load opportunity pipeline health" },
      { status: 500 }
    );
  }
}
