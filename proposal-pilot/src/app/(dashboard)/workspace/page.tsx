"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Sparkline } from "@/components/ui/sparkline";
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
import { OnboardingGuide } from "@/components/features/onboarding-guide";
import { OnboardingMissionControl } from "@/components/features/onboarding-mission-control";

const IS_MOCK_MODE = process.env.NEXT_PUBLIC_AI_MODE === "mock";
const ONBOARDING_LADDER_ENABLED =
  process.env.NEXT_PUBLIC_ONBOARDING_LADDER_ENABLED === "true";
const DEMO_FILENAMES = new Set([
  "Demo Capability Statement.txt",
  "Demo Cybersecurity Modernization RFP.txt",
]);

interface WorkspaceDocument {
  id: string;
  filename: string;
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

interface OnboardingReadinessPayload {
  readinessScore: number;
  currentRung: "public_baseline" | "minimum_evidence" | "rfp_specific_gaps" | "full_library";
  goodEnoughToStart: boolean;
  profile: { score: number };
  publicBaseline: { status: "missing" | "running" | "complete" | "error" };
  evidence: {
    minimumReady: boolean;
    minimumReadyCount: number;
    minimumTotal: number;
    totalChunks: number;
  };
  activeProposalGap: {
    solicitationTitle: string;
    red: number;
    yellow: number;
  } | null;
  nextAction: {
    label: string;
    description: string;
    href: string;
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
  const [readiness, setReadiness] = useState<OnboardingReadinessPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [clearingDemo, setClearingDemo] = useState(false);

  const [hasProfile, setHasProfile] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true); // default true to avoid flash
  const [showPreviewGuide, setShowPreviewGuide] = useState(false);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);

  const hasDemoData = documents.some((doc) => DEMO_FILENAMES.has(doc.filename));

