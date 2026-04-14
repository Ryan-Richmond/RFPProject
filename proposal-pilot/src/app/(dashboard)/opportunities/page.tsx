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
} from "lucide-react";

interface Opportunity {
  id: string;
  title: string;
  agency: string;
  solicitation_number?: string;
  response_deadline?: string;
  set_aside_type?: string;
  estimated_value_min?: number;
  estimated_value_max?: number;
  naics_codes?: string[];
  status: string;
  source_url?: string;
  opportunity_scores?: Array<{
    overall_score: number;
    recommendation: string;
    score_rationale?: string;
  }>;
}

function getScoreBadge(score: number, recommendation: string) {
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

function formatCurrency(value?: number): string {
  if (!value) return "N/A";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function formatDeadline(dateStr?: string): string {
  if (!dateStr) return "No deadline";
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil(
    (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return "Expired";
  if (diffDays === 0) return "Due today";
  if (diffDays <= 7) return `${diffDays}d left`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
      await fetch("/api/opportunities/discover", { method: "POST" });
      // Poll for results after a short delay
      setTimeout(() => {
        fetchOpportunities();
        setDiscovering(false);
      }, 3000);
    } catch (error) {
      console.error("Discovery failed:", error);
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

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Button
          variant={!filter.setAside ? "secondary" : "outline"}
          size="sm"
          onClick={() => setFilter((f) => ({ ...f, setAside: undefined }))}
        >
          All
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
        <Button variant="ghost" size="sm" onClick={fetchOpportunities}>
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
            <p className="text-sm font-medium text-muted-foreground">
              No opportunities found
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm">
              Set up your client profile and run discovery to find matching
              government RFP opportunities.
            </p>
            <div className="flex gap-3 mt-4">
              <Link href="/profile">
                <Button variant="outline" size="sm">
                  Set Up Profile
                </Button>
              </Link>
              <Button size="sm" onClick={handleDiscover} disabled={discovering}>
                Run Discovery
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredOpportunities.map((opp) => {
            const score = opp.opportunity_scores?.[0];
            return (
              <Link
                key={opp.id}
                href={`/opportunities/${opp.id}`}
                className="block"
              >
                <Card className="group h-full cursor-pointer transition-all hover:shadow-md hover:border-primary/20">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm font-semibold leading-tight line-clamp-2">
                        {opp.title}
                      </CardTitle>
                      {score && getScoreBadge(score.overall_score, score.recommendation)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{opp.agency}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{formatDeadline(opp.response_deadline)}</span>
                      </div>
                      {(opp.estimated_value_min || opp.estimated_value_max) && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <DollarSign className="h-3.5 w-3.5" />
                          <span>
                            {formatCurrency(opp.estimated_value_min)}
                            {opp.estimated_value_max
                              ? ` - ${formatCurrency(opp.estimated_value_max)}`
                              : ""}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* NAICS Tags */}
                    {opp.naics_codes && opp.naics_codes.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {opp.naics_codes.slice(0, 3).map((code) => (
                          <Badge
                            key={code}
                            variant="outline"
                            className="text-xs px-1.5 py-0"
                          >
                            {code}
                          </Badge>
                        ))}
                        {opp.naics_codes.length > 3 && (
                          <Badge
                            variant="outline"
                            className="text-xs px-1.5 py-0"
                          >
                            +{opp.naics_codes.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    {opp.set_aside_type && (
                      <Badge variant="secondary" className="text-xs">
                        {opp.set_aside_type}
                      </Badge>
                    )}

                    {score?.score_rationale && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {score.score_rationale}
                      </p>
                    )}

                    <div className="flex items-center justify-end pt-1">
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
