"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DocumentUploader } from "@/components/features/document-uploader";
import { AnimatedNumber } from "@/components/ui/animated-number";
import {
  BookOpen,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface KnowledgeBaseDocument {
  id: string;
  filename: string;
  processing_status: "queued" | "processing" | "complete" | "error";
  processing_error?: string | null;
  page_count?: number | null;
  created_at: string;
  chunk_count: number;
}

interface SearchResult {
  id: string;
  content: string;
  category: string;
  source_document_name: string;
  metadata?: {
    agency?: string;
    contract_type?: string;
    keywords?: string[];
  };
}

interface ReadinessItem {
  id: string;
  label: string;
  group: "minimum" | "high_impact" | "advanced";
  why: string;
  ready: boolean;
  matchedCount: number;
  neededForCurrentRfp?: boolean;
}

interface OnboardingReadiness {
  readinessScore: number;
  goodEnoughToStart: boolean;
  evidence: {
    minimumReady: boolean;
    minimumReadyCount: number;
    minimumTotal: number;
    totalChunks: number;
    items: ReadinessItem[];
  };
  activeProposalGap: {
    proposalId: string;
    solicitationTitle: string;
    red: number;
    yellow: number;
    categories: string[];
  } | null;
}

function getStatusBadge(status: KnowledgeBaseDocument["processing_status"]) {
  switch (status) {
    case "complete":
      return (
        <Badge className="bg-success/10 text-success border-success/20 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Indexed
        </Badge>
      );
    case "processing":
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing
        </Badge>
      );
    case "error":
      return (
        <Badge className="bg-danger/10 text-danger border-danger/20 gap-1">
          <AlertCircle className="h-3 w-3" />
          Error
        </Badge>
      );
    default:
      return <Badge variant="secondary">Queued</Badge>;
  }
}

