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
  Loader2,
  Shield,
  Target,
  Trophy,
  Users,
  ArrowLeft,
} from "lucide-react";

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
  }>;
}

function ScoreBar({ label, score }: { label: string; score: number }) {
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

  useEffect(() => {
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
    fetchOpportunity();
  }, [params.id]);

  async function handleStartProposal() {
    setPromoting(true);
    try {
      const res = await fetch(`/api/opportunities/${params.id}`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/proposals/${data.solicitationId}`);
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
                  View Source
                </Button>
              </a>
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

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Agency</p>
              <p className="text-sm font-medium">{opportunity.agency}</p>
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
          <CardContent className="flex items-center gap-3 pt-6">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Estimated Value</p>
              <p className="text-sm font-medium">
                {opportunity.estimated_value_min || opportunity.estimated_value_max
                  ? `$${(opportunity.estimated_value_min || 0).toLocaleString()} - $${(opportunity.estimated_value_max || 0).toLocaleString()}`
                  : "N/A"}
              </p>
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
                  />
                  <ScoreBar label="Size Fit" score={score.size_fit_score} />
                  <ScoreBar
                    label="Capability Match"
                    score={score.capability_match_score}
                  />
                  <ScoreBar
                    label="Set-Aside Eligibility"
                    score={score.set_aside_eligibility_score}
                  />
                  <ScoreBar
                    label="Competition Level"
                    score={score.competition_level_score}
                  />
                  <ScoreBar
                    label="Timeline Fit"
                    score={score.timeline_fit_score}
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
          {/* Description */}
          {opportunity.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">
                  {opportunity.description}
                </p>
              </CardContent>
            </Card>
          )}

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

          {/* NAICS Codes */}
          {opportunity.naics_codes && opportunity.naics_codes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">NAICS Codes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {opportunity.naics_codes.map((code) => (
                    <Badge key={code} variant="outline">
                      {code}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
