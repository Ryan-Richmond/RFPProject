import { createClient } from "@/lib/supabase/server";
import { getWorkspaceFeedbackMetrics } from "@/services/opportunity-scoring/feedback";

export async function getPilotReadiness(workspaceId: string) {
  const supabase = await createClient();

  const [{ data: profile }, { count: evidenceCount }, { count: scoreCount }, { count: pursueCount }] =
    await Promise.all([
      supabase
        .from("client_profiles")
        .select("company_name,business_description,core_capabilities,naics_codes,certifications")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      supabase
        .from("evidence_chunks")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("is_excluded", false),
      supabase
        .from("sam_opportunity_scores")
        .select("sam_opportunity_id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId),
      supabase
        .from("sam_opportunity_scores")
        .select("sam_opportunity_id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("recommendation", "pursue"),
    ]);

  const checks = {
    hasCompanyProfile: Boolean(profile?.company_name),
    hasBusinessDescription: (profile?.business_description || "").trim().length > 60,
    hasCoreCapabilities: (profile?.core_capabilities || []).length >= 3,
    hasNaics: (profile?.naics_codes || []).length > 0,
    hasCertifications: (profile?.certifications || []).length > 0,
    evidenceReady: (evidenceCount || 0) >= 10,
    scoringReady: (scoreCount || 0) >= 20,
    actionablePipeline: (pursueCount || 0) >= 5,
  };

  const readinessScore = Object.values(checks).filter(Boolean).length * 12.5;

  return {
    readinessScore,
    checks,
    evidenceCount: evidenceCount || 0,
    scoreCount: scoreCount || 0,
    pursueCount: pursueCount || 0,
  };
}

export async function upsertPilotWorkspace(input: {
  workspaceId: string;
  ownerUserId?: string;
  successCriteria?: Record<string, unknown>;
  kickoffNotes?: string;
  status?: "onboarding" | "active" | "paused" | "completed";
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pilot_workspaces")
    .upsert(
      {
        workspace_id: input.workspaceId,
        owner_user_id: input.ownerUserId || null,
        success_criteria: input.successCriteria || {},
        kickoff_notes: input.kickoffNotes || null,
        status: input.status || "onboarding",
        started_at:
          input.status === "active" || input.status === "completed"
            ? new Date().toISOString()
            : null,
      },
      { onConflict: "workspace_id" }
    )
    .select("workspace_id,status,success_criteria,kickoff_notes,started_at,completed_at")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function generateWeeklyPilotReport(input: {
  workspaceId: string;
  weekStart: string;
  weekEnd: string;
  createdBy?: string;
}) {
  const supabase = await createClient();

  const feedbackMetrics = await getWorkspaceFeedbackMetrics(input.workspaceId, 7);
  const readiness = await getPilotReadiness(input.workspaceId);

  const metrics = {
    readiness,
    feedbackMetrics,
  };

  const narrative = `Weekly pilot summary: readiness ${readiness.readinessScore.toFixed(
    1
  )}, acceptance ${(feedbackMetrics.acceptanceRate * 100).toFixed(1)}%, dismissal ${(
    feedbackMetrics.dismissalRate * 100
  ).toFixed(1)}%.`;

  const { data, error } = await supabase
    .from("pilot_weekly_reports")
    .upsert(
      {
        workspace_id: input.workspaceId,
        week_start: input.weekStart,
        week_end: input.weekEnd,
        metrics,
        narrative,
        created_by: input.createdBy || null,
      },
      { onConflict: "workspace_id,week_start,week_end" }
    )
    .select("id,workspace_id,week_start,week_end,metrics,narrative,created_at")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getWeeklyPilotReports(workspaceId: string, limit = 8) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pilot_weekly_reports")
    .select("id,week_start,week_end,metrics,narrative,created_at")
    .eq("workspace_id", workspaceId)
    .order("week_start", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data || [];
}
