"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";
import {
  ArrowRight,
  CheckCircle2,
  FileSearch,
  Globe2,
  ShieldCheck,
  Upload,
} from "lucide-react";

type Rung = "public_baseline" | "minimum_evidence" | "rfp_specific_gaps" | "full_library";

interface MissionReadiness {
  readinessScore: number;
  currentRung: Rung;
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

interface OnboardingMissionControlProps {
  readiness: MissionReadiness;
}

const RUNG_LABEL: Record<Rung, string> = {
  public_baseline: "Public baseline",
  minimum_evidence: "Minimum evidence",
  rfp_specific_gaps: "RFP-specific gaps",
  full_library: "Full library readiness",
};

export function OnboardingMissionControl({ readiness }: OnboardingMissionControlProps) {
  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.05] via-background to-background shadow-sm">
      <CardContent className="p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex items-start gap-5">
            <ProgressRing value={readiness.readinessScore} size={84} stroke={8} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{RUNG_LABEL[readiness.currentRung]}</Badge>
                <Badge
                  className={
                    readiness.goodEnoughToStart
                      ? "bg-success/10 text-success border-success/20"
                      : "bg-warning/10 text-warning border-warning/20"
                  }
                >
                  {readiness.goodEnoughToStart ? "Good enough to start" : "Setup in progress"}
                </Badge>
              </div>
              <h2 className="mt-3 text-lg font-semibold">Onboarding Confidence Ladder</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                Build trust in stages: start with public data, approve a minimum internal evidence pack,
                then fill only the gaps that matter for each RFP.
              </p>
              <div className="mt-4">
                <Link href={readiness.nextAction.href}>
                  <Button className="gap-2">
                    {readiness.nextAction.label}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <p className="mt-2 text-xs text-muted-foreground">
                  {readiness.nextAction.description}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 text-sm">
            <StatusRow
              icon={Globe2}
              label="Public baseline"
              value={readiness.publicBaseline.status === "complete" ? "Complete" : "Not verified"}
              complete={readiness.publicBaseline.status === "complete"}
            />
            <StatusRow
              icon={ShieldCheck}
              label="Profile"
              value={`${readiness.profile.score}%`}
              complete={readiness.profile.score >= 100}
            />
            <StatusRow
              icon={Upload}
              label="Minimum pack"
              value={`${readiness.evidence.minimumReadyCount}/${readiness.evidence.minimumTotal}`}
              complete={readiness.evidence.minimumReady}
            />
            <StatusRow
              icon={FileSearch}
              label="Active RFP gaps"
              value={
                readiness.activeProposalGap
                  ? `${readiness.activeProposalGap.red} red, ${readiness.activeProposalGap.yellow} yellow`
                  : "None"
              }
              complete={!readiness.activeProposalGap}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusRow({
  icon: Icon,
  label,
  value,
  complete,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  complete: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background/70 px-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
      {complete ? (
        <CheckCircle2 className="h-4 w-4 text-success" />
      ) : (
        <span className="h-2 w-2 rounded-full bg-warning" />
      )}
    </div>
  );
}
