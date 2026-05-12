"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Target,
  Search,
  Clock,
  DollarSign,
  Building2,
  Loader2,
  ArrowRight,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { formatAgency, formatValueRange } from "@/lib/opportunities/format";
import { findNaicsByCode } from "@/lib/profile/naics-codes";

interface Opportunity {
  id: string;
  title: string;
  agency: string;
  solicitation_number?: string;
  response_deadline?: string;
  posted_date?: string;
  set_aside_type?: string;
  estimated_value_min?: number;
  estimated_value_max?: number;
  naics_codes?: string[];
  status: string;
  source_url?: string;
  description_preview?: string | null;
  ai_enriched?: boolean;
  opportunity_scores?: Array<{
    overall_score: number;
    recommendation: string;
    score_rationale?: string;
  }>;
}

function getScoreBadge(score: number) {
  if (score >= 75) {
    return (
      <Badge className="bg-success/10 text-success border-success/20 gap-1">
        {score} — Pursue
      </Badge>
    );
  }
  if (score >= 50) {
    return (
      <Badge className="bg-warning/10 text-warning border-warning/20 gap-1">
        {score} — Monitor
      </Badge>
    );
  }
  return (
    <Badge className="bg-danger/10 text-danger border-danger/20 gap-1">
      {score} — Pass
    </Badge>
  );
}

