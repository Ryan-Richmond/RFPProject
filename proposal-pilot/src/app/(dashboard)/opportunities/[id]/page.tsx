"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building2,
  Clock,
  DollarSign,
  ExternalLink,
  FileSearch,
  Info,
  Lightbulb,
  Loader2,
  Shield,
  Sparkles,
  Target,
  Trophy,
  Users,
  ArrowLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  formatAgency,
  formatValueRange,
  getScoreImprovementTip,
} from "@/lib/opportunities/format";
import { findNaicsByCode } from "@/lib/profile/naics-codes";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Skeleton } from "@/components/ui/skeleton";
import { celebrateOnce } from "@/lib/celebrate";

interface OpportunityDetail {
  id: string;
  title: string;
  agency: string;
  solicitation_number?: string;
  response_deadline?: string;
  posted_date?: string;
  set_aside_type?: string;
  estimated_value_min?: number;
  estimated_value_max?: number;
  contract_type?: string;
  naics_codes?: string[];
  description?: string;
  source_url?: string;
  notice_id?: string;
  ai_enriched?: boolean;
  ai_scored_at?: string | null;
  status: string;
  opportunity_scores?: Array<{
    overall_score: number;
    naics_match_score: number;
    size_fit_score: number;
    capability_match_score: number;
    set_aside_eligibility_score: number;
    competition_level_score: number;
    timeline_fit_score: number;
    recommendation: string;
    score_rationale?: string;
    agency_intel?: string;
    incumbent_info?: string;
    competitive_landscape?: string;
    citations?: string[];
    estimated_contract_value_min?: number | null;
    estimated_contract_value_max?: number | null;
  }>;
}

interface OnboardingReadiness {
  readinessScore: number;
  goodEnoughToStart: boolean;
  evidence: {
    items: Array<{
      id: string;
      label: string;
      ready: boolean;
      neededForCurrentRfp?: boolean;
    }>;
  };
  activeProposalGap: {
    solicitationTitle: string;
    red: number;
    yellow: number;
    categories: string[];
  } | null;
}

function ScoreBar({
  label,
  score,
  tip,
}: {
  label: string;
  score: number;
  tip?: string | null;
}) {
  const color =
    score >= 75
      ? "bg-success"
      : score >= 50
        ? "bg-warning"
        : "bg-danger";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      {tip && (
        <div className="flex items-start gap-1.5 pt-1 pl-0.5">
          <Lightbulb className="h-3 w-3 text-warning shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-snug">{tip}</p>
        </div>
      )}
    </div>
  );
}

