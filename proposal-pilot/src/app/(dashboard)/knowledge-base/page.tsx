"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentUploader } from "@/components/features/document-uploader";
import { BookOpen, FileText, Search, Tag } from "lucide-react";

export default function KnowledgeBasePage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Knowledge Base</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload and manage your company&apos;s proposal evidence
        </p>
      </div>

      {/* Upload Zone */}
      <DocumentUploader
        type="company"
        title="Upload Company Documents"
        description="Past proposals, capability statements, resumes, past performance references, and certifications"
      />

      {/* Evidence Overview */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Past Performance",
            count: 0,
            icon: FileText,
            color: "text-chart-1",
          },
          {
            label: "Technical Approach",
            count: 0,
            icon: BookOpen,
            color: "text-chart-2",
          },
          {
            label: "Key Personnel",
            count: 0,
            icon: Tag,
            color: "text-chart-3",
          },
        ].map((cat) => (
          <Card key={cat.label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <cat.icon className={`h-5 w-5 ${cat.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium">{cat.label}</p>
                <p className="text-2xl font-bold">{cat.count}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Documents List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Indexed Documents</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Search className="h-3.5 w-3.5" /> Search Evidence
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              No documents indexed yet
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
              Upload past proposals, capability statements, and resumes to build
              your evidence library.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
