"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PipelineStepper, type StageStatus } from "@/components/features/pipeline-stepper";
import {
  getWorkflowStatus,
  type ProposalWorkflow,
  formatRelativeDate,
} from "@/lib/proposals/workflow";
import {
  ArrowRight,
  BookOpen,
  Clock,
  FileSearch,
  FolderOpen,
  Loader2,
  PenTool,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";

interface WorkspaceDocument {
  id: string;
  chunk_count: number;
}

interface AgentOperation {
  id: string;
  operation_type: "discovery" | "analysis" | "drafting" | "compliance" | "scoring";
  status: "running" | "completed" | "failed";
  input_summary?: string | null;
  output_summary?: string | null;
  citations_count?: number | null;
  duration_ms?: number | null;
  created_at: string;
}

interface AgentOperationsPayload {
  operations: AgentOperation[];
  stats: {
    totalOperations: number;
    discoveryCount: number;
    analysisCount: number;
    draftingCount: number;
    complianceCount: number;
    scoringCount: number;
    runningCount: number;
  };
}

function getOperationIcon(operationType: AgentOperation["operation_type"]) {
  switch (operationType) {
    case "analysis":
      return FileSearch;
    case "drafting":
      return PenTool;
    case "compliance":
      return Shield;
    case "scoring":
      return Target;
    default:
      return Sparkles;
  }
}

function getPipelineStages(
  documents: WorkspaceDocument[],
  proposals: ProposalWorkflow[]
): Record<"indexed" | "analyzed" | "drafted" | "compliant", StageStatus> {
  const hasIndexedDocs = documents.length > 0;
  const hasAnalyzedProposal = proposals.some((proposal) => proposal.requirements_count > 0);
  const hasDraft = proposals.some((proposal) => proposal.proposal_sections.length > 0);
  const hasCompliance = proposals.some(
    (proposal) => proposal.compliance_findings.length > 0
  );

  return {
    indexed: hasIndexedDocs ? "completed" : "pending",
    analyzed: hasAnalyzedProposal
      ? "completed"
      : proposals.length > 0
      ? "active"
      : hasIndexedDocs
      ? "active"
      : "pending",
    drafted: hasDraft
      ? "completed"
      : hasAnalyzedProposal
      ? "active"
      : "pending",
    compliant: hasCompliance ? "completed" : hasDraft ? "active" : "pending",
  };
}

function formatTimeSaved(minutes: number) {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = minutes / 60;
  return hours >= 10 ? `${Math.round(hours)}h` : `${hours.toFixed(1)}h`;
}

export default function WorkspacePage() {
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [proposals, setProposals] = useState<ProposalWorkflow[]>([]);
  const [operations, setOperations] = useState<AgentOperationsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaceData = useCallback(async () => {
    setLoading(true);
    try {
      const [documentsResponse, proposalsResponse, operationsResponse] =
        await Promise.all([
          fetch("/api/documents?type=company"),
          fetch("/api/proposals"),
          fetch("/api/agent-operations"),
        ]);

      if (!documentsResponse.ok || !proposalsResponse.ok || !operationsResponse.ok) {
        throw new Error("Failed to load workspace data");
      }

      const [documentsData, proposalsData, operationsData] = await Promise.all([
        documentsResponse.json(),
        proposalsResponse.json(),
        operationsResponse.json(),
      ]);

      setDocuments(documentsData as WorkspaceDocument[]);
      setProposals(proposalsData as ProposalWorkflow[]);
      setOperations(operationsData as AgentOperationsPayload);
    } catch (error) {
      console.error("Failed to fetch workspace data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaceData();
  }, [fetchWorkspaceData]);

  const stats = useMemo(() => {
    const indexedChunks = documents.reduce(
      (sum, document) => sum + document.chunk_count,
      0
    );
    const requirementsTracked = proposals.reduce(
      (sum, proposal) => sum + proposal.requirements_count,
      0
    );
    const estimatedTimeSavedMinutes =
      (operations?.stats.analysisCount || 0) * 35 +
      (operations?.stats.draftingCount || 0) * 120 +
      (operations?.stats.complianceCount || 0) * 25;

    return {
      proposals: proposals.length,
      documents: indexedChunks,
      requirementsTracked,
      estimatedTimeSaved: formatTimeSaved(estimatedTimeSavedMinutes),
    };
  }, [documents, operations, proposals]);

  const pipelineStages = useMemo(
    () => getPipelineStages(documents, proposals),
    [documents, proposals]
  );

  const activeProposal = useMemo(() => {
    const prioritizedStatuses = ["analysis_ready", "draft_ready", "in_review"];

    return [...proposals].sort((left, right) => {
      const leftStatus = prioritizedStatuses.indexOf(getWorkflowStatus(left));
      const rightStatus = prioritizedStatuses.indexOf(getWorkflowStatus(right));

      return (leftStatus === -1 ? 99 : leftStatus) - (rightStatus === -1 ? 99 : rightStatus);
    })[0];
  }, [proposals]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workspace</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Live proposal pipeline, AI activity, and workspace health
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchWorkspaceData}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Link href="/proposals">
            <Button className="gap-2">
              <Upload className="h-4 w-4" /> New Proposal
            </Button>
          </Link>
        </div>
      </div>

      <PipelineStepper stages={pipelineStages} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/knowledge-base">
          <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/20">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">Upload Company Docs</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Build the evidence base your drafts can cite
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-1" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/drafting">
          <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/20">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
                <PenTool className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">Generate Drafts</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Turn analyzed RFPs into grounded first drafts
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-1" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/compliance">
          <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/20">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">Run Compliance</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verify every requirement is addressed before export
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-1" />
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Proposals", value: stats.proposals, icon: FolderOpen },
          { label: "Documents Indexed", value: stats.documents, icon: BookOpen },
          {
            label: "Requirements Tracked",
            value: stats.requirementsTracked,
            icon: FileSearch,
          },
          {
            label: "Est. Time Saved",
            value: stats.estimatedTimeSaved,
            icon: Clock,
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">
                  Loading activity...
                </p>
              </div>
            ) : operations?.operations.length ? (
              <div className="space-y-3">
                {operations.operations.slice(0, 6).map((operation) => {
                  const Icon = getOperationIcon(operation.operation_type);

                  return (
                    <div
                      key={operation.id}
                      className="flex items-start gap-3 rounded-lg border bg-card px-3 py-3"
                    >
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium capitalize">
                            {operation.operation_type}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              operation.status === "completed"
                                ? "bg-success/10 text-success"
                                : operation.status === "failed"
                                ? "bg-danger/10 text-danger"
                                : "bg-primary/10 text-primary"
                            }`}
                          >
                            {operation.status}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeDate(operation.created_at)}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {operation.output_summary ||
                            operation.input_summary ||
                            "No summary captured for this operation."}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                          {operation.duration_ms ? (
                            <span>{Math.round(operation.duration_ms / 1000)}s</span>
                          ) : null}
                          {operation.citations_count ? (
                            <span>{operation.citations_count} citations</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No activity yet. Upload company docs or an RFP to get started.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Priority Next Step</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">
                  Loading proposal status...
                </p>
              </div>
            ) : activeProposal ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold">
                    {activeProposal.solicitations.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activeProposal.solicitations.agency || "Unknown agency"}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Current Stage
                  </p>
                  <p className="mt-1 text-sm font-medium capitalize">
                    {getWorkflowStatus(activeProposal).replace(/_/g, " ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/proposals/${activeProposal.id}`}>
                    <Button className="gap-2">
                      Open Workflow <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/proposals">
                    <Button variant="outline">View All Proposals</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Start by uploading company documents or an RFP. ProposalPilot
                  will take it from indexing to analysis, drafting, and compliance.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/knowledge-base">
                    <Button className="gap-2">
                      <BookOpen className="h-4 w-4" />
                      Upload Company Docs
                    </Button>
                  </Link>
                  <Link href="/proposals">
                    <Button variant="outline" className="gap-2">
                      <Upload className="h-4 w-4" />
                      Upload an RFP
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
