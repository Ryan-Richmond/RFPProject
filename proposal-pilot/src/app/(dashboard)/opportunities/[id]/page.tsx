"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Clock,
  DollarSign,
  ExternalLink,
  FileSearch,
  Lightbulb,
  Loader2,
  Shield,
  Sparkles,
  Target,
  Trophy,
  Users,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  formatAgency,
  formatValueRange,
  getScoreImprovementTip,
} from "@/lib/opportunities/format";
import { findNaicsByCode } from "@/lib/profile/naics-codes";

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

  async function fetchOpportunity() {
    try {
      const res = await fetch(`/api/opportunities/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setOpportunity(data);
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
    setPromoting(true);
    try {
      const res = await fetch(`/api/opportunities/${params.id}`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/proposals/${data.proposalId || data.solicitationId}`);
      }
    } catch (error) {
      console.error("Failed to promote opportunity:", error);
    } finally {
      setPromoting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
  const hasDescriptionText =
    typeof opportunity.description === "string" &&
    opportunity.description.trim().length > 0 &&
    !/^https?:\/\//i.test(opportunity.description.trim());

  return (
    <div className="space-y-6">
      {/* Back button + Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 gap-1"
          onClick={() => router.push("/opportunities")}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Pipeline
        </Button>

        <div className="flex items-start justify-between">
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
              <p className="text-sm font-medium">
                {score ? `${score.overall_score}/100` : "Not scored"}
              </p>
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
            <CardHeader>
              <CardTitle className="text-sm">Score Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {score ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl font-bold">
                      {score.overall_score}
                    </span>
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
