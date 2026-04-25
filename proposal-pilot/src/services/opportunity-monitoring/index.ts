import { createClient } from "@/lib/supabase/server";

export type PipelineType =
  | "discovery"
  | "deterministic_scoring"
  | "freshness_check"
  | "distribution_snapshot"
  | "quality_check"
  | "ai_enrichment";

export async function logPipelineRun(input: {
  workspaceId: string;
  pipelineType: PipelineType;
  status: "running" | "completed" | "failed";
  durationMs?: number;
  rowsRead?: number;
  rowsWritten?: number;
  retries?: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("pipeline_run_metrics").insert({
    workspace_id: input.workspaceId,
    pipeline_type: input.pipelineType,
    status: input.status,
    duration_ms: input.durationMs ?? null,
    rows_read: input.rowsRead ?? 0,
    rows_written: input.rowsWritten ?? 0,
    retries: input.retries ?? 0,
    error_message: input.errorMessage ?? null,
    metadata: input.metadata ?? {},
    completed_at:
      input.status === "completed" || input.status === "failed"
        ? new Date().toISOString()
        : null,
  });

  if (error) {
    console.error("Failed to log pipeline run metric", error);
  }
}

export async function refreshWorkspaceScoreDistributionSnapshot(workspaceId: string) {
  const supabase = await createClient();
  const { data: scores, error } = await supabase
    .from("sam_opportunity_scores")
    .select("overall_score,recommendation,is_disqualified")
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);

  const rows = scores || [];
  const pursueCount = rows.filter((row) => row.recommendation === "pursue").length;
  const monitorCount = rows.filter((row) => row.recommendation === "monitor").length;
  const passCount = rows.filter((row) => row.recommendation === "pass").length;
  const disqualifiedCount = rows.filter((row) => row.is_disqualified).length;
  const totalCount = rows.length;
  const avgOverallScore =
    totalCount === 0
      ? null
      : Number(
          (rows.reduce((sum, row) => sum + (row.overall_score || 0), 0) / totalCount).toFixed(2)
        );

  const { error: upsertError } = await supabase
    .from("score_distribution_snapshots")
    .upsert(
      {
        workspace_id: workspaceId,
        snapshot_date: new Date().toISOString().slice(0, 10),
        total_count: totalCount,
        pursue_count: pursueCount,
        monitor_count: monitorCount,
        pass_count: passCount,
        disqualified_count: disqualifiedCount,
        avg_overall_score: avgOverallScore,
      },
      { onConflict: "workspace_id,snapshot_date" }
    );

  if (upsertError) throw new Error(upsertError.message);

  return {
    totalCount,
    pursueCount,
    monitorCount,
    passCount,
    disqualifiedCount,
    avgOverallScore,
  };
}

export async function refreshWorkspaceSamQualityReport(workspaceId: string) {
  const supabase = await createClient();
  const { data: opportunities, error } = await supabase
    .from("sam_opportunities")
    .select("naics_code,response_deadline,type_of_set_aside,full_parent_path_name");

  if (error) throw new Error(error.message);

  const rows = opportunities || [];
  const totalRows = rows.length;
  const missingNaicsCount = rows.filter((row) => !(row.naics_code || "").trim()).length;
  const invalidDeadlineCount = rows.filter((row) => {
    if (!row.response_deadline) return false;
    return Number.isNaN(new Date(row.response_deadline).getTime());
  }).length;
  const missingSetAsideCount = rows.filter((row) => !(row.type_of_set_aside || "").trim()).length;
  const missingAgencyCount = rows.filter((row) => !(row.full_parent_path_name || "").trim()).length;

  const { error: upsertError } = await supabase
    .from("sam_data_quality_reports")
    .upsert(
      {
        workspace_id: workspaceId,
        report_date: new Date().toISOString().slice(0, 10),
        total_rows: totalRows,
        missing_naics_count: missingNaicsCount,
        invalid_deadline_count: invalidDeadlineCount,
        missing_set_aside_count: missingSetAsideCount,
        missing_agency_count: missingAgencyCount,
      },
      { onConflict: "workspace_id,report_date" }
    );

  if (upsertError) throw new Error(upsertError.message);

  return {
    totalRows,
    missingNaicsCount,
    invalidDeadlineCount,
    missingSetAsideCount,
    missingAgencyCount,
  };
}

export async function checkWorkspaceFreshness(workspaceId: string, staleHours = 24) {
  const supabase = await createClient();
  const now = Date.now();

  const [{ data: latestScore }, { data: latestSam }] = await Promise.all([
    supabase
      .from("sam_opportunity_scores")
      .select("scored_at")
      .eq("workspace_id", workspaceId)
      .order("scored_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sam_opportunities")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const scoreAgeHours = latestScore?.scored_at
    ? (now - new Date(latestScore.scored_at).getTime()) / (1000 * 60 * 60)
    : null;

  const samAgeHours = latestSam?.updated_at
    ? (now - new Date(latestSam.updated_at).getTime()) / (1000 * 60 * 60)
    : null;

  return {
    staleThresholdHours: staleHours,
    scoreAgeHours,
    samAgeHours,
    isScoreStale: scoreAgeHours === null ? true : scoreAgeHours > staleHours,
    isSamStale: samAgeHours === null ? true : samAgeHours > staleHours,
  };
}
