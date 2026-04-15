"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DocumentUploader } from "@/components/features/document-uploader";
import {
  BookOpen,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/documents?type=company");
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
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

  const stats = {
    documents: documents.length,
    indexedChunks: documents.reduce((sum, doc) => sum + doc.chunk_count, 0),
    processing: documents.filter((doc) => doc.processing_status === "processing")
      .length,
    errors: documents.filter((doc) => doc.processing_status === "error").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Knowledge Base</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload and index reusable company evidence for proposal drafting
        </p>
      </div>

      <DocumentUploader
        type="company"
        title="Upload Company Documents"
        description="Past proposals, capability statements, resumes, past performance references, and certifications"
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
                Upload company documents to build the evidence library the drafter
                can cite.
              </p>
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
                    {getStatusBadge(document.processing_status)}
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
