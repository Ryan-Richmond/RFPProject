"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PipelineStepper } from "@/components/features/pipeline-stepper";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  Download,
  ExternalLink,
  FileSearch,
  History,
  Loader2,
  LockKeyhole,
  PenTool,
  RefreshCw,
  Save,
  Shield,
  Sparkles,
  Target,
  Upload,
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
  outline_section_id?: string | null;
  title: string;
  content: string;
  section_order: number;
  requirement_mappings?: string[] | null;
  placeholders?: string[] | null;
  confidence?: "high" | "medium" | "low" | null;
  review_status: "pending" | "accepted" | "rejected" | "edited";
  citations?: Array<{
    id: string;
    source_document_name?: string | null;
    excerpt?: string | null;
  }>;
  revisions?: ProposalSectionRevision[];
}

interface ProposalSectionRevision {
  id: string;
  actor_type: "ai" | "user" | "system";
  change_type:
    | "generated"
    | "edited"
    | "accepted"
    | "rejected"
    | "superseded";
  review_status?: "pending" | "accepted" | "rejected" | "edited" | null;
  content: string;
  created_at: string;
  metadata?: {
    version?: number;
    section_order?: number;
    reason?: string;
  } | null;
}

interface ComplianceFinding {
  id: string;
  requirement_id: string;
  status: "addressed" | "partially_addressed" | "weak" | "unaddressed";
  draft_location?: string | null;
  issue?: string | null;
  suggestion?: string | null;
}

interface ProposalOutlineSection {
  id: string;
  section_number?: string | null;
  title: string;
  volume?: string | null;
  section_type: string;
  section_order: number;
  page_limit?: number | null;
  target_word_count?: number | null;
  evaluation_weight?: "high" | "medium" | "low" | null;
  instructions?: string | null;
  source_refs?: string[] | null;
  mapped_requirement_ids?: string[] | null;
  status: string;
}

interface ProposalActionItem {
  id: string;
  proposal_section_id?: string | null;
  outline_section_id?: string | null;
  owner_user_id?: string | null;
  source: "placeholder" | "compliance_finding" | "low_confidence" | "pending_review" | "manual";
  requirement_id?: string | null;
  title: string;
  description?: string | null;
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "in_progress" | "blocked" | "resolved" | "accepted_risk";
  due_at?: string | null;
  created_at: string;
}

interface ProposalOutlineEditForm {
  section_number: string;
  title: string;
  volume: string;
  section_type: string;
  page_limit: string;
  target_word_count: string;
  evaluation_weight: "" | "high" | "medium" | "low";
  instructions: string;
  source_refs: string;
  mapped_requirement_ids: string;
  status: string;
}


interface ProposalOutcomeRecord {
  id: string;
  outcome: "won" | "lost" | "pending" | "no_bid";
  contract_value?: number | null;
  award_date?: string | null;
  notes?: string | null;
}

interface ProposalDetail {
  id: string;
  version?: number | null;
  total_word_count?: number | null;
  proposal_sections: ProposalSection[];
  compliance_findings: ComplianceFinding[];
  proposal_action_items: ProposalActionItem[];
  section_revisions?: ProposalSectionRevision[];
  proposal_outcome?: ProposalOutcomeRecord | null;
  requirements: ProposalRequirement[];
  compliance_matrix: Array<{
    id: string;
    instruction_ref: string;
    instruction_text: string;
    evaluation_ref?: string | null;
    evaluation_text?: string | null;
  }>;
  outline_sections: ProposalOutlineSection[];
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
      id: string;
      filename: string;
      page_count?: number | null;
      created_at: string;
    } | null;
  };
}


interface CompanyDocumentForReadiness {
  id: string;
  filename: string;
  created_at: string;
}

const CRITICAL_DOCUMENT_KEYWORDS = [
  "capability statement",
  "past performance",
  "resume",
  "key personnel",
  "quality",
  "security",
  "ssp",
  "certification",
  "naics",
  "staffing",
];

