import { createClient } from "@/lib/supabase/server";

export async function snapshotWorkspaceScoreHistory(
  workspaceId: string,
  source: "deterministic" | "ai_enrichment",
  changeReason?: string
) {
  const supabase = await createClient();
  const { data: scores, error } = await supabase
    .from("sam_opportunity_scores")
    .select("sam_opportunity_id,overall_score,recommendation,ai_overall_score,ai_recommendation")
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);

  const rows = (scores || []).map((row) => ({
    workspace_id: workspaceId,
    sam_opportunity_id: row.sam_opportunity_id,
    change_source: source,
    overall_score: row.overall_score,
    recommendation: row.recommendation,
    ai_overall_score: row.ai_overall_score,
    ai_recommendation: row.ai_recommendation,
    change_reason: changeReason || null,
  }));

  if (rows.length === 0) return 0;

  const { error: insertError } = await supabase
    .from("sam_opportunity_score_history")
    .insert(rows);

  if (insertError) throw new Error(insertError.message);
  return rows.length;
}

export async function applyRecommendationOverride(input: {
  workspaceId: string;
  samOpportunityId: string;
  recommendation: "pursue" | "monitor" | "pass";
  reason?: string;
  userId?: string;
}) {
  const supabase = await createClient();

  const { error: overrideError } = await supabase
    .from("sam_opportunity_recommendation_overrides")
    .upsert(
      {
        workspace_id: input.workspaceId,
        sam_opportunity_id: input.samOpportunityId,
        override_recommendation: input.recommendation,
        override_reason: input.reason || null,
        override_by: input.userId || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,sam_opportunity_id" }
    );

  if (overrideError) throw new Error(overrideError.message);

  const { data: score } = await supabase
    .from("sam_opportunity_scores")
    .select("overall_score,ai_overall_score,ai_recommendation")
    .eq("workspace_id", input.workspaceId)
    .eq("sam_opportunity_id", input.samOpportunityId)
    .maybeSingle();

  await supabase.from("sam_opportunity_score_history").insert({
    workspace_id: input.workspaceId,
    sam_opportunity_id: input.samOpportunityId,
    change_source: "manual_override",
    overall_score: score?.overall_score || null,
    recommendation: input.recommendation,
    ai_overall_score: score?.ai_overall_score || null,
    ai_recommendation: score?.ai_recommendation || null,
    change_reason: input.reason || null,
    metadata: {
      overridden_by: input.userId || null,
    },
  });
}

export async function clearRecommendationOverride(workspaceId: string, samOpportunityId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("sam_opportunity_recommendation_overrides")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("sam_opportunity_id", samOpportunityId);

  if (error) throw new Error(error.message);
}

export async function getRecommendationOverride(workspaceId: string, samOpportunityId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sam_opportunity_recommendation_overrides")
    .select("override_recommendation,override_reason,override_by,updated_at")
    .eq("workspace_id", workspaceId)
    .eq("sam_opportunity_id", samOpportunityId)
    .maybeSingle();

  return data || null;
}

export async function getOpportunityScoreTimeline(
  workspaceId: string,
  samOpportunityId: string,
  limit = 10
) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sam_opportunity_score_history")
    .select(
      "change_source,overall_score,recommendation,ai_overall_score,ai_recommendation,change_reason,metadata,created_at"
    )
    .eq("workspace_id", workspaceId)
    .eq("sam_opportunity_id", samOpportunityId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return data || [];
}

export function resolveRecommendationWithOverride(
  baseRecommendation: string,
  override: { override_recommendation: string } | null
) {
  return override?.override_recommendation || baseRecommendation;
}