  const fetchWorkspaceData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        documentsResponse,
        proposalsResponse,
        operationsResponse,
        statusResponse,
        readinessResponse,
      ] =
        await Promise.all([
          fetch("/api/documents?type=company"),
          fetch("/api/proposals"),
          fetch("/api/agent-operations"),
          fetch("/api/workspace/status"),
          fetch("/api/onboarding/readiness"),
        ]);

      if (!documentsResponse.ok || !proposalsResponse.ok || !operationsResponse.ok) {
        throw new Error("Failed to load workspace data");
      }

      const [documentsData, proposalsData, operationsData, statusData, readinessData] = await Promise.all([
        documentsResponse.json(),
        proposalsResponse.json(),
        operationsResponse.json(),
        statusResponse.ok ? statusResponse.json() : null,
        readinessResponse.ok ? readinessResponse.json() : null,
      ]);

      setDocuments(documentsData as WorkspaceDocument[]);
      setProposals(proposalsData as ProposalWorkflow[]);
      setOperations(operationsData as AgentOperationsPayload);
      setReadiness(readinessData as OnboardingReadinessPayload | null);
      
      if (statusData) {
        setHasProfile(statusData.hasProfile as boolean);
        setHasCompletedOnboarding(statusData.hasCompletedOnboarding as boolean);
        if (statusData.workspaceName) setWorkspaceName(statusData.workspaceName as string);
        if (statusData.companyName) setCompanyName(statusData.companyName as string);
      }
    } catch (error) {
      console.error("Failed to fetch workspace data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaceData();
  }, [fetchWorkspaceData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("guide") === "open") {
      setShowPreviewGuide(true);
    }
  }, []);

  async function handleSeedMockData() {
    setSeeding(true);
    setSeedError(null);
    try {
      const response = await fetch("/api/mock/seed", { method: "POST" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Failed to load mock data");
      }

      await fetchWorkspaceData();
    } catch (error) {
      setSeedError(error instanceof Error ? error.message : "Failed to load mock data");
    } finally {
      setSeeding(false);
    }
  }

  async function handleClearDemoData() {
    setClearingDemo(true);
    setSeedError(null);
    try {
      const response = await fetch("/api/mock/seed", { method: "DELETE" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Failed to clear demo data");
      }

      await fetchWorkspaceData();
    } catch (error) {
      setSeedError(error instanceof Error ? error.message : "Failed to clear demo data");
    } finally {
      setClearingDemo(false);
    }
  }

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

  // Per-day operation counts for the last 7 days (oldest → newest).
  const opSeriesWeek = useMemo(() => {
    const buckets = new Array(7).fill(0);
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    for (const op of operations?.operations || []) {
      const ts = new Date(op.created_at).getTime();
      const ageDays = Math.floor((now - ts) / dayMs);
      if (ageDays >= 0 && ageDays < 7) {
        buckets[6 - ageDays] += 1;
      }
    }
    return buckets;
  }, [operations]);

  const opSeriesTotal = opSeriesWeek.reduce((sum, n) => sum + n, 0);

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
          <h1 className="text-2xl font-bold tracking-tight">
            {companyName || workspaceName || "Workspace"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Live proposal pipeline, AI activity, and workspace health
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchWorkspaceData}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          {IS_MOCK_MODE ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedMockData}
              disabled={seeding}
              className="gap-2"
            >
              {seeding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Load Demo
            </Button>
          ) : hasDemoData ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearDemoData}
              disabled={clearingDemo}
              className="gap-2 text-muted-foreground hover:text-destructive hover:border-destructive/40"
            >
              {clearingDemo ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Clear Demo Data
            </Button>
          ) : null}
          <Link href="/proposals">
            <Button className="gap-2">
              <Upload className="h-4 w-4" /> New Proposal
            </Button>
          </Link>
        </div>
      </div>

      {seedError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {seedError}
        </div>
      ) : null}

      {!loading && ONBOARDING_LADDER_ENABLED && readiness && !showPreviewGuide ? (
        <OnboardingMissionControl readiness={readiness} />
      ) : null}

      {!loading && ((!ONBOARDING_LADDER_ENABLED && !hasCompletedOnboarding) || showPreviewGuide) && (
        <OnboardingGuide
          hasProfile={hasProfile}
          hasDocuments={documents.length > 0}
          hasOpportunities={proposals.length > 0 || (operations?.stats?.discoveryCount ?? 0) > 0}
          hasAnalysis={proposals.some(p => p.requirements_count > 0)}
          hasDraft={proposals.some(p => p.proposal_sections.length > 0)}
          preview={showPreviewGuide}
          onDismiss={() => {
            if (showPreviewGuide) {
              setShowPreviewGuide(false);
            } else {
              setHasCompletedOnboarding(true);
            }
          }}
        />
      )}

      <PipelineStepper stages={pipelineStages} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/knowledge-base">
          <Card className="group cursor-pointer card-lift hover:border-primary/20">
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
          <Card className="group cursor-pointer card-lift hover:border-primary/20">
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
          <Card className="group cursor-pointer card-lift hover:border-primary/20">
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

      {/* AI activity sparkline */}
      {opSeriesTotal > 0 && (
        <Card className="card-lift">
          <CardContent className="flex items-center justify-between gap-6 pt-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                AI activity — last 7 days
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                <AnimatedNumber value={opSeriesTotal} />
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  operation{opSeriesTotal === 1 ? "" : "s"}
                </span>
              </p>
            </div>
            <Sparkline
              values={opSeriesWeek}
              width={200}
              height={48}
              color="var(--primary)"
              showMarkers
            />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Proposals", value: stats.proposals, icon: FolderOpen, numeric: true as const },
          { label: "Documents Indexed", value: stats.documents, icon: BookOpen, numeric: true as const },
          {
            label: "Requirements Tracked",
            value: stats.requirementsTracked,
            icon: FileSearch,
            numeric: true as const,
          },
          {
            label: "Est. Time Saved",
            value: stats.estimatedTimeSaved,
            icon: Clock,
            numeric: false as const,
          },
        ].map((stat) => (
          <Card key={stat.label} className="card-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground/50" />
            </CardHeader>
            <CardContent>
              {stat.numeric && typeof stat.value === "number" ? (
                <AnimatedNumber
                  value={stat.value}
                  durationMs={900}
                  className="text-2xl font-bold tabular-nums"
                />
              ) : (
                <div className="text-2xl font-bold tabular-nums">{stat.value}</div>
              )}
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