async function getDraftReadinessWarning(): Promise<string | null> {
  const response = await fetch("/api/documents?type=company");
  if (!response.ok) {
    return null;
  }

  const documents = (await response.json()) as CompanyDocumentForReadiness[];
  if (documents.length === 0) {
    return "No company documents are indexed yet. Draft quality may be low without evidence sources.";
  }

  const matchedKeywords = new Set<string>();
  documents.forEach((document) => {
    const filename = document.filename.toLowerCase();
    CRITICAL_DOCUMENT_KEYWORDS.forEach((keyword) => {
      if (filename.includes(keyword)) {
        matchedKeywords.add(keyword);
      }
    });
  });

  const coverage = matchedKeywords.size / CRITICAL_DOCUMENT_KEYWORDS.length;
  if (coverage < 0.5) {
    return "Critical knowledge-base coverage appears low (<50%). Consider uploading capability statement, past performance, resumes, certifications, and security posture before drafting.";
  }

  return null;
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

function formatRevisionTime(dateString: string) {
  const date = new Date(dateString);
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
  return date.toLocaleDateString();
}

function getRevisionLabel(revision: ProposalSectionRevision) {
  switch (revision.change_type) {
    case "generated":
      return revision.actor_type === "ai" ? "AI draft created" : "Generated";
    case "edited":
      return "Edited";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
    case "superseded":
      return "Superseded by regeneration";
    default:
      return revision.change_type;
  }
}

export default function ProposalDetailPage() {
  const params = useParams<{ id: string }>();
  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<{
    status: number | null;
    message: string;
  } | null>(null);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [runningCompliance, setRunningCompliance] = useState(false);
  const [generatingOutline, setGeneratingOutline] = useState(false);
  const [estimatingWin, setEstimatingWin] = useState(false);
  const [syncingActionItems, setSyncingActionItems] = useState(false);
  const [updatingActionItemId, setUpdatingActionItemId] = useState<string | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});
  const [savingSectionId, setSavingSectionId] = useState<string | null>(null);
  const [exportingMode, setExportingMode] = useState<"clean" | "annotated" | "review_package" | null>(
    null
  );
  const [editingOutlineSectionId, setEditingOutlineSectionId] = useState<string | null>(null);
  const [outlineEdits, setOutlineEdits] = useState<ProposalOutlineEditForm | null>(null);
  const [savingOutlineId, setSavingOutlineId] = useState<string | null>(null);
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [draftWarning, setDraftWarning] = useState<string | null>(null);
  const [uploadingRfp, setUploadingRfp] = useState(false);
  const rfpFileInputRef = useRef<HTMLInputElement | null>(null);
  const [outcomeForm, setOutcomeForm] = useState({
    outcome: "pending" as "won" | "lost" | "pending" | "no_bid",
    contractValue: "",
    awardDate: "",
    notes: "",
  });

  const fetchProposal = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const response = await fetch(`/api/proposals/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setProposal(data);
        return;
      }

      const payload = await response.json().catch(() => ({}));
      setProposal(null);
      setFetchError({
        status: response.status,
        message:
          (payload && typeof payload.error === "string" && payload.error) ||
          `Request failed with status ${response.status}.`,
      });
    } catch (error) {
      console.error("Failed to fetch proposal:", error);
      setProposal(null);
      setFetchError({
        status: null,
        message:
          error instanceof Error
            ? error.message
            : "Network error — could not reach the server.",
      });
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  useEffect(() => {
    if (!proposal) {
      return;
    }

    setOutcomeForm({
      outcome: proposal.proposal_outcome?.outcome || "pending",
      contractValue:
        proposal.proposal_outcome?.contract_value != null
          ? String(proposal.proposal_outcome.contract_value)
          : "",
      awardDate: proposal.proposal_outcome?.award_date
        ? proposal.proposal_outcome.award_date.slice(0, 10)
        : "",
      notes: proposal.proposal_outcome?.notes || "",
    });
  }, [proposal]);


  const exportReadiness = useMemo(() => {
    if (!proposal) return null;

    const placeholders = proposal.proposal_sections.reduce(
      (sum, section) => sum + (section.placeholders?.length || 0),
      0
    );
    const weakFindings = proposal.compliance_findings.filter((finding) =>
      ["partially_addressed", "weak", "unaddressed"].includes(finding.status)
    ).length;
    const pendingSections = proposal.proposal_sections.filter(
      (section) => section.review_status !== "accepted"
    ).length;
    const lowConfidenceSections = proposal.proposal_sections.filter(
      (section) => section.confidence === "low"
    ).length;
    const unmappedRequirements = proposal.requirements.filter(
      (requirement) =>
        !proposal.outline_sections.some((section) =>
          section.mapped_requirement_ids?.includes(requirement.requirement_id)
        )
    ).length;
    const openActionItems = proposal.proposal_action_items.filter(
      (item) => !["resolved", "accepted_risk"].includes(item.status)
    ).length;

    return {
      placeholders,
      weakFindings,
      pendingSections,
      lowConfidenceSections,
      unmappedRequirements,
      openActionItems,
      ready:
        proposal.proposal_sections.length > 0 &&
        placeholders === 0 &&
        weakFindings === 0 &&
        pendingSections === 0 &&
        lowConfidenceSections === 0 &&
        unmappedRequirements === 0 &&
        openActionItems === 0,
    };
  }, [proposal]);

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

  const draftRiskSummary = useMemo(() => {
    if (!proposal) {
      return null;
    }

    const placeholderCount = proposal.proposal_sections.reduce(
      (sum, section) => sum + (section.placeholders?.length || 0),
      0
    );

    return {
      placeholders: placeholderCount,
      lowConfidence: proposal.proposal_sections.filter(
        (section) => section.confidence === "low"
      ).length,
      pendingReview: proposal.proposal_sections.filter(
        (section) => section.review_status === "pending"
      ).length,
      editedSections: proposal.proposal_sections.filter(
        (section) => section.review_status === "edited"
      ).length,
      weakClaims: proposal.compliance_findings.filter(
        (finding) =>
          finding.status === "weak" ||
          finding.status === "partially_addressed" ||
          finding.status === "unaddressed"
      ).length,
    };
  }, [proposal]);

  const actionItemsByStatus = useMemo(() => {
    const statuses: ProposalActionItem["status"][] = [
      "open",
      "in_progress",
      "blocked",
      "resolved",
      "accepted_risk",
    ];

    return statuses.map((status) => ({
      status,
      items: (proposal?.proposal_action_items || []).filter((item) => item.status === status),
    }));
  }, [proposal]);

  async function attachRfpFile(file: File) {
    if (!proposal) return;
    setUploadingRfp(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", "rfp");

      const uploadResponse = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });
      if (!uploadResponse.ok) {
        const error = await uploadResponse.json().catch(() => ({}));
        throw new Error(error.error || "Upload failed");
      }
      const { document } = await uploadResponse.json();

      const attachResponse = await fetch(
        `/api/solicitations/${proposal.solicitations.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceDocumentId: document.id }),
        }
      );
      if (!attachResponse.ok) {
        const error = await attachResponse.json().catch(() => ({}));
        throw new Error(error.error || "Failed to attach RFP");
      }

      toast.success("Solicitation attached. Running analysis…");
      await fetchProposal();
      await runAnalysis();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Attach failed");
    } finally {
      setUploadingRfp(false);
    }
  }

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


  async function generateProposalOutline(regenerate = false) {
    if (!proposal) return;

    if (
      regenerate &&
      proposal.outline_sections.length > 0 &&
      !window.confirm("Regenerate the outline? This will replace existing outline edits.")
    ) {
      return;
    }


    setGeneratingOutline(true);
    try {
      const response = await fetch(`/api/proposals/${proposal.id}/outline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Outline generation failed");
      }

      await fetchProposal();
      toast.success(regenerate ? "Outline regenerated." : "Outline generated.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Outline generation failed"
      );
    } finally {
      setGeneratingOutline(false);
    }
  }

  function openOutlineEditor(section: ProposalOutlineSection) {
    setEditingOutlineSectionId(section.id);
    setOutlineEdits({
      section_number: section.section_number || "",
      title: section.title,
      volume: section.volume || "",
      section_type: section.section_type || "other",
      page_limit: section.page_limit != null ? String(section.page_limit) : "",
      target_word_count:
        section.target_word_count != null ? String(section.target_word_count) : "",
      evaluation_weight: section.evaluation_weight || "",
      instructions: section.instructions || "",
      source_refs: (section.source_refs || []).join(", "),
      mapped_requirement_ids: (section.mapped_requirement_ids || []).join(", "),
      status: section.status || "planned",
    });
  }

  function closeOutlineEditor() {
    setEditingOutlineSectionId(null);
    setOutlineEdits(null);
  }

  async function saveOutlineSection() {
    if (!proposal || !editingOutlineSectionId || !outlineEdits) return;

    setSavingOutlineId(editingOutlineSectionId);
    try {
      const response = await fetch(`/api/proposals/${proposal.id}/outline`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: editingOutlineSectionId,
          patch: {
            section_number: outlineEdits.section_number.trim() || null,
            title: outlineEdits.title.trim(),
            volume: outlineEdits.volume.trim() || null,
            section_type: outlineEdits.section_type,
            page_limit: outlineEdits.page_limit ? Number(outlineEdits.page_limit) : null,
            target_word_count: outlineEdits.target_word_count
              ? Number(outlineEdits.target_word_count)
              : null,
            evaluation_weight: outlineEdits.evaluation_weight || null,
            instructions: outlineEdits.instructions.trim() || null,
            source_refs: outlineEdits.source_refs
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
            mapped_requirement_ids: outlineEdits.mapped_requirement_ids
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
            status: outlineEdits.status,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Outline update failed");
      }

      closeOutlineEditor();
      await fetchProposal();
      toast.success("Outline section updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Outline update failed");
    } finally {
      setSavingOutlineId(null);
    }
  }


  async function startDraftFlow() {
    if (!proposal) return;

    const hasOutline = proposal.outline_sections.length > 0;
    const hasUnapprovedOutline = proposal.outline_sections.some(
      (section) => section.status === "planned" || section.status === "blocked"
    );

    if (!hasOutline) {
      const proceed = window.confirm(
        "No outline exists yet. Generate a solicitation-driven outline before drafting? Choose Cancel to draft anyway."
      );
      if (proceed) {
        await generateProposalOutline(false);
        return;
      }
    }

    if (hasUnapprovedOutline) {
      const proceed = window.confirm(
        "Some outline sections are still planned or blocked. Draft anyway?"
      );
      if (!proceed) return;
    }

    const warning = await getDraftReadinessWarning();
    if (warning) {
      setDraftWarning(warning);
      return;
    }

    await executeDraft();
  }

  async function executeDraft() {
    if (!proposal) return;

    setDraftWarning(null);
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
      toast.success("Draft generated successfully.");
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

  async function syncActionItems() {
    if (!proposal) return;

    setSyncingActionItems(true);
    try {
      const response = await fetch(`/api/proposals/${proposal.id}/action-items`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Action item sync failed");
      }

      await fetchProposal();
      toast.success("Action items synced.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action item sync failed");
    } finally {
      setSyncingActionItems(false);
    }
  }

  async function updateActionItem(
    itemId: string,
    patch: Partial<Pick<ProposalActionItem, "status" | "severity" | "due_at" | "owner_user_id">>
  ) {
    if (!proposal) return;

    setUpdatingActionItemId(itemId);
    try {
      const response = await fetch(`/api/proposals/${proposal.id}/action-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patch }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Action item update failed");
      }

      await fetchProposal();
      toast.success("Action item updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action item update failed");
    } finally {
      setUpdatingActionItemId(null);
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

  async function exportProposal(mode: "clean" | "annotated" | "review_package") {
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
          : mode === "review_package"
          ? "Review package export downloaded."
          : "Annotated proposal export downloaded."
      );
      const { celebrateOnce } = await import("@/lib/celebrate");
      celebrateOnce("first-proposal-exported", { particleCount: 140, durationMs: 3000 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExportingMode(null);
    }
  }

  async function saveOutcome() {
    if (!proposal) return;

    setSavingOutcome(true);
    try {
      const response = await fetch(`/api/proposals/${proposal.id}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(outcomeForm),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to save outcome");
      }

      await fetchProposal();
      toast.success("Proposal outcome saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save outcome");
    } finally {
      setSavingOutcome(false);
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
    const status = fetchError?.status ?? null;
    const isUnauthorized = status === 401;
    const isForbidden = status === 403;
    const isNotFound = status === 404;
    const isServerError = status !== null && status >= 500;
    const Icon = isUnauthorized || isForbidden
      ? LockKeyhole
      : isNotFound
      ? FileSearch
      : AlertTriangle;

    const headline = isUnauthorized
      ? "You're signed out"
      : isForbidden
      ? "You don't have access to this proposal"
      : isNotFound
      ? "We couldn't find this proposal"
      : isServerError
      ? "The server hit an error loading this proposal"
      : fetchError
      ? "Something went wrong loading this proposal"
      : "This proposal isn't available";

    const description = isUnauthorized
      ? "Your session has expired. Sign back in to keep working on this proposal."
      : isForbidden
      ? "This proposal belongs to a workspace you're not a member of. If you expected access, switch workspaces or ask a teammate to invite you."
      : isNotFound
      ? "It may have been deleted, moved to another workspace, or the link is out of date. Try refreshing — analysis sometimes runs in the background after upload."
      : isServerError
      ? "The proposal exists but we couldn't load its detail. Retry in a moment, or check the workspace dashboard for status."
      : fetchError
      ? fetchError.message
      : "We couldn't load this proposal. Go back to the proposal list and try again.";

    return (
      <div className="space-y-6">
        <div>
          <Link
            href="/proposals"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to RFP Analysis
          </Link>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div
              className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${
                isUnauthorized || isForbidden
                  ? "bg-warning/10 text-warning"
                  : isNotFound
                  ? "bg-muted text-muted-foreground"
                  : "bg-danger/10 text-danger"
              }`}
            >
              <Icon className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-semibold mb-2">{headline}</h2>
            <p className="text-sm text-muted-foreground max-w-md mb-2">
              {description}
            </p>
            {fetchError?.status ? (
              <p className="text-xs text-muted-foreground/70 mb-6">
                Reference: HTTP {fetchError.status}
                {params?.id ? ` · proposal id ${params.id.slice(0, 8)}…` : ""}
              </p>
            ) : (
              <div className="mb-6" />
            )}

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link href="/proposals">
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to RFP Analysis
                </Button>
              </Link>
              {isUnauthorized ? (
                <Link href="/login">
                  <Button size="sm">Sign back in</Button>
                </Link>
              ) : (
                <Button
                  size="sm"
                  onClick={fetchProposal}
                  disabled={loading}
                  className="gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Try again
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Draft readiness warning dialog */}
      <Dialog open={Boolean(draftWarning)} onOpenChange={(open) => { if (!open) setDraftWarning(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Knowledge base coverage is low</DialogTitle>
            <DialogDescription className="space-y-2">
              <span className="block">{draftWarning}</span>
              <span className="block text-xs">
                You can still generate a draft, but sections may contain placeholder text where evidence could not be found. Consider uploading missing documents to the Knowledge Base first.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraftWarning(null)}>
              Upload Docs First
            </Button>
            <Button onClick={executeDraft} disabled={generatingDraft} className="gap-2">
              {generatingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenTool className="h-4 w-4" />}
              Generate Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingOutlineSectionId)} onOpenChange={(open) => { if (!open) closeOutlineEditor(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit outline section</DialogTitle>
            <DialogDescription>
              Update the approved structure before drafting or exporting. Mapped requirements and source refs should remain comma-separated.
            </DialogDescription>
          </DialogHeader>
          {outlineEdits ? (
            <div className="grid gap-4 py-2 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Section Number</p>
                <Input
                  value={outlineEdits.section_number}
                  onChange={(event) =>
                    setOutlineEdits((prev) => prev ? { ...prev, section_number: event.target.value } : prev)
                  }
                  placeholder="1.0"
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Title</p>
                <Input
                  value={outlineEdits.title}
                  onChange={(event) =>
                    setOutlineEdits((prev) => prev ? { ...prev, title: event.target.value } : prev)
                  }
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Volume</p>
                <Input
                  value={outlineEdits.volume}
                  onChange={(event) =>
                    setOutlineEdits((prev) => prev ? { ...prev, volume: event.target.value } : prev)
                  }
                  placeholder="Technical Volume"
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={outlineEdits.status}
                  onChange={(event) =>
                    setOutlineEdits((prev) => prev ? { ...prev, status: event.target.value } : prev)
                  }
                >
                  <option value="planned">Planned</option>
                  <option value="approved">Approved</option>
                  <option value="ai_drafted">AI drafted</option>
                  <option value="in_review">In review</option>
                  <option value="needs_revision">Needs revision</option>
                  <option value="approved_for_export">Approved for export</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Target Words</p>
                <Input
                  type="number"
                  min="0"
                  value={outlineEdits.target_word_count}
                  onChange={(event) =>
                    setOutlineEdits((prev) => prev ? { ...prev, target_word_count: event.target.value } : prev)
                  }
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Page Limit</p>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={outlineEdits.page_limit}
                  onChange={(event) =>
                    setOutlineEdits((prev) => prev ? { ...prev, page_limit: event.target.value } : prev)
                  }
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evaluation Weight</p>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={outlineEdits.evaluation_weight}
                  onChange={(event) =>
                    setOutlineEdits((prev) => prev ? { ...prev, evaluation_weight: event.target.value as ProposalOutlineEditForm["evaluation_weight"] } : prev)
                  }
                >
                  <option value="">None</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</p>
                <Input
                  value={outlineEdits.section_type}
                  onChange={(event) =>
                    setOutlineEdits((prev) => prev ? { ...prev, section_type: event.target.value } : prev)
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Instructions</p>
                <textarea
                  className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={outlineEdits.instructions}
                  onChange={(event) =>
                    setOutlineEdits((prev) => prev ? { ...prev, instructions: event.target.value } : prev)
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mapped Requirements</p>
                <Input
                  value={outlineEdits.mapped_requirement_ids}
                  onChange={(event) =>
                    setOutlineEdits((prev) => prev ? { ...prev, mapped_requirement_ids: event.target.value } : prev)
                  }
                  placeholder="REQ-001, REQ-002"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Source References</p>
                <Input
                  value={outlineEdits.source_refs}
                  onChange={(event) =>
                    setOutlineEdits((prev) => prev ? { ...prev, source_refs: event.target.value } : prev)
                  }
                  placeholder="Section L.5, Section M.2"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={closeOutlineEditor}>Cancel</Button>
            <Button onClick={saveOutlineSection} disabled={!outlineEdits?.title.trim() || Boolean(savingOutlineId)} className="gap-2">
              {savingOutlineId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Outline Section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {proposal.solicitations.title}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">Draft v{proposal.version || 1}</Badge>
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
            variant={proposal.requirements.length === 0 ? "default" : "outline"}
            className="gap-2"
            onClick={runAnalysis}
            disabled={runningAnalysis}
          >
            {runningAnalysis ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSearch className="h-4 w-4" />
            )}
            {proposal.requirements.length === 0 ? "Analyze RFP" : "Re-analyze"}
          </Button>
          {proposal.requirements.length > 0 ? (
            <Button
              variant="outline"
              className="gap-2"
              onClick={startDraftFlow}
              disabled={generatingDraft}
            >
              {generatingDraft ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PenTool className="h-4 w-4" />
              )}
              Generate Draft
            </Button>
          ) : null}
          {proposal.proposal_sections.length > 0 ? (
            <Button
              variant="outline"
              className="gap-2"
              onClick={runComplianceCheck}
              disabled={runningCompliance}
            >
              {runningCompliance ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              Run Compliance
            </Button>
          ) : null}
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
              <DropdownMenuItem onClick={() => exportProposal("review_package")}>
                Export Review Package
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <PipelineStepper stages={pipelineStages} />

      {exportReadiness ? (
        <Card>
          <CardContent className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold">Export readiness</p>
              <p className="text-xs text-muted-foreground">
                {exportReadiness.ready
                  ? "No open blockers detected for the review package."
                  : "Resolve placeholders, weak findings, pending reviews, and unmapped requirements before final export."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={exportReadiness.placeholders === 0 ? "secondary" : "outline"}>
                {exportReadiness.placeholders} placeholders
              </Badge>
              <Badge variant={exportReadiness.weakFindings === 0 ? "secondary" : "outline"}>
                {exportReadiness.weakFindings} weak findings
              </Badge>
              <Badge variant={exportReadiness.pendingSections === 0 ? "secondary" : "outline"}>
                {exportReadiness.pendingSections} pending reviews
              </Badge>
              <Badge variant={exportReadiness.unmappedRequirements === 0 ? "secondary" : "outline"}>
                {exportReadiness.unmappedRequirements} unmapped reqs
              </Badge>
              <Badge variant={exportReadiness.openActionItems === 0 ? "secondary" : "outline"}>
                {exportReadiness.openActionItems} open actions
              </Badge>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="analysis" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="outline">Outline</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="execution">Execution</TabsTrigger>
          <TabsTrigger value="competitive-intel">Competitive Intel</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-4">
          {proposal.requirements.length === 0 ? (
            <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.06] via-background to-violet/[0.04]">
              <CardContent className="flex flex-col items-center justify-center gap-4 py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <FileSearch className="h-7 w-7 text-primary" />
                </div>
                <div className="max-w-xl space-y-1.5">
                  <h2 className="text-lg font-semibold">
                    Analyze this RFP to extract requirements
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {proposal.solicitations.source_documents
                      ? "We'll parse the uploaded solicitation, extract every requirement, build the compliance matrix, and surface ambiguities to flag."
                      : "We'll pull the full notice and every attachment from SAM.gov, parse them, then extract requirements, build the compliance matrix, and surface ambiguities. Or upload the solicitation PDF directly for the strongest analysis."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    size="lg"
                    className="gap-2"
                    onClick={runAnalysis}
                    disabled={runningAnalysis || uploadingRfp}
                  >
                    {runningAnalysis ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {proposal.solicitations.source_documents
                      ? "Analyze RFP"
                      : "Fetch & Analyze from SAM.gov"}
                  </Button>
                  <input
                    ref={rfpFileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.txt"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) attachRfpFile(file);
                    }}
                  />
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2"
                    disabled={uploadingRfp || runningAnalysis}
                    onClick={() => rfpFileInputRef.current?.click()}
                  >
                    {uploadingRfp ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {proposal.solicitations.source_documents
                      ? "Replace document"
                      : "Upload solicitation PDF"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground/80">
                  PDF, DOCX, or TXT · up to 50MB
                </p>
              </CardContent>
            </Card>
          ) : null}

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
                      <Button
                        className="mt-3 w-full"
                        variant="outline"
                        size="sm"
                        render={
                          <a
                            href={`/api/documents/${proposal.solicitations.source_documents.id}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        }
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open Source
                      </Button>
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



        <TabsContent value="outline" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm">Annotated Proposal Outline</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Generate a solicitation-driven outline before drafting so sections
                  inherit source refs, instructions, requirement mappings, and review
                  metadata.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => generateProposalOutline(proposal.outline_sections.length > 0)}
                disabled={generatingOutline || proposal.requirements.length === 0}
                title={proposal.requirements.length === 0 ? "Run analysis before generating an outline" : undefined}
              >
                {generatingOutline ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileSearch className="h-3.5 w-3.5" />
                )}
                {proposal.outline_sections.length > 0 ? "Regenerate" : "Generate Outline"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {proposal.outline_sections.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No outline has been generated yet. Generate an outline to convert
                    extracted requirements and compliance matrix rows into draft-ready
                    sections.
                  </p>
                </div>
              ) : (
                proposal.outline_sections.map((section) => (
                  <div key={section.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          {section.section_number ? (
                            <Badge variant="outline" className="font-mono">
                              {section.section_number}
                            </Badge>
                          ) : null}
                          <h3 className="text-sm font-semibold">{section.title}</h3>
                          <Badge variant="secondary" className="capitalize">
                            {section.section_type.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        {section.volume ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {section.volume}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {section.evaluation_weight ? (
                          <Badge variant="outline">{section.evaluation_weight} weight</Badge>
                        ) : null}
                        {section.target_word_count ? (
                          <Badge variant="outline">{section.target_word_count} words</Badge>
                        ) : null}
                        <Badge variant="secondary">{section.status.replace(/_/g, " ")}</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openOutlineEditor(section)}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>

                    {section.instructions ? (
                      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">
                        {section.instructions}
                      </p>
                    ) : null}

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Mapped Requirements
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(section.mapped_requirement_ids || []).length > 0 ? (
                            section.mapped_requirement_ids?.map((id) => (
                              <Badge key={id} variant="outline" className="font-mono text-xs">
                                {id}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">No mappings</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Source References
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(section.source_refs || []).length > 0 ? (
                            section.source_refs?.map((ref) => (
                              <Badge key={ref} variant="secondary" className="text-xs">
                                {ref}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">No source refs</span>
                          )}
                        </div>
                      </div>
                    </div>
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
                  onClick={startDraftFlow}
                  disabled={generatingDraft || proposal.requirements.length === 0}
                  title={proposal.requirements.length === 0 ? "Run the analyzer first to extract requirements" : undefined}
                >
                  {generatingDraft ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Generate Draft
                </Button>
                {proposal.requirements.length === 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Run the analyzer first to extract RFP requirements.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {draftRiskSummary ? (
                <div className="grid gap-4 sm:grid-cols-5">
                  {[
                    {
                      label: "Placeholders",
                      value: draftRiskSummary.placeholders,
                    },
                    {
                      label: "Low Confidence",
                      value: draftRiskSummary.lowConfidence,
                    },
                    {
                      label: "Pending Review",
                      value: draftRiskSummary.pendingReview,
                    },
                    {
                      label: "Edited Sections",
                      value: draftRiskSummary.editedSections,
                    },
                    {
                      label: "Weak Claims",
                      value: draftRiskSummary.weakClaims,
                    },
                  ].map((stat) => (
                    <Card key={stat.label}>
                      <CardContent className="pt-6">
                        <p className="text-xs text-muted-foreground">
                          {stat.label}
                        </p>
                        <p className="text-2xl font-bold">{stat.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : null}

              {draftRiskSummary &&
              (draftRiskSummary.placeholders > 0 ||
                draftRiskSummary.lowConfidence > 0 ||
                draftRiskSummary.weakClaims > 0) ? (
                <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
                    <div>
                      <p className="font-medium text-warning">
                        Review attention needed
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        This draft still contains placeholders, low-confidence
                        sections, or weak compliance coverage. Review the flagged
                        sections before export.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {proposal.proposal_sections.map((section) => {
                const sectionComplianceRisks = proposal.compliance_findings.filter(
                  (finding) =>
                    section.requirement_mappings?.includes(finding.requirement_id) &&
                    (finding.status === "weak" ||
                      finding.status === "partially_addressed" ||
                      finding.status === "unaddressed")
                );

                return (
                  <Card key={section.id}>
                    <CardHeader className="flex flex-row items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{section.title}</CardTitle>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {getConfidenceBadge(section.confidence)}
                          {getReviewBadge(section.review_status)}
                          <Badge variant="secondary">
                            {section.revisions?.length || 0} revisions
                          </Badge>
                        </div>
                        {section.requirement_mappings?.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {section.requirement_mappings.map((mapping) => (
                              <Badge key={mapping} variant="outline">
                                {mapping}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
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

                      {sectionComplianceRisks.length ? (
                        <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm">
                          <p className="font-medium text-danger">
                            Compliance risks tied to this section
                          </p>
                          <ul className="mt-2 space-y-2 text-muted-foreground">
                            {sectionComplianceRisks.map((finding) => (
                              <li key={finding.id}>
                                <span className="font-medium text-foreground">
                                  {finding.requirement_id}
                                </span>
                                {": "}
                                {finding.issue || finding.status}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

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

                      {section.revisions?.length ? (
                        <details className="rounded-lg border p-3">
                          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
                            <History className="h-4 w-4" />
                            Review history
                          </summary>
                          <div className="mt-3 space-y-3">
                            {section.revisions.slice(0, 6).map((revision) => (
                              <div
                                key={revision.id}
                                className="rounded-lg border bg-muted/30 p-3 text-xs"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline">
                                    {getRevisionLabel(revision)}
                                  </Badge>
                                  <Badge variant="secondary">
                                    {revision.actor_type}
                                  </Badge>
                                  <span className="text-muted-foreground">
                                    {formatRevisionTime(revision.created_at)}
                                  </span>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                                  {revision.content.slice(0, 260)}
                                  {revision.content.length > 260 ? "..." : ""}
                                </p>
                              </div>
                            ))}
                          </div>
                        </details>
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
                              <p className="mt-1">
                                {citation.excerpt || "No excerpt available."}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </>
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

        <TabsContent value="execution" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm">Proposal Execution Board</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sync placeholders, compliance gaps, low-confidence sections, and pending reviews into trackable work.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={syncActionItems}
                disabled={syncingActionItems || proposal.proposal_sections.length === 0}
              >
                {syncingActionItems ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Target className="h-3.5 w-3.5" />}
                Sync Action Items
              </Button>
            </CardHeader>
            <CardContent>
              {proposal.proposal_action_items.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No action items yet. Sync after drafting or running compliance to generate work items.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-5">
                  {actionItemsByStatus.map(({ status, items }) => (
                    <div key={status} className="space-y-3 rounded-xl border bg-muted/20 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold capitalize">{status.replace(/_/g, " ")}</p>
                        <Badge variant="secondary">{items.length}</Badge>
                      </div>
                      {items.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No items</p>
                      ) : (
                        items.map((item) => (
                          <div key={item.id} className="space-y-3 rounded-lg border bg-card p-3 shadow-sm">
                            <div className="space-y-1">
                              <div className="flex flex-wrap gap-1.5">
                                <Badge variant="outline" className="capitalize">{item.severity}</Badge>
                                <Badge variant="secondary" className="capitalize">{item.source.replace(/_/g, " ")}</Badge>
                                {item.requirement_id ? <Badge variant="outline" className="font-mono">{item.requirement_id}</Badge> : null}
                              </div>
                              <p className="text-sm font-medium leading-snug">{item.title}</p>
                              {item.description ? (
                                <p className="line-clamp-4 whitespace-pre-line text-xs text-muted-foreground">{item.description}</p>
                              ) : null}
                            </div>
                            <div className="space-y-2">
                              <select
                                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                                value={item.status}
                                disabled={updatingActionItemId === item.id}
                                onChange={(event) => updateActionItem(item.id, { status: event.target.value as ProposalActionItem["status"] })}
                              >
                                <option value="open">Open</option>
                                <option value="in_progress">In progress</option>
                                <option value="blocked">Blocked</option>
                                <option value="resolved">Resolved</option>
                                <option value="accepted_risk">Accepted risk</option>
                              </select>
                              <select
                                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                                value={item.severity}
                                disabled={updatingActionItemId === item.id}
                                onChange={(event) => updateActionItem(item.id, { severity: event.target.value as ProposalActionItem["severity"] })}
                              >
                                <option value="critical">Critical</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                              </select>
                            </div>
                          </div>
                        ))
                      )}
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

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Outcome Tracking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Proposal Outcome
                  </p>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={outcomeForm.outcome}
                    onChange={(event) =>
                      setOutcomeForm((prev) => ({
                        ...prev,
                        outcome: event.target.value as
                          | "won"
                          | "lost"
                          | "pending"
                          | "no_bid",
                      }))
                    }
                  >
                    <option value="pending">Pending</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                    <option value="no_bid">No Bid</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Award Date
                  </p>
                  <Input
                    type="date"
                    value={outcomeForm.awardDate}
                    onChange={(event) =>
                      setOutcomeForm((prev) => ({
                        ...prev,
                        awardDate: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Contract Value
                  </p>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={outcomeForm.contractValue}
                    onChange={(event) =>
                      setOutcomeForm((prev) => ({
                        ...prev,
                        contractValue: event.target.value,
                      }))
                    }
                    placeholder="1250000"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Current Recommendation
                  </p>
                  <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                    {proposal.solicitations.bid_decision_recommendation ||
                      "No recommendation yet"}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Post-Submission Notes
                </p>
                <textarea
                  className="min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={outcomeForm.notes}
                  onChange={(event) =>
                    setOutcomeForm((prev) => ({
                      ...prev,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Capture bidder strategy, customer feedback, award context, or why this became a no-bid."
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
                <div>
                  <p className="font-medium">Outcome record</p>
                  <p className="text-muted-foreground">
                    Save bid/no-bid decisions, award results, and notes for later reporting.
                  </p>
                </div>
                <Button
                  className="gap-2"
                  onClick={saveOutcome}
                  disabled={savingOutcome}
                >
                  {savingOutcome ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Outcome
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
