import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { createBackfillJob } from "@/services/opportunity-monitoring/hardening";

export async function POST(request: NextRequest) {
  try {
    const { user, workspaceId } = await getWorkspaceContext();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!workspaceId) return NextResponse.json({ error: "No workspace found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const jobType = body.jobType;

    if (!["deterministic_scoring", "ai_enrichment", "history_snapshot"].includes(jobType)) {
      return NextResponse.json(
        { error: "jobType must be deterministic_scoring|ai_enrichment|history_snapshot" },
        { status: 400 }
      );
    }

    const job = await createBackfillJob({
      workspaceId,
      jobType,
      dateFrom: typeof body.dateFrom === "string" ? body.dateFrom : undefined,
      dateTo: typeof body.dateTo === "string" ? body.dateTo : undefined,
      createdBy: user.id,
    });

    return NextResponse.json({ message: "Backfill job queued", job });
  } catch (error) {
    console.error("Backfill API error", error);
    return NextResponse.json({ error: "Failed to queue backfill job" }, { status: 500 });
  }
}
