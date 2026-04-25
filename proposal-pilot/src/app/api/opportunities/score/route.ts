import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { scoreAllOpportunities } from "@/services/opportunity-scoring/deterministic";
import {
  checkWorkspaceFreshness,
  logPipelineRun,
  refreshWorkspaceSamQualityReport,
  refreshWorkspaceScoreDistributionSnapshot,
} from "@/services/opportunity-monitoring";

export async function POST() {
  const startedAt = Date.now();
  let workspaceId: string | null = null;
  try {
    const context = await getWorkspaceContext();
    const { user } = context;
    workspaceId = context.workspaceId;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const result = await scoreAllOpportunities(workspaceId);
    const [distributionSnapshot, qualityReport, freshness] = await Promise.all([
      refreshWorkspaceScoreDistributionSnapshot(workspaceId),
      refreshWorkspaceSamQualityReport(workspaceId),
      checkWorkspaceFreshness(workspaceId),
    ]);

    await Promise.all([
      logPipelineRun({
        workspaceId,
        pipelineType: "distribution_snapshot",
        status: "completed",
        durationMs: Date.now() - startedAt,
        rowsRead: distributionSnapshot.totalCount,
        rowsWritten: 1,
      }),
      logPipelineRun({
        workspaceId,
        pipelineType: "quality_check",
        status: "completed",
        durationMs: Date.now() - startedAt,
        rowsRead: qualityReport.totalRows,
        rowsWritten: 1,
      }),
      logPipelineRun({
        workspaceId,
        pipelineType: "freshness_check",
        status: "completed",
        durationMs: Date.now() - startedAt,
        rowsRead: 2,
        rowsWritten: 0,
        metadata: freshness,
      }),
    ]);

    await logPipelineRun({
      workspaceId,
      pipelineType: "deterministic_scoring",
      status: "completed",
      durationMs: Date.now() - startedAt,
      rowsRead: result.scored,
      rowsWritten: result.scored,
      metadata: {
        pursue: result.pursue,
        monitor: result.monitor,
        pass: result.pass,
      },
    });

    return NextResponse.json({
      message: "Deterministic scoring complete",
      workspaceId,
      ...result,
      distributionSnapshot,
      qualityReport,
      freshness,
    });
  } catch (error) {
    console.error("Deterministic scoring API error:", error);
    if (workspaceId) {
      await logPipelineRun({
        workspaceId,
        pipelineType: "deterministic_scoring",
        status: "failed",
        durationMs: Date.now() - startedAt,
        errorMessage: error instanceof Error ? error.message : "Unknown scoring error",
      });
    }
    return NextResponse.json(
      { error: "Failed to score opportunities" },
      { status: 500 }
    );
  }
}