function formatDeadline(dateStr?: string): { label: string; urgent: boolean } {
  if (!dateStr) return { label: "No deadline", urgent: false };
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil(
    (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return { label: "Expired", urgent: true };
  if (diffDays === 0) return { label: "Due today", urgent: true };
  if (diffDays <= 7) return { label: `${diffDays}d left`, urgent: true };
  if (diffDays <= 30) return { label: `${diffDays}d left`, urgent: false };
  return {
    label: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    urgent: false,
  };
}

function cleanTitle(title: string): string {
  // Many SAM titles are all-caps shorthand (e.g. "STRAINER, WYE 3.00").
  // If a title looks all-caps with little punctuation, convert to title case.
  if (!/[a-z]/.test(title) && title.length > 3) {
    return title
      .toLowerCase()
      .split(/\s+/)
      .map((word) => {
        if (/^\d/.test(word)) return word;
        if (/^[a-z]{1,3}$/.test(word)) return word.toUpperCase();
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  }
  return title;
}

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [filter, setFilter] = useState<{
    setAside?: string;
    minScore?: number;
  }>({});

  useEffect(() => {
    fetchOpportunities();
  }, []);

  async function fetchOpportunities() {
    setLoading(true);
    try {
      const res = await fetch("/api/opportunities");
      if (res.ok) {
        const data = await res.json();
        setOpportunities(data);
      }
    } catch (error) {
      console.error("Failed to fetch opportunities:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDiscover() {
    setDiscovering(true);
    try {
      const response = await fetch("/api/opportunities/discover", { method: "POST" });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Discovery failed");
      }

      const result = await response.json();
      const enrichedCount = result.enrichment?.enriched ?? 0;
      const enrichmentNote = enrichedCount
        ? ` AI analysis complete for ${enrichedCount} top match${enrichedCount === 1 ? "" : "es"}.`
        : "";
      toast.success(
        `Discovery complete: ${result.opportunitiesCreated || 0} new, ${
          result.opportunitiesRefreshed || 0
        } refreshed, ${result.opportunitiesSkipped || 0} skipped.${enrichmentNote}`
      );
      await fetchOpportunities();
    } catch (error) {
      console.error("Discovery failed:", error);
      toast.error(error instanceof Error ? error.message : "Discovery failed");
    } finally {
      setDiscovering(false);
    }
  }

  const filteredOpportunities = opportunities.filter((opp) => {
    if (filter.setAside && opp.set_aside_type !== filter.setAside) return false;
    if (filter.minScore) {
      const score = opp.opportunity_scores?.[0]?.overall_score ?? 0;
      if (score < filter.minScore) return false;
    }
    return true;
  });

  const setAsideTypes = [
    ...new Set(opportunities.map((o) => o.set_aside_type).filter(Boolean)),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Opportunity Pipeline
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Discover and score government RFP opportunities
          </p>
        </div>
        <Button
          onClick={handleDiscover}
          disabled={discovering}
          className="gap-2"
        >
          {discovering ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Discovering...
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              Run Discovery
            </>
          )}
        </Button>
      </div>

      {/* Score Legend */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-4 py-2.5">
        <span className="text-xs font-medium text-muted-foreground shrink-0">Score guide:</span>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-success" />
          <span className="text-xs text-muted-foreground">75–100 · Pursue — strong match</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-warning" />
          <span className="text-xs text-muted-foreground">50–74 · Monitor — partial fit</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-danger" />
          <span className="text-xs text-muted-foreground">&lt;50 · Pass — low alignment</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={!filter.setAside ? "secondary" : "outline"}
          size="sm"
          onClick={() => setFilter((f) => ({ ...f, setAside: undefined }))}
        >
          All Set-Asides
        </Button>
        {setAsideTypes.map((sa) => (
          <Button
            key={sa}
            variant={filter.setAside === sa ? "secondary" : "outline"}
            size="sm"
            onClick={() => setFilter((f) => ({ ...f, setAside: sa ?? undefined }))}
          >
            {sa}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Min Score:</span>
          {[0, 50, 75].map((score) => (
            <Button
              key={score}
              variant={
                (filter.minScore || 0) === score ? "secondary" : "outline"
              }
              size="sm"
              onClick={() =>
                setFilter((f) => ({
                  ...f,
                  minScore: score || undefined,
                }))
              }
            >
              {score === 0 ? "Any" : `${score}+`}
            </Button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={fetchOpportunities} title="Refresh list">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Opportunities Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-3">
            Loading opportunities...
          </p>
        </div>
      ) : filteredOpportunities.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Target className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No opportunities yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Complete your company profile first, then click &ldquo;Run Discovery&rdquo; to
              search SAM.gov for matching federal RFPs. Each result is scored
              against your capabilities.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-5">
              <Link href="/profile">
                <Button variant="outline" size="sm">
                  Complete Profile First
                </Button>
              </Link>
              <Button size="sm" onClick={handleDiscover} disabled={discovering} className="gap-2">
                {discovering ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                Run Discovery
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredOpportunities.map((opp) => {
            const score = opp.opportunity_scores?.[0];
            const agency = formatAgency(opp.agency);
            const deadline = formatDeadline(opp.response_deadline);
            const summary =
              opp.description_preview ||
              score?.score_rationale ||
              null;
            const valueLabel = formatValueRange(
              opp.estimated_value_min,
              opp.estimated_value_max
            );
            return (
              <Link
                key={opp.id}
                href={`/opportunities/${opp.id}`}
                className="block"
              >
                <Card className="group flex h-full flex-col cursor-pointer transition-all hover:shadow-md hover:border-primary/20">
                  <CardHeader className="pb-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle
                        className="text-sm font-semibold leading-snug line-clamp-2"
                        title={opp.title}
                      >
                        {cleanTitle(opp.title)}
                      </CardTitle>
                      {score && getScoreBadge(score.overall_score)}
                    </div>
                    <div className="flex items-start gap-2 text-xs">
                      <Building2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {agency.primary}
                        </p>
                        {agency.subUnit && (
                          <p className="text-muted-foreground truncate" title={opp.agency}>
                            {agency.subUnit}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col space-y-3">
                    {summary ? (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        {summary}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        AI summary pending — open to run analysis or view on SAM.gov.
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                      <div
                        className={`flex items-center gap-1 ${
                          deadline.urgent ? "text-danger font-medium" : "text-muted-foreground"
                        }`}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        <span>{deadline.label}</span>
                      </div>
                      {opp.posted_date && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            Posted{" "}
                            {new Date(opp.posted_date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      )}
                      {valueLabel !== "N/A" && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <DollarSign className="h-3.5 w-3.5" />
                          <span>{valueLabel}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {opp.naics_codes?.slice(0, 3).map((code) => {
                        const lookup = findNaicsByCode(code);
                        return (
                          <Badge
                            key={code}
                            variant="outline"
                            className="text-xs px-1.5 py-0"
                            title={lookup ? `${code} — ${lookup.title}` : code}
                          >
                            {code}
                          </Badge>
                        );
                      })}
                      {opp.naics_codes && opp.naics_codes.length > 3 && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          +{opp.naics_codes.length - 3}
                        </Badge>
                      )}
                      {opp.set_aside_type && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                          {opp.set_aside_type}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-auto flex items-center justify-end pt-1">
                      <span className="text-xs text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        View Details
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
