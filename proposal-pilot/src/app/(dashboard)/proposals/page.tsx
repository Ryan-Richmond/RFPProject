"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocumentUploader, type UploadWorkflowResult } from "@/components/features/document-uploader";
import {
  getWorkflowStatus,
  type ProposalWorkflow,
} from "@/lib/proposals/workflow";
import {
  FileSearch,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function getStatusBadge(status: string) {
  switch (status) {
    case "analyzing":
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Analyzing
        </Badge>
      );
    case "analysis_ready":
      return (
        <Badge className="gap-1 bg-primary/10 text-primary border-primary/20">
          <CheckCircle2 className="h-3 w-3" />
          Ready To Draft
        </Badge>
      );
    case "draft_ready":
      return (
        <Badge className="gap-1 bg-success/10 text-success border-success/20">
          <CheckCircle2 className="h-3 w-3" />
          Draft Ready
        </Badge>
      );
    case "in_review":
      return (
        <Badge className="gap-1 bg-warning/10 text-warning border-warning/20">
          <AlertCircle className="h-3 w-3" />
          Compliance Ready
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function ProposalsPage() {
  const router = useRouter();
  const [proposals, setProposals] = useState<ProposalWorkflow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/proposals");
      if (response.ok) {
        const data = await response.json();
        setProposals(data);
      }
    } catch (error) {
      console.error("Failed to fetch proposals:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  function handleUploadComplete(results: UploadWorkflowResult[]) {
    fetchProposals();

    if (results.length === 1 && results[0].proposalId) {
      router.push(`/proposals/${results[0].proposalId}`);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proposals</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upload RFPs, analyze requirements, and manage live proposal workflows
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchProposals}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <DocumentUploader
        type="rfp"
        title="Upload a New RFP"
        description="Federal or state/local solicitation documents"
        onComplete={handleUploadComplete}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Proposal Workflows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">
                Loading proposals...
              </p>
            </div>
          ) : proposals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <FileSearch className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                No proposals yet
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Upload an RFP to start your first proposal workflow.
              </p>
            </div>
          ) : (
            proposals.map((proposal) => {
              const workflowStatus = getWorkflowStatus(proposal);

              return (
                <Link
                  key={proposal.id}
                  href={`/proposals/${proposal.id}`}
                  className="block"
                >
                  <div className="group flex items-center gap-4 rounded-lg border bg-card p-4 transition-all hover:shadow-sm hover:border-primary/20">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <FileSearch className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold truncate">
                          {proposal.solicitations.title}
                        </h3>
                        {getStatusBadge(workflowStatus)}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{proposal.solicitations.agency || "Unknown agency"}</span>
                        <span>
                          {(proposal.solicitations.classification || "unclassified").replace(
                            "_",
                            " "
                          )}
                        </span>
                        {proposal.solicitations.due_date ? (
                          <span>
                            Due {new Date(proposal.solicitations.due_date).toLocaleDateString()}
                          </span>
                        ) : null}
                        <span>{proposal.requirements_count} requirements</span>
                        {proposal.total_word_count ? (
                          <span>{proposal.total_word_count} words</span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {(["green", "yellow", "red"] as const).map((score) => (
                          <div key={score} className="flex items-center gap-1 text-xs">
                            <span
                              className={`inline-block h-2 w-2 rounded-full ${
                                score === "green"
                                  ? "bg-success"
                                  : score === "yellow"
                                  ? "bg-warning"
                                  : "bg-danger"
                              }`}
                            />
                            <span className="text-muted-foreground">
                              {proposal.readiness[score]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
