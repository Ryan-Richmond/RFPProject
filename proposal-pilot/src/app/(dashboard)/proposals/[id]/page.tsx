"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PipelineStepper } from "@/components/features/pipeline-stepper";
import {
  CheckCircle2,
  CircleDashed,
  Download,
  FileSearch,
  Loader2,
  PenTool,
  Save,
  Shield,
  Sparkles,
  Target,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

interface ProposalRequirement {
  id: string;
  requirement_id: string;
  category: string;
  text: string;
  section_ref?: string | null;
  readiness_score?: "green" | "yellow" | "red" | null;
}

interface ProposalSection {
  id: string;
  title: string;
  content: string;
  section_order: number;
  placeholders?: string[] | null;
  confidence?: "high" | "medium" | "low" | null;
  review_status: "pending" | "accepted" | "rejected" | "edited";
  citations?: Array<{
    id: string;
    source_document_name?: string | null;
    excerpt?: string | null;
  }>;
}

interface ComplianceFinding {
  id: string;
  requirement_id: string;
  status: "addressed" | "partially_addressed" | "weak" | "unaddressed";
  draft_location?: string | null;
  issue?: string | null;
  suggestion?: string | null;
}

interface ProposalDetail {
  id: string;
  total_word_count?: number | null;
  proposal_sections: ProposalSection[];
  compliance_findings: ComplianceFinding[];
  requirements: ProposalRequirement[];
  compliance_matrix: Array<{
    id: string;
    instruction_ref: string;
    instruction_text: string;
    evaluation_ref?: string | null;
    evaluation_text?: string | null;
  }>;
  solicitations: {
    id: string;
    title: string;
    agency?: string | null;
    classification?: string | null;
    solicitation_number?: string | null;
    due_date?: string | null;
    status: string;
    win_probability?: number | null;
    bid_decision_recommendation?: string | null;
    key_win_factors?: string[] | null;
    key_risk_factors?: string[] | null;
    source_documents?: {
      filename: string;
      page_count?: number | null;
      created_at: string;
    } | null;
  };
}

function getConfidenceBadge(confidence?: ProposalSection["confidence"]) {
  if (!confidence) {
    return <Badge variant="secondary">Unknown</Badge>;
  }

  const className =
    confidence === "high"
      ? "bg-success/10 text-success border-success/20"
      : confidence === "medium"
      ? "bg-warning/10 text-warning border-warning/20"
      : "bg-danger/10 text-danger border-danger/20";

  return (
    <Badge className={className}>
      {confidence.charAt(0).toUpperCase() + confidence.slice(1)} confidence
    </Badge>
  );
}

function getReviewBadge(status: ProposalSection["review_status"]) {
  switch (status) {
    case "accepted":
      return (
        <Badge className="bg-success/10 text-success border-success/20 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Accepted
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-danger/10 text-danger border-danger/20 gap-1">
          <XCircle className="h-3 w-3" />
          Rejected
        </Badge>
      );
    case "edited":
      return (
        <Badge className="bg-primary/10 text-primary border-primary/20 gap-1">
          <PenTool className="h-3 w-3" />
          Edited
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="gap-1">
          <CircleDashed className="h-3 w-3" />
          Pending review
        </Badge>
      );
  }
}

export default function ProposalDetailPage() {
  const params = useParams<{ id: string }>();
  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [runningCompliance, setRunningCompliance] = useState(false);
  const [estimatingWin, setEstimatingWin] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});
  const [savingSectionId, setSavingSectionId] = useState<string | null>(null);
  const [exportingMode, setExportingMode] = useState<"clean" | "annotated" | null>(
    null
  );

  const fetchProposal = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/proposals/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setProposal(data);
      }
    } catch (error) {
      console.error("Failed to fetch proposal:", error);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  const pipelineStages = useMemo(() => {
    if (!proposal) {
      return {
        indexed: "pending",
        analyzed: "pending",
        drafted: "pending",
        compliant: "pending",
      } as const;
    }

    return {
      indexed: proposal.solicitations.source_documents ? "completed" : "pending",
      analyzed:
        proposal.requirements.length > 0
          ? "completed"
          : proposal.solicitations.status === "analyzing"
          ? "active"
          : "pending",
      drafted:
        proposal.proposal_sections.length > 0
          ? "completed"
          : proposal.requirements.length > 0
          ? "active"
          : "pending",
      compliant:
        proposal.compliance_findings.length > 0
          ? "completed"
          : proposal.proposal_sections.length > 0
          ? "active"
          : "pending",
    } as const;
  }, [proposal]);

  const complianceSummary = useMemo(() => {
    if (!proposal) {
      return null;
    }

    return proposal.compliance_findings.reduce(
      (acc, finding) => {
        acc[finding.status] += 1;
        return acc;
      },
      {
        addressed: 0,
        partially_addressed: 0,
        weak: 0,
        unaddressed: 0,
      }
    );
  }, [proposal]);

  async function runAnalysis() {
    if (!proposal) return;

    setRunningAnalysis(true);
    try {
      const response = await fetch(
        `/api/solicitations/${proposal.solicitations.id}/analyze`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Analysis failed");
      }

      await fetchProposal();
      toast.success("RFP analysis completed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setRunningAnalysis(false);
    }
  }

  async function runDraft() {
    if (!proposal) return;

    setGeneratingDraft(true);
    try {
      const response = await fetch(`/api/proposals/${proposal.id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Draft generation failed");
      }

      await fetchProposal();
      toast.success("Draft generated.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Draft generation failed"
      );
    } finally {
      setGeneratingDraft(false);
    }
  }

  async function runComplianceCheck() {
    if (!proposal) return;

    setRunningCompliance(true);
    try {
      const response = await fetch(`/api/proposals/${proposal.id}/compliance`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Compliance check failed");
      }

      await fetchProposal();
      toast.success("Compliance check completed.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Compliance check failed"
      );
    } finally {
      setRunningCompliance(false);
    }
  }

  async function estimateWinProbability() {
    if (!proposal) return;

    setEstimatingWin(true);
    try {
      const response = await fetch(
        `/api/solicitations/${proposal.solicitations.id}/win-probability`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Win probability estimate failed");
      }

      await fetchProposal();
      toast.success("Competitive intelligence updated.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Win probability estimate failed"
      );
    } finally {
      setEstimatingWin(false);
    }
  }

  async function saveSection(
    sectionId: string,
    payload: { content?: string; reviewStatus?: string }
  ) {
    if (!proposal) return;

    setSavingSectionId(sectionId);
    try {
      const response = await fetch(`/api/proposals/${proposal.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId,
          content: payload.content,
          reviewStatus: payload.reviewStatus,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Section update failed");
      }

      setEditingSectionId(null);
      await fetchProposal();
      toast.success("Section updated.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Section update failed"
      );
    } finally {
      setSavingSectionId(null);
    }
  }

  async function exportProposal(mode: "clean" | "annotated") {
    if (!proposal) return;

    setExportingMode(mode);
    try {
      const response = await fetch(`/api/proposals/${proposal.id}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Export failed");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const contentDisposition = response.headers.get("content-disposition");
      const match = contentDisposition?.match(/filename="([^"]+)"/);
      const filename =
        match?.[1] ||
        `${proposal.solicitations.title || "proposal"}-${mode}.docx`;

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      toast.success(
        mode === "clean"
          ? "Clean proposal export downloaded."
          : "Annotated proposal export downloaded."
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExportingMode(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">Proposal not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {proposal.solicitations.title}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">
              {(proposal.solicitations.classification || "unclassified").replace(
                "_",
                " "
              )}
            </Badge>
            {proposal.solicitations.solicitation_number ? (
              <span>{proposal.solicitations.solicitation_number}</span>
            ) : null}
            {proposal.solicitations.due_date ? (
              <span>
                Due {new Date(proposal.solicitations.due_date).toLocaleDateString()}
              </span>
            ) : null}
            <span>{proposal.solicitations.agency || "Unknown agency"}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={runAnalysis}
            disabled={runningAnalysis}
          >
            {runningAnalysis ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSearch className="h-4 w-4" />
            )}
            Analyze
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={runDraft}
            disabled={generatingDraft || proposal.requirements.length === 0}
          >
            {generatingDraft ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PenTool className="h-4 w-4" />
            )}
            Generate Draft
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={runComplianceCheck}
            disabled={runningCompliance || proposal.proposal_sections.length === 0}
          >
            {runningCompliance ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Shield className="h-4 w-4" />
            )}
            Run Compliance
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
              disabled={exportingMode !== null}
            >
              {exportingMode ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => exportProposal("clean")}>
                Export Clean Docx
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportProposal("annotated")}>
                Export Annotated Docx
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <PipelineStepper stages={pipelineStages} />

      <Tabs defaultValue="analysis" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="competitive-intel">Competitive Intel</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Source Document</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {proposal.solicitations.source_documents ? (
                  <>
                    <div className="rounded-lg border p-3">
                      <p className="font-medium">
                        {proposal.solicitations.source_documents.filename}
                      </p>
                      <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                        {proposal.solicitations.source_documents.page_count ? (
                          <p>
                            {proposal.solicitations.source_documents.page_count} pages
                          </p>
                        ) : null}
                        <p>
                          Uploaded{" "}
                          {new Date(
                            proposal.solicitations.source_documents.created_at
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Requirements
                      </p>
                      <p className="mt-1 text-2xl font-bold">
                        {proposal.requirements.length}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    No source document attached.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Extracted Requirements</CardTitle>
                <Badge variant="secondary">{proposal.requirements.length} found</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {proposal.requirements.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      Run the analyzer to extract requirements and build the compliance
                      matrix.
                    </p>
                  </div>
                ) : (
                  proposal.requirements.map((requirement) => (
                    <div key={requirement.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {requirement.requirement_id}
                          </Badge>
                          <Badge variant="secondary" className="capitalize">
                            {requirement.category.replace("_", " ")}
                          </Badge>
                        </div>
                        {requirement.readiness_score ? (
                          <Badge
                            className={
                              requirement.readiness_score === "green"
                                ? "bg-success/10 text-success border-success/20"
                                : requirement.readiness_score === "yellow"
                                ? "bg-warning/10 text-warning border-warning/20"
                                : "bg-danger/10 text-danger border-danger/20"
                            }
                          >
                            {requirement.readiness_score}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed">
                        {requirement.text}
                      </p>
                      {requirement.section_ref ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {requirement.section_ref}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Compliance Matrix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {proposal.compliance_matrix.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No compliance matrix available yet.
                </p>
              ) : (
                proposal.compliance_matrix.map((entry) => (
                  <div key={entry.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{entry.instruction_ref}</Badge>
                      {entry.evaluation_ref ? (
                        <Badge variant="secondary">{entry.evaluation_ref}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm">{entry.instruction_text}</p>
                    {entry.evaluation_text ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.evaluation_text}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="draft" className="space-y-4">
          {proposal.proposal_sections.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <PenTool className="h-10 w-10 text-primary/60" />
                <p className="mt-4 text-sm text-muted-foreground">
                  Generate a draft to create section-by-section proposal content with
                  citations and placeholders.
                </p>
                <Button
                  className="mt-4 gap-2"
                  onClick={runDraft}
                  disabled={generatingDraft || proposal.requirements.length === 0}
                >
                  {generatingDraft ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Generate Draft
                </Button>
              </CardContent>
            </Card>
          ) : (
            proposal.proposal_sections.map((section) => (
              <Card key={section.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {getConfidenceBadge(section.confidence)}
                      {getReviewBadge(section.review_status)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingSectionId(section.id);
                        setDraftEdits((prev) => ({
                          ...prev,
                          [section.id]: section.content,
                        }));
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        saveSection(section.id, { reviewStatus: "accepted" })
                      }
                      disabled={savingSectionId === section.id}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        saveSection(section.id, { reviewStatus: "rejected" })
                      }
                      disabled={savingSectionId === section.id}
                    >
                      Reject
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editingSectionId === section.id ? (
                    <div className="space-y-3">
                      <textarea
                        className="min-h-[240px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={draftEdits[section.id] || ""}
                        onChange={(event) =>
                          setDraftEdits((prev) => ({
                            ...prev,
                            [section.id]: event.target.value,
                          }))
                        }
                      />
                      <div className="flex gap-2">
                        <Button
                          className="gap-2"
                          onClick={() =>
                            saveSection(section.id, {
                              content: draftEdits[section.id] || "",
                              reviewStatus: "edited",
                            })
                          }
                          disabled={savingSectionId === section.id}
                        >
                          {savingSectionId === section.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          Save Changes
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setEditingSectionId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {section.content}
                    </div>
                  )}

                  {section.placeholders?.length ? (
                    <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
                      <p className="font-medium text-warning">Placeholders</p>
                      <ul className="mt-2 space-y-1 text-muted-foreground">
                        {section.placeholders.map((placeholder) => (
                          <li key={placeholder}>{placeholder}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {section.citations?.length ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Citations
                      </p>
                      {section.citations.map((citation) => (
                        <div
                          key={citation.id}
                          className="rounded-lg border p-3 text-xs text-muted-foreground"
                        >
                          <p className="font-medium text-foreground">
                            {citation.source_document_name || "Evidence source"}
                          </p>
                          <p className="mt-1">{citation.excerpt || "No excerpt available."}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Compliance Findings</h2>
              <p className="text-sm text-muted-foreground">
                Requirement-by-requirement coverage assessment for the current draft
              </p>
            </div>
            <Button
              className="gap-2"
              onClick={runComplianceCheck}
              disabled={runningCompliance || proposal.proposal_sections.length === 0}
            >
              {runningCompliance ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              Run Compliance
            </Button>
          </div>

          {complianceSummary ? (
            <div className="grid gap-4 sm:grid-cols-4">
              {[
                { label: "Addressed", value: complianceSummary.addressed },
                {
                  label: "Partial",
                  value: complianceSummary.partially_addressed,
                },
                { label: "Weak", value: complianceSummary.weak },
                { label: "Unaddressed", value: complianceSummary.unaddressed },
              ].map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="pt-6">
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}

          <Card>
            <CardContent className="pt-6">
              {proposal.compliance_findings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No compliance findings yet. Generate a draft and run the
                  compliance checker.
                </p>
              ) : (
                <div className="space-y-3">
                  {proposal.compliance_findings.map((finding) => (
                    <div key={finding.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="font-mono">
                          {finding.requirement_id}
                        </Badge>
                        <Badge
                          className={
                            finding.status === "addressed"
                              ? "bg-success/10 text-success border-success/20"
                              : finding.status === "partially_addressed"
                              ? "bg-warning/10 text-warning border-warning/20"
                              : finding.status === "weak"
                              ? "bg-warning/10 text-warning border-warning/20"
                              : "bg-danger/10 text-danger border-danger/20"
                          }
                        >
                          {finding.status.replace("_", " ")}
                        </Badge>
                      </div>
                      {finding.draft_location ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {finding.draft_location}
                        </p>
                      ) : null}
                      {finding.issue ? (
                        <p className="mt-2 text-sm">{finding.issue}</p>
                      ) : null}
                      {finding.suggestion ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {finding.suggestion}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="competitive-intel" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Bid Recommendation</CardTitle>
              <Button
                variant="outline"
                className="gap-2"
                onClick={estimateWinProbability}
                disabled={estimatingWin || proposal.requirements.length === 0}
              >
                {estimatingWin ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Target className="h-4 w-4" />
                )}
                Update Intel
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Win Probability
                  </p>
                  <p className="mt-2 text-3xl font-bold">
                    {proposal.solicitations.win_probability != null
                      ? `${proposal.solicitations.win_probability}%`
                      : "—"}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Recommendation
                  </p>
                  <p className="mt-2 text-base font-semibold capitalize">
                    {proposal.solicitations.bid_decision_recommendation ||
                      "Not estimated yet"}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Key Win Factors
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {(proposal.solicitations.key_win_factors || []).length > 0 ? (
                      proposal.solicitations.key_win_factors?.map((factor) => (
                        <li key={factor}>{factor}</li>
                      ))
                    ) : (
                      <li>No win factors captured yet.</li>
                    )}
                  </ul>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Key Risk Factors
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {(proposal.solicitations.key_risk_factors || []).length > 0 ? (
                      proposal.solicitations.key_risk_factors?.map((factor) => (
                        <li key={factor}>{factor}</li>
                      ))
                    ) : (
                      <li>No risk factors captured yet.</li>
                    )}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
