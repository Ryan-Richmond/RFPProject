import { createClient } from "@/lib/supabase/server";

export async function withRetry<T>(
  operation: () => Promise<T>,
  options?: { retries?: number; delayMs?: number }
): Promise<T> {
  const retries = options?.retries ?? 2;
  const delayMs = options?.delayMs ?? 400;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }

  throw lastError;
}

export async function recordDeadLetter(input: {
  workspaceId: string;
  pipelineType: string;
  entityType: string;
  entityId?: string;
  errorMessage: string;
  payload?: Record<string, unknown>;
  retryCount?: number;
}) {
  const supabase = await createClient();

  const { error } = await supabase.from("opportunity_pipeline_dead_letters").insert({
    workspace_id: input.workspaceId,
    pipeline_type: input.pipelineType,
    entity_type: input.entityType,
    entity_id: input.entityId || null,
    error_message: input.errorMessage,
    payload: input.payload || {},
    retry_count: input.retryCount || 0,
  });

  if (error) {
    console.error("Failed to record dead letter", error);
  }
}

export async function listDeadLetters(workspaceId: string, status = "open") {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunity_pipeline_dead_letters")
    .select(
      "id,pipeline_type,entity_type,entity_id,error_message,payload,retry_count,status,first_failed_at,last_failed_at,replayed_at"
    )
    .eq("workspace_id", workspaceId)
    .eq("status", status)
    .order("last_failed_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function markDeadLetterReplayed(workspaceId: string, deadLetterId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("opportunity_pipeline_dead_letters")
    .update({ status: "replayed", replayed_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("id", deadLetterId);

  if (error) throw new Error(error.message);
}

export async function createBackfillJob(input: {
  workspaceId: string;
  jobType: "deterministic_scoring" | "ai_enrichment" | "history_snapshot";
  dateFrom?: string;
  dateTo?: string;
  createdBy?: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunity_backfill_jobs")
    .insert({
      workspace_id: input.workspaceId,
      job_type: input.jobType,
      date_from: input.dateFrom || null,
      date_to: input.dateTo || null,
      status: "queued",
      created_by: input.createdBy || null,
    })
    .select("id,status,job_type,date_from,date_to,created_at")
    .single();

  if (error) throw new Error(error.message);
  return data;
}
