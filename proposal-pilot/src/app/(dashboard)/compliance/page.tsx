"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getWorkflowStatus,
  type ProposalWorkflow,
} from "@/lib/proposals/workflow";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Loader2,
  RefreshCw,
  Shield,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

function countFindingStatuses(
  findings: ProposalWorkflow["compliance_findings"]
) {
  return findings.reduce(
    (acc, finding) => {
      acc[finding.status] += 1;
      return acc;
    },
    {
      addressed: 0,
      partially_addressed: 0,
      weak: 0,
      unaddressed: 0,
    }
  );
}

export default function CompliancePage() {
  const [proposals, setProposals] = useState<ProposalWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningComplianceId, setRunningComplianceId] = useState<string | null>(
    null
  );

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
      console.error("Failed to fetch compliance queue:", error);
      toast.error("Failed to load compliance queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const complianceQueue = useMemo(
    () =>
      proposals.filter(
        (proposal) =>
          proposal.proposal_sections.length > 0 ||
          proposal.compliance_findings.length > 0
      ),
    [proposals]
  );

  const stats = useMemo(() => {
    const findings = complianceQueue.flatMap(
      (proposal) => proposal.compliance_findings
    );

    return {
      readyToCheck: complianceQueue.filter(
        (proposal) =>
          proposal.proposal_sections.length > 0 &&
          proposal.compliance_findings.length === 0
      ).length,
      reportsGenerated: complianceQueue.filter(
        (proposal) => proposal.compliance_findings.length > 0
      ).length,
      weakOrPartial: findings.filter(
        (finding) =>
          finding.status === "weak" ||
          finding.status === "partially_addressed"
      ).length,
      unaddressed: findings.filter((finding) => finding.status === "unaddressed")
        .length,
    };
  }, [complianceQueue]);

  async function runCompliance(proposalId: string) {
    setRunningComplianceId(proposalId);

    try {
      const response = await fetch(`/api/proposals/${proposalId}/compliance`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Compliance check failed");
      }

      toast.success("Compliance report generated.");
      await fetchProposals();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Compliance check failed"
      );
    } finally {
      setRunningComplianceId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compliance</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Run requirement coverage checks and surface weak or missing responses
            before export
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchProposals}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Ready To Check", value: stats.readyToCheck, icon: Shield },
          {
            label: "Reports Generated",
            value: stats.reportsGenerated,
            icon: CheckCircle,
          },
          {
            label: "Weak / Partial",
            value: stats.weakOrPartial,
            icon: TriangleAlert,
          },
          {
            label: "Unaddressed",
            value: stats.unaddressed,
            icon: AlertCircle,
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
          <CardTitle className="text-base">Compliance Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">
                Loading compliance queue...
              </p>
            </div>
          ) : complianceQueue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-lg font-semibold mb-2">Nothing to check yet</h2>
              <p className="text-sm text-muted-foreground max-w-md mb-6">
                Draft a proposal first. Once sections exist, it will appear here
                for requirement-by-requirement compliance review.
              </p>
              <Link href="/drafting">
                <Button className="gap-2">
                  Open Drafting <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ) : (
            complianceQueue.map((proposal) => {
              const summary = countFindingStatuses(proposal.compliance_findings);
              const status = getWorkflowStatus(proposal);
              const hasReport = proposal.compliance_findings.length > 0;

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
                        <Badge
                          className={
                            hasReport
                              ? "bg-success/10 text-success border-success/20"
                              : "bg-primary/10 text-primary border-primary/20"
                          }
                        >
                          {hasReport ? "Report ready" : status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{proposal.solicitations.agency || "Unknown agency"}</span>
                        {proposal.solicitations.due_date ? (
                          <span>
                            Due{" "}
                            {new Date(
                              proposal.solicitations.due_date
                            ).toLocaleDateString()}
                          </span>
                        ) : null}
                        <span>{proposal.proposal_sections.length} sections</span>
                        <span>{proposal.compliance_findings.length} findings</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {[
                          {
                            label: "Addressed",
                            value: summary.addressed,
                            tone: "text-success",
                          },
                          {
                            label: "Partial",
                            value: summary.partially_addressed,
                            tone: "text-warning",
                          },
                          {
                            label: "Weak",
                            value: summary.weak,
                            tone: "text-warning",
                          },
                          {
                            label: "Unaddressed",
                            value: summary.unaddressed,
                            tone: "text-danger",
                          },
                        ].map((item) => (
                          <span
                            key={item.label}
                            className={`rounded-full border px-2 py-1 ${item.tone}`}
                          >
                            {item.label}: {item.value}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/proposals/${proposal.id}`}>
                        <Button variant="outline" size="sm">
                          View Proposal
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        onClick={() => runCompliance(proposal.id)}
                        disabled={
                          runningComplianceId === proposal.id ||
                          proposal.proposal_sections.length === 0
                        }
                        className="gap-2"
                      >
                        {runningComplianceId === proposal.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Shield className="h-4 w-4" />
                        )}
                        {hasReport ? "Refresh Report" : "Run Compliance"}
                      </Button>
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