export default function OpportunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [opportunity, setOpportunity] = useState<OpportunityDetail | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [showScoreInfo, setShowScoreInfo] = useState(false);
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [readiness, setReadiness] = useState<OnboardingReadiness | null>(null);

  async function fetchOpportunity() {
    try {
      const [res, readinessRes] = await Promise.all([
        fetch(`/api/opportunities/${params.id}`),
        fetch("/api/onboarding/readiness"),
      ]);
      if (res.ok) {
        const data = await res.json();
        setOpportunity(data);
      }
      if (readinessRes.ok) {
        setReadiness(await readinessRes.json());
      }
    } catch (error) {
      console.error("Failed to fetch opportunity:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOpportunity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleRunAnalysis() {
    if (!opportunity) return;
    setEnriching(true);
    try {
      const res = await fetch("/api/opportunities/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samOpportunityIds: [opportunity.id] }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Analysis failed");
      }
      const result = await res.json();
      if (result.enriched > 0) {
        toast.success("AI analysis complete. Refreshing details...");
        celebrateOnce("first-ai-analysis", { particleCount: 70 });
      } else if (result.failed > 0) {
        toast.error("AI analysis failed for this opportunity. Check the logs.");
      } else {
        toast.message("No new analysis was produced.");
      }
      await fetchOpportunity();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setEnriching(false);
    }
  }

  async function handleStartProposal() {
    setShowCommitModal(true);
  }

  async function confirmStartProposal() {
    setPromoting(true);
    try {
      const res = await fetch(`/api/opportunities/${params.id}`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/proposals/${data.proposalId || data.solicitationId}`);
      } else {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to start proposal");
      }
    } catch (error) {
      console.error("Failed to promote opportunity:", error);
      toast.error(error instanceof Error ? error.message : "Failed to start proposal");
    } finally {
      setPromoting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-4 w-32 mb-3" />
          <Skeleton className="h-7 w-2/3 mb-2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-12 gap-6">
          <Card className="col-span-5">
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-24" />
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="col-span-7">
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-11/12" />
              <Skeleton className="h-3 w-10/12" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Opportunity not found</p>
      </div>
    );
  }

  const score = opportunity.opportunity_scores?.[0];
  const agencyFormatted = formatAgency(opportunity.agency);
  const hasRawValue = !!(
    opportunity.estimated_value_min || opportunity.estimated_value_max
  );
  const valueLabel = hasRawValue
    ? formatValueRange(opportunity.estimated_value_min, opportunity.estimated_value_max)
    : formatValueRange(
        score?.estimated_contract_value_min,
        score?.estimated_contract_value_max
      );

  const aiEnriched = Boolean(opportunity.ai_enriched);
  const likelyGaps = readiness?.evidence.items.filter((item) => !item.ready).slice(0, 5) || [];
  const hasDescriptionText =
    typeof opportunity.description === "string" &&
    opportunity.description.trim().length > 0 &&
    !/^https?:\/\//i.test(opportunity.description.trim());

  return (
    <div className="space-y-6 animate-content-rise">
      <Dialog open={showCommitModal} onOpenChange={(open) => !promoting && setShowCommitModal(open)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Commit this opportunity to proposal work?</DialogTitle>
            <DialogDescription>
              Review fit, verified evidence, and likely gaps before creating the proposal workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Win Probability</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {score ? (
                  <>
                    <div className="flex items-end justify-between gap-3">
                      <div className="text-4xl font-bold tabular-nums">
                        {score.overall_score}
                        <span className="text-base text-muted-foreground">/100</span>
                      </div>
                      <Badge
                        className={
                          score.overall_score >= 75
                            ? "bg-success/10 text-success border-success/20"
                            : score.overall_score >= 50
                              ? "bg-warning/10 text-warning border-warning/20"
                              : "bg-danger/10 text-danger border-danger/20"
                        }
                      >
                        {score.recommendation}
                      </Badge>
                    </div>
                    <ScoreBar label="Capability Match" score={score.capability_match_score} />
                    <ScoreBar label="NAICS Match" score={score.naics_match_score} />
                    <ScoreBar label="Set-Aside Eligibility" score={score.set_aside_eligibility_score} />
                    {score.score_rationale ? (
                      <p className="text-xs leading-5 text-muted-foreground">{score.score_rationale}</p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Run AI analysis for a scored recommendation before committing.
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Requirements vs. You</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Evidence Readiness</p>
                    <p className="mt-1 text-2xl font-bold">{readiness?.readinessScore ?? 0}%</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Good Enough</p>
                    <p className="mt-1 text-sm font-semibold">
                      {readiness?.goodEnoughToStart ? "Yes" : "Not yet"}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Likely evidence gaps
                  </p>
                  <div className="mt-2 space-y-2">
                    {likelyGaps.length ? (
                      likelyGaps.map((gap) => (
                        <div key={gap.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                          <span className="text-sm">{gap.label}</span>
                          {gap.neededForCurrentRfp ? (
                            <Badge className="bg-warning/10 text-warning border-warning/20">
                              Current RFP
                            </Badge>
                          ) : (
                            <Badge variant="outline">Missing</Badge>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                        No major onboarding evidence gaps detected.
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Public research can guide recommendations, but only verified profile data and uploaded/SAM-verified evidence can support draft citations.
                </p>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCommitModal(false)} disabled={promoting}>
              Cancel
            </Button>
            <Button onClick={confirmStartProposal} disabled={promoting} className="gap-2">
              {promoting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
              Start Proposal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Back button + Sticky header */}
      <div className="sticky top-0 -mx-6 -mt-6 z-30 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 px-6 pt-4 pb-3 border-b">
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 gap-1 -ml-2"
          onClick={() => router.push("/opportunities")}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Pipeline
        </Button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {opportunity.title}
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant="outline" className="text-xs">
                {opportunity.status}
              </Badge>
              {opportunity.solicitation_number && (
                <span className="text-xs text-muted-foreground">
                  {opportunity.solicitation_number}
                </span>
              )}
              {opportunity.set_aside_type && (
                <Badge variant="secondary" className="text-xs">
                  {opportunity.set_aside_type}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {opportunity.source_url && (
              <a
                href={opportunity.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="gap-1">
                  <ExternalLink className="h-3.5 w-3.5" />
                  View on SAM.gov
                </Button>
              </a>
            )}
            {!aiEnriched && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunAnalysis}
                disabled={enriching}
                className="gap-1.5"
              >
                {enriching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {enriching ? "Analyzing..." : "Run AI Analysis"}
              </Button>
            )}
            <Button
              onClick={handleStartProposal}
              disabled={promoting}
              className="gap-2"
            >
              {promoting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSearch className="h-4 w-4" />
              )}
              Start Proposal
            </Button>
          </div>
        </div>
      </div>

      {/* AI analysis pending banner */}
      {!aiEnriched && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
          <Sparkles className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">AI analysis hasn&apos;t run for this opportunity yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              The Score Breakdown below uses deterministic factors only (NAICS, set-aside, timeline).
              Running AI analysis adds a tailored summary, value estimate, capability fit score, and competition assessment based on your company profile and uploaded docs.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunAnalysis}
            disabled={enriching}
            className="gap-1.5 shrink-0"
          >
            {enriching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {enriching ? "Analyzing..." : "Run Analysis"}
          </Button>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-start gap-3 pt-6">
            <Building2 className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Agency</p>
              <p className="text-sm font-medium leading-tight">
                {agencyFormatted.primary}
              </p>
              {agencyFormatted.subUnit && (
                <p
                  className="text-xs text-muted-foreground mt-0.5 truncate"
                  title={agencyFormatted.segments.join(" › ")}
                >
                  {agencyFormatted.subUnit}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Deadline</p>
              <p className="text-sm font-medium">
                {opportunity.response_deadline
                  ? new Date(opportunity.response_deadline).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 pt-6">
            <DollarSign className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Estimated Value</p>
              <p className="text-sm font-medium">{valueLabel}</p>
              {valueLabel !== "N/A" && !hasRawValue && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  AI estimate
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Trophy className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Score</p>
              {score ? (
                <p className="text-sm font-medium tabular-nums">
                  <AnimatedNumber value={score.overall_score} />
                  <span className="text-muted-foreground">/100</span>
                </p>
              ) : (
                <p className="text-sm font-medium">Not scored</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agency breadcrumb */}
      {agencyFormatted.segments.length > 1 && (
        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {agencyFormatted.segments.map((seg, i) => (
            <span key={i} className="flex items-center gap-1">
              <span>{seg}</span>
              {i < agencyFormatted.segments.length - 1 && (
                <ChevronRight className="h-3 w-3" />
              )}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Left Column: Score Breakdown */}
        <div className="col-span-5 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Score Breakdown</CardTitle>
              <button
                type="button"
                onClick={() => setShowScoreInfo((prev) => !prev)}
                aria-expanded={showScoreInfo}
                aria-label="How are scores calculated?"
                title="How are scores calculated?"
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Info className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              {showScoreInfo && (
                <div className="relative rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed">
                  <button
                    type="button"
                    onClick={() => setShowScoreInfo(false)}
                    aria-label="Close"
                    className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <p className="pr-5 font-semibold text-foreground">
                    How the score is calculated
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Each factor is rated 0–100. The overall score is a weighted
                    average; recommendation thresholds are{" "}
                    <span className="font-medium text-success">Pursue ≥ 75</span>
                    ,{" "}
                    <span className="font-medium text-warning">
                      Monitor 50–74
                    </span>
                    ,{" "}
                    <span className="font-medium text-danger">Pass &lt; 50</span>
                    .
                  </p>

                  <p className="mt-3 font-semibold text-foreground">
                    Deterministic factors (always computed)
                  </p>
                  <ul className="mt-1 space-y-1 text-muted-foreground">
                    <li>
                      <span className="font-medium text-foreground">
                        NAICS Match — 35%.
                      </span>{" "}
                      Overlap between your profile&apos;s NAICS codes and the
                      opportunity&apos;s.
                    </li>
                    <li>
                      <span className="font-medium text-foreground">
                        Set-Aside Eligibility — 25%.
                      </span>{" "}
                      Whether your certifications satisfy the set-aside (full
                      score for open competition).
                    </li>
                    <li>
                      <span className="font-medium text-foreground">
                        Agency / PSC Relevance — 15% + 10%.
                      </span>{" "}
                      Past performance with this agency and how closely the PSC
                      code maps to your capability domains.
                    </li>
                    <li>
                      <span className="font-medium text-foreground">
                        Timeline Fit — 15%.
                      </span>{" "}
                      How much runway remains before the response deadline.
                    </li>
                  </ul>

                  <p className="mt-3 font-semibold text-foreground">
                    AI overlays (after Run Analysis)
                  </p>
                  <ul className="mt-1 space-y-1 text-muted-foreground">
                    <li>
                      <span className="font-medium text-foreground">
                        Size Fit, Capability Match, Competition Level.
                      </span>{" "}
                      Generated from your profile, Knowledge Base evidence, and
                      the parsed solicitation. They surface fit risks and feed
                      the AI rationale and recommendation.
                    </li>
                  </ul>

                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Disqualifying factors (ineligible set-aside, expired
                    deadline) drive the overall score to 0 regardless of other
                    factors.
                  </p>
                </div>
              )}
              {score ? (
                <>
                  <div className="flex items-end justify-between mb-4">
                    <div className="flex items-baseline gap-1">
                      <AnimatedNumber
                        value={score.overall_score}
                        className={`text-5xl font-bold tabular-nums leading-none ${
                          score.overall_score >= 75
                            ? "text-gradient"
                            : score.overall_score >= 50
                              ? "text-warning"
                              : "text-danger"
                        }`}
                      />
                      <span className="text-base text-muted-foreground">/100</span>
                    </div>
                    <Badge
                      className={`text-sm px-3 py-1 ${
                        score.overall_score >= 75
                          ? "bg-success/10 text-success border-success/20"
                          : score.overall_score >= 50
                            ? "bg-warning/10 text-warning border-warning/20"
                            : "bg-danger/10 text-danger border-danger/20"
                      }`}
                    >
                      {score.recommendation.toUpperCase()}
                    </Badge>
                  </div>
                  <ScoreBar
                    label="NAICS Match"
                    score={score.naics_match_score}
                    tip={getScoreImprovementTip("naics", score.naics_match_score)}
                  />
                  <ScoreBar
                    label="Size Fit"
                    score={score.size_fit_score}
                    tip={getScoreImprovementTip("size", score.size_fit_score)}
                  />
                  <ScoreBar
                    label="Capability Match"
                    score={score.capability_match_score}
                    tip={getScoreImprovementTip(
                      "capability",
                      score.capability_match_score
                    )}
                  />
                  <ScoreBar
                    label="Set-Aside Eligibility"
                    score={score.set_aside_eligibility_score}
                    tip={getScoreImprovementTip(
                      "set_aside",
                      score.set_aside_eligibility_score
                    )}
                  />
                  <ScoreBar
                    label="Competition Level"
                    score={score.competition_level_score}
                    tip={getScoreImprovementTip(
                      "competition",
                      score.competition_level_score
                    )}
                  />
                  <ScoreBar
                    label="Timeline Fit"
                    score={score.timeline_fit_score}
                    tip={getScoreImprovementTip("timeline", score.timeline_fit_score)}
                  />
                  {score.score_rationale && (
                    <div className="pt-3 border-t">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {score.score_rationale}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Not yet scored
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Intel Panels */}
        <div className="col-span-7 space-y-4">
          {/* Description / AI Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4" />
                {aiEnriched ? "AI Summary" : "Description"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {hasDescriptionText ? (
                <p className="text-sm leading-relaxed whitespace-pre-line">
                  {opportunity.description}
                </p>
              ) : score?.score_rationale ? (
                <p className="text-sm leading-relaxed text-foreground">
                  {score.score_rationale}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No on-page description available yet. SAM.gov hosts the full
                  statement of work — open the notice on SAM.gov for the
                  complete details, or run AI analysis to generate a tailored
                  summary against your company profile.
                </p>
              )}
              {opportunity.source_url && (
                <a
                  href={opportunity.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Open full notice on SAM.gov
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </CardContent>
          </Card>

          {/* Agency Intel */}
          {score?.agency_intel && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Agency Intelligence
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-line">
                  {score.agency_intel}
                </p>
                {score.citations && score.citations.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Sources
                    </p>
                    {score.citations.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-primary hover:underline truncate"
                      >
                        {url}
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Incumbent Info */}
          {score?.incumbent_info && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Incumbent Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-line">
                  {score.incumbent_info}
                </p>
              </CardContent>
            </Card>
          )}

          {/* NAICS Codes — the codes the agency filed this opportunity under */}
          {opportunity.naics_codes && opportunity.naics_codes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">NAICS Codes</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  The industry codes this opportunity is filed under by the
                  agency. To bid, your company profile should include at least
                  one of these codes (or an adjacent code in the same family).
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {opportunity.naics_codes.map((code) => {
                    const lookup = findNaicsByCode(code);
                    return (
                      <div
                        key={code}
                        className="flex items-baseline gap-3 rounded-md border bg-muted/30 px-3 py-2"
                      >
                        <Badge variant="outline" className="font-mono text-xs shrink-0">
                          {code}
                        </Badge>
                        <p className="text-sm leading-snug">
                          {lookup?.title || (
                            <span className="text-muted-foreground italic">
                              Description not on file — look up at{" "}
                              <a
                                href={`https://www.census.gov/naics/?input=${code}&year=2022`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                census.gov/naics
                              </a>
                            </span>
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
