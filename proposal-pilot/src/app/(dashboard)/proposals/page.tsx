"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentUploader } from "@/components/features/document-uploader";
import {
  FileSearch,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

// Demo data — will be replaced with Supabase queries
const demoProposals = [
  {
    id: "demo-1",
    title: "NASA SEWP VI — IT Modernization Services",
    agency: "NASA",
    classification: "federal",
    status: "analyzing",
    due_date: "2026-06-15",
    requirements_count: 32,
    readiness: { green: 18, yellow: 8, red: 6 },
  },
  {
    id: "demo-2",
    title: "VA Maryland — EHR Support Services",
    agency: "Department of Veterans Affairs",
    classification: "federal",
    status: "draft_ready",
    due_date: "2026-05-30",
    requirements_count: 24,
    readiness: { green: 20, yellow: 3, red: 1 },
  },
];

function getStatusBadge(status: string) {
  switch (status) {
    case "analyzing":
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" /> Analyzing
        </Badge>
      );
    case "draft_ready":
      return (
        <Badge className="gap-1 bg-success/10 text-success border-success/20">
          <CheckCircle2 className="h-3 w-3" /> Draft Ready
        </Badge>
      );
    case "needs_review":
      return (
        <Badge variant="secondary" className="gap-1 bg-warning/10 text-warning border-warning/20">
          <AlertCircle className="h-3 w-3" /> Needs Review
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function ProposalsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proposals</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upload RFPs and manage your proposal pipeline
          </p>
        </div>
      </div>

      {/* Upload RFP */}
      <DocumentUploader
        type="rfp"
        title="Upload a New RFP"
        description="Federal or state/local solicitation documents"
      />

      {/* Proposals List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Proposals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {demoProposals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <FileSearch className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                No proposals yet
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Upload an RFP to start your first proposal
              </p>
            </div>
          ) : (
            demoProposals.map((proposal) => (
              <Link
                key={proposal.id}
                href={`/proposals/${proposal.id}`}
                className="block"
              >
                <div className="group flex items-center gap-4 rounded-lg border bg-card p-4 transition-all hover:shadow-sm hover:border-primary/20">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FileSearch className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold truncate">
                        {proposal.title}
                      </h3>
                      {getStatusBadge(proposal.status)}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {proposal.agency}
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <Badge variant="outline" className="text-xs px-1.5 py-0">
                        {proposal.classification}
                      </Badge>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        Due {proposal.due_date}
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        {proposal.requirements_count} requirements
                      </span>
                    </div>
                    {/* Readiness dots */}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center gap-1 text-xs">
                        <span className="inline-block h-2 w-2 rounded-full bg-success" />
                        <span className="text-muted-foreground">
                          {proposal.readiness.green}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <span className="inline-block h-2 w-2 rounded-full bg-warning" />
                        <span className="text-muted-foreground">
                          {proposal.readiness.yellow}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <span className="inline-block h-2 w-2 rounded-full bg-danger" />
                        <span className="text-muted-foreground">
                          {proposal.readiness.red}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
