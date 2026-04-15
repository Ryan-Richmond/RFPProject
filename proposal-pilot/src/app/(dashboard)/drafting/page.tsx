"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getReadinessTotal,
  getWorkflowStatus,
  type ProposalWorkflow,
} from "@/lib/proposals/workflow";
import {
  ArrowRight,
  CheckCircle2,
  FileSearch,
  Loader2,
  PenTool,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";

function getDraftStatusBadge(status: string) {
  switch (status) {
    case "analysis_ready":
      return (
        <Badge className="gap-1 bg-primary/10 text-primary border-primary/20">
          <Sparkles className="h-3 w-3" />
          Ready to draft
        </Badge>
      );
    case "draft_ready":
      return (
        <Badge className="gap-1 bg-success/10 text-success border-success/20">
          <CheckCircle2 className="h-3 w-3" />
          Draft generated
        </Badge>
      );
    case "in_review":
      return (
        <Badge className="gap-1 bg-warning/10 text-warning border-warning/20">
          <Target className="h-3 w-3" />
          In review
        </Badge>
      );
    case "analyzing":
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Analyzing
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status.replace(/_/g, " ")}</Badge>;
  }
}

export default function DraftingPage() {
  const [proposals, setProposals] = useState<ProposalWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningDraftId, setRunningDraftId] = useState<string | null>(null);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/proposals");
      if (!response.ok) {
        throw new Error("Failed to fetch proposals");
      }

      const data = (await response.json()) as ProposalWorkflow[];
      setProposals(data);
    } catch (error) {
      console.error("Failed to fetch drafting workflows:", error);
      toast.error("Failed to load drafting workflows.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const draftingQueue = useMemo(
    () =>
      proposals.filter(
        (proposal) =>
          proposal.requirements_count > 0 || proposal.proposal_sections.length > 0
      ),
    [proposals]
  );

  const stats = useMemo(
    () => ({
      readyToDraft: draftingQueue.filter(
        (proposal) => getWorkflowStatus(proposal) === "analysis_ready"
      ).length,
      drafted: draftingQueue.filter((proposal) => proposal.proposal_sections.length > 0)
        .length,
      reviewReady: draftingQueue.filter(
        (proposal) => getWorkflowStatus(proposal) === "in_review"
      ).length,
      totalWords: draftingQueue.reduce(
        (sum, proposal) => sum + (proposal.total_word_count || 0),
        0
      ),
    }),
    [draftingQueue]
  );

  async function runDraft(proposalId: string) {
    setRunningDraftId(proposalId);

    try {
      const response = await fetch(`/api/proposals/${proposalId}/draft`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Draft generation failed");
      }

      toast.success("Proposal draft generated.");
      await fetchProposals();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Draft generation failed"
      );
    } finally {
      setRunningDraftId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Drafting</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Generate grounded first drafts from analyzed solicitations and your
            indexed company evidence
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchProposals}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Ready To Draft", value: stats.readyToDraft, icon: Sparkles },
          { label: "Drafts Generated", value: stats.drafted, icon: PenTool },
          { label: "Review Ready", value: stats.reviewReady, icon: Target },
          {
            label: "Words Generated",
            value: stats.totalWords.toLocaleString(),
            icon: FileSearch,
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <stat.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Draft Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">
                Loading draft queue...
              </p>
            </div>
          ) : draftingQueue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <PenTool className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-lg font-semibold mb-2">No drafting work yet</h2>
              <p className="text-sm text-muted-foreground max-w-md mb-6">
                Upload and analyze an RFP first. Once requirements are extracted,
                it will show up here ready for draft generation.
              </p>
              <Link href="/proposals">
                <Button className="gap-2">
                  Go To Proposals <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ) : (
            draftingQueue.map((proposal) => {
              const status = getWorkflowStatus(proposal);
              const canDraft =
                status === "analysis_ready" && runningDraftId !== proposal.id;

              return (
                <div
                  key={proposal.id}
                  className="rounded-xl border bg-card p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">
                          {proposal.solicitations.title}
                        </h3>
                        {getDraftStatusBadge(status)}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{proposal.solicitations.agency || "Unknown agency"}</span>
                        <span>
                          {(proposal.solicitations.classification || "unclassified").replace(
                            /_/g,
                            " "
                          )}
                        </span>
                        {proposal.solicitations.due_date ? (
                          <span>
                            Due{" "}
                            {new Date(
                              proposal.solicitations.due_date
                            ).toLocaleDateString()}
                          </span>
                        ) : null}
                        <span>
                          {getReadinessTotal(proposal.readiness)} requirements
                        </span>
                        {proposal.total_word_count ? (
                          <span>
                            {proposal.total_word_count.toLocaleString()} words
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        {(["green", "yellow", "red"] as const).map((score) => (
                          <div key={score} className="flex items-center gap-1">
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
                              {proposal.readiness[score]} {score}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/proposals/${proposal.id}`}>
                        <Button variant="outline" size="sm">
                          Open Proposal
                        </Button>
                      </Link>
                      {proposal.proposal_sections.length === 0 ? (
                        <Button
                          size="sm"
                          disabled={!canDraft}
                          onClick={() => runDraft(proposal.id)}
                          className="gap-2"
                        >
                          {runningDraftId === proposal.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          Generate Draft
                        </Button>
                      ) : (
                        <Link href={`/proposals/${proposal.id}`}>
                          <Button size="sm" className="gap-2">
                            <PenTool className="h-4 w-4" />
                            Continue Draft
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
