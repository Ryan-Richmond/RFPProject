"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Cpu,
  Activity,
  Search,
  FileSearch,
  PenTool,
  CheckCircle2,
  Target,
  Loader2,
  RefreshCw,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AgentOperation {
  id: string;
  operation_type: string;
  status: string;
  input_summary?: string;
  output_summary?: string;
  citations_count: number;
  model_used?: string;
  duration_ms?: number;
  created_at: string;
  completed_at?: string;
}

interface OperationStats {
  totalOperations: number;
  discoveryCount: number;
  analysisCount: number;
  draftingCount: number;
  complianceCount: number;
  scoringCount: number;
  runningCount: number;
}

function getOperationIcon(type: string) {
  switch (type) {
    case "discovery":
      return <Search className="h-4 w-4" />;
    case "analysis":
      return <FileSearch className="h-4 w-4" />;
    case "drafting":
      return <PenTool className="h-4 w-4" />;
    case "compliance":
      return <CheckCircle2 className="h-4 w-4" />;
    case "scoring":
      return <Target className="h-4 w-4" />;
    default:
      return <Cpu className="h-4 w-4" />;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "running":
      return (
        <Badge className="bg-primary/10 text-primary border-primary/20 gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Running
        </Badge>
      );
    case "completed":
      return (
        <Badge className="bg-success/10 text-success border-success/20 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Complete
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-danger/10 text-danger border-danger/20 gap-1">
          <AlertCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function formatDuration(ms?: number): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return date.toLocaleDateString();
}

export default function ComputerOpsPage() {
  const [operations, setOperations] = useState<AgentOperation[]>([]);
  const [stats, setStats] = useState<OperationStats | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchOperations() {
    try {
      const res = await fetch("/api/agent-operations");
      if (res.ok) {
        const data = await res.json();
        setOperations(data.operations || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error("Failed to fetch operations:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOperations();
    // Auto-refresh every 5 seconds when there are running operations
    const interval = setInterval(() => {
      fetchOperations();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const hasRunning = stats?.runningCount && stats.runningCount > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Cpu className="h-6 w-6" />
              Agent Activity
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Live feed of all Perplexity Agent operations
            </p>
          </div>
          {hasRunning && (
            <span className="relative flex h-3 w-3 ml-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-success" />
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={fetchOperations}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Total This Week
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOperations}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Discovery
              </CardTitle>
              <Search className="h-4 w-4 text-muted-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.discoveryCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Analysis
              </CardTitle>
              <FileSearch className="h-4 w-4 text-muted-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.analysisCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Drafting
              </CardTitle>
              <PenTool className="h-4 w-4 text-muted-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.draftingCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Compliance
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.complianceCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Scoring
              </CardTitle>
              <Target className="h-4 w-4 text-muted-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.scoringCount}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Operations Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Operation Log
            {hasRunning && (
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs ml-2">
                {stats?.runningCount} running
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">
                Loading operations...
              </p>
            </div>
          ) : operations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Cpu className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                No agent operations yet
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Operations will appear here when the system runs discovery,
                analysis, drafting, or compliance checks.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {operations.map((op) => (
                <div
                  key={op.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                    op.status === "running"
                      ? "border-primary/20 bg-primary/5"
                      : ""
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                      op.status === "running"
                        ? "bg-primary/10 text-primary"
                        : op.status === "completed"
                          ? "bg-success/10 text-success"
                          : "bg-danger/10 text-danger"
                    }`}
                  >
                    {getOperationIcon(op.operation_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium capitalize">
                        {op.operation_type}
                      </span>
                      {getStatusBadge(op.status)}
                      {op.model_used && (
                        <Badge variant="outline" className="text-xs">
                          {op.model_used}
                        </Badge>
                      )}
                    </div>
                    {op.input_summary && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {op.input_summary}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(op.created_at)}
                      </span>
                      {op.duration_ms && (
                        <span className="text-xs text-muted-foreground">
                          {formatDuration(op.duration_ms)}
                        </span>
                      )}
                      {op.citations_count > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {op.citations_count} citations
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