function formatRelative(date: string) {
  const value = new Date(date);
  const diffMinutes = Math.floor((Date.now() - value.getTime()) / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
  return value.toLocaleDateString();
}

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<KnowledgeBaseDocument[]>([]);
  const [readiness, setReadiness] = useState<OnboardingReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [pendingDelete, setPendingDelete] = useState<KnowledgeBaseDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const [documentsResponse, readinessResponse] = await Promise.all([
        fetch("/api/documents?type=company"),
        fetch("/api/onboarding/readiness"),
      ]);
      if (documentsResponse.ok) {
        const data = await documentsResponse.json();
        setDocuments(data);
      }
      if (readinessResponse.ok) {
        setReadiness(await readinessResponse.json());
      }
    } catch (error) {
      console.error("Failed to fetch knowledge base documents:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const searchKnowledgeBase = useCallback(async () => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch("/api/knowledge-base/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmedQuery, limit: 6 }),
      });

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = (await response.json()) as SearchResult[];
      setSearchResults(data);
    } catch (error) {
      console.error("Failed to search knowledge base:", error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const confirmDeleteDocument = useCallback(async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/documents/${pendingDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to remove document");
      }

      toast.success(`"${pendingDelete.filename}" removed from the knowledge base.`);
      await fetchDocuments();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove document";
      console.error("Failed to remove document:", error);
      toast.error(message);
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }, [pendingDelete, fetchDocuments]);

  const stats = {
    documents: documents.length,
    indexedChunks: documents.reduce((sum, doc) => sum + doc.chunk_count, 0),
    processing: documents.filter((doc) => doc.processing_status === "processing")
      .length,
    errors: documents.filter((doc) => doc.processing_status === "error").length,
  };

  const readinessGroups = useMemo(() => {
    const items = readiness?.evidence.items || [];
    return {
      minimum: items.filter((item) => item.group === "minimum"),
      highImpact: items.filter((item) => item.group === "high_impact"),
      advanced: items.filter((item) => item.group === "advanced"),
    };
  }, [readiness]);

  const readinessSummary = useMemo(() => {
    const items = readiness?.evidence.items || [];
    const readyCount = items.filter((item) => item.ready).length;
    return {
      total: items.length,
      readyCount,
      coverageScore: items.length ? Math.round((readyCount / items.length) * 100) : 0,
    };
  }, [readiness]);

  function renderReadinessItems(items: ReadinessItem[]) {
    return (
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{item.label}</p>
                {item.neededForCurrentRfp ? (
                  <Badge className="bg-warning/10 text-warning border-warning/20">
                    Needed for current RFP
                  </Badge>
                ) : null}
              </div>
              <Badge variant={item.ready ? "default" : "outline"}>
                {item.ready ? "Ready" : "Missing"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{item.why}</p>
            {item.matchedCount > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {item.matchedCount} verified evidence chunks matched
              </p>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Delete confirmation dialog */}
      <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open && !deleting) setPendingDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove document?</DialogTitle>
            <DialogDescription>
              <strong className="text-foreground">{pendingDelete?.filename}</strong> and all its indexed evidence chunks will be permanently removed from this workspace. Any proposal sections citing this document may have reduced quality.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteDocument} disabled={deleting} className="gap-2">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Remove Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upload and index reusable company evidence for proposal drafting. The more complete your library, the higher quality your generated proposals.
          </p>
        </div>
      </div>

      <DocumentUploader
        type="company"
        title="Upload Company Documents"
        description="Past proposals, capability statements, resumes, past performance references, and certifications"
        onComplete={() => {
          fetchDocuments();
          // First successful upload — small celebration to signal the AI now has real evidence.
          import("@/lib/celebrate").then(({ celebrateOnce }) => {
            celebrateOnce("first-document-uploaded", { particleCount: 50 });
          });
        }}
      />

      <DocumentUploader
        type="legacy_proposal"
        title="Upload One Legacy Proposal"
        description="Extracts reusable capability, past performance, personnel, certification, and management evidence from one prior proposal"
        onComplete={() => {
          fetchDocuments();
        }}
      />

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Documents", value: stats.documents, icon: FileText },
          { label: "Indexed Chunks", value: stats.indexedChunks, icon: BookOpen },
          { label: "Processing", value: stats.processing, icon: Loader2 },
          { label: "Errors", value: stats.errors, icon: AlertCircle },
        ].map((stat) => (
          <Card key={stat.label} className="card-lift">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <stat.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">{stat.label}</p>
                <AnimatedNumber value={stat.value} className="text-2xl font-bold tabular-nums" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evidence Readiness</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Readiness Score</p>
              <p className="text-2xl font-bold">{readiness?.readinessScore ?? 0}%</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Minimum Pack</p>
              <p className="text-2xl font-bold">
                {readiness?.evidence.minimumReadyCount ?? 0}/{readiness?.evidence.minimumTotal ?? 3}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Library Coverage</p>
              <p className="text-2xl font-bold">{readinessSummary.coverageScore}%</p>
            </div>
          </div>
          {readiness?.activeProposalGap ? (
            <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
              <p className="text-sm font-medium">
                Current RFP gaps: {readiness.activeProposalGap.solicitationTitle}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {readiness.activeProposalGap.red} red and {readiness.activeProposalGap.yellow} yellow requirements need stronger evidence.
              </p>
            </div>
          ) : null}
          <section className="space-y-2">
            <div>
              <h2 className="text-sm font-semibold">Minimum to start</h2>
              <p className="text-xs text-muted-foreground">
                These are enough to begin useful opportunity scoring and evidence-grounded drafting.
              </p>
            </div>
            {renderReadinessItems(readinessGroups.minimum)}
          </section>
          <details className="group rounded-lg border p-3">
            <summary className="cursor-pointer list-none text-sm font-semibold">
              High impact next
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {readinessGroups.highImpact.filter((item) => item.ready).length}/{readinessGroups.highImpact.length} ready
              </span>
            </summary>
            <div className="mt-3">{renderReadinessItems(readinessGroups.highImpact)}</div>
          </details>
          <details className="group rounded-lg border p-3">
            <summary className="cursor-pointer list-none text-sm font-semibold">
              Advanced library
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {readinessGroups.advanced.filter((item) => item.ready).length}/{readinessGroups.advanced.length} ready
              </span>
            </summary>
            <div className="mt-3">{renderReadinessItems(readinessGroups.advanced)}</div>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium">Updating Company Files</p>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                Upload the newer file, verify that it indexes correctly, then remove
                the older version so stale evidence is not retrieved during drafting.
                Use filenames with dates or versions, such as &quot;Past Performance
                Narratives 2026 Q3,&quot; when content changes over time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Indexed Documents</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={searchKnowledgeBase}
              disabled={searching || !searchQuery.trim()}
            >
              <Search className="h-3.5 w-3.5" />
              {searching ? "Searching..." : "Search Evidence"}
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchDocuments}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  searchKnowledgeBase();
                }
              }}
              placeholder="Search for past performance, capabilities, agencies, or certifications"
            />
            <Button
              variant="outline"
              onClick={searchKnowledgeBase}
              disabled={searching || !searchQuery.trim()}
              className="sm:w-auto"
            >
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {searchResults.length > 0 ? (
            <div className="mb-4 space-y-3 rounded-xl border border-dashed p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Evidence Search Results</p>
                  <p className="text-xs text-muted-foreground">
                    Top semantic matches for &quot;{searchQuery.trim()}&quot;
                  </p>
                </div>
                <Badge variant="secondary">{searchResults.length} matches</Badge>
              </div>
              {searchResults.map((result) => (
                <div key={result.id} className="rounded-lg border bg-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{result.category.replace(/_/g, " ")}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {result.source_document_name}
                    </span>
                    {result.metadata?.agency ? (
                      <span className="text-xs text-muted-foreground">
                        {result.metadata.agency}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-foreground/90">
                    {result.content.slice(0, 280)}
                    {result.content.length > 280 ? "..." : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">
                Loading knowledge base...
              </p>
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                No documents indexed yet
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                Upload your company documents above — capability statements, past performance narratives, resumes, and certifications — to build the evidence library your AI drafter cites.
              </p>
              <button
                className="mt-4 flex items-center gap-2 text-xs font-medium text-primary hover:underline"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload your first document
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className="rounded-lg border bg-card px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {document.filename}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatRelative(document.created_at)}</span>
                        {document.page_count ? <span>{document.page_count} pages</span> : null}
                        <span>{document.chunk_count} chunks</span>
                      </div>
                      {document.processing_error ? (
                        <p className="mt-1 text-xs text-destructive">
                          {document.processing_error}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        render={
                          <a
                            href={`/api/documents/${document.id}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        }
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setPendingDelete(document)}
                        aria-label={`Remove ${document.filename}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      {getStatusBadge(document.processing_status)}
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
