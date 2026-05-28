"use client";

import { useCallback, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getSupportedDocumentFormat,
  isSupportedDocumentFile,
} from "@/lib/documents/validation";

interface DocumentUploaderProps {
  type: "company" | "rfp" | "legacy_proposal";
  title: string;
  description: string;
  onComplete?: (results: UploadWorkflowResult[]) => void;
}

type UploadStatus =
  | "review"
  | "uploading"
  | "queued"
  | "processing"
  | "complete"
  | "error";

type KnowledgeCategory =
  | "past_performance"
  | "technical_approach"
  | "key_personnel"
  | "corporate_overview"
  | "certifications"
  | "management";

interface FileMappingPreview {
  destination: string;
  category?: KnowledgeCategory;
  readinessArea: string;
  confidence: "high" | "medium" | "low";
  signals: string[];
  note: string;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: UploadStatus;
  sourceFile?: File;
  stage?: string;
  error?: string;
  preview?: string;
  mapping: FileMappingPreview;
}

export interface UploadWorkflowResult {
  documentId: string;
  solicitationId?: string;
  proposalId?: string;
}

const CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  past_performance: "Past performance",
  technical_approach: "Technical approach",
  key_personnel: "Key personnel",
  corporate_overview: "Corporate overview",
  certifications: "Certifications and compliance",
  management: "Management approach",
};

const CATEGORY_RULES: Array<{
  category: KnowledgeCategory;
  readinessArea: string;
  keywords: string[];
}> = [
  {
    category: "past_performance",
    readinessArea: "Past performance evidence",
    keywords: ["past performance", "performance", "experience", "case study", "contract"],
  },
  {
    category: "key_personnel",
    readinessArea: "Key personnel / resumes",
    keywords: ["resume", "resumes", "personnel", "staff", "bio", "cv"],
  },
  {
    category: "certifications",
    readinessArea: "Certifications, NAICS, socioeconomic, compliance",
    keywords: ["certification", "certifications", "naics", "socioeconomic", "cage", "uei", "compliance"],
  },
  {
    category: "management",
    readinessArea: "Management, staffing, quality, transition, risk",
    keywords: ["management", "staffing", "quality", "transition", "risk", "vehicle"],
  },
  {
    category: "technical_approach",
    readinessArea: "Technical approach / cybersecurity posture",
    keywords: ["technical", "cybersecurity", "security", "architecture", "engineering", "approach"],
  },
  {
    category: "corporate_overview",
    readinessArea: "Corporate overview / capability statement",
    keywords: ["capability", "corporate", "overview", "company", "statement"],
  },
];

function inferMapping(fileName: string, uploadType: "company" | "rfp" | "legacy_proposal"): FileMappingPreview {
  if (uploadType === "rfp") {
    return {
      destination: "RFP Analyzer",
      readinessArea: "Solicitation requirements and compliance matrix",
      confidence: "high",
      signals: ["RFP upload flow"],
      note: "This file will be treated as a solicitation, not reusable company evidence.",
    };
  }

  if (uploadType === "legacy_proposal") {
    return {
      destination: "Knowledge Base",
      category: "past_performance",
      readinessArea: "Legacy proposal section extraction",
      confidence: "high",
      signals: ["legacy proposal"],
      note:
        "This file will be split into reusable evidence artifacts such as capabilities, past performance, personnel, certifications, and management approach.",
    };
  }

  const normalizedName = fileName.toLowerCase().replace(/[_-]+/g, " ");
  const matched = CATEGORY_RULES.map((rule) => {
    const signals = rule.keywords.filter((keyword) => normalizedName.includes(keyword));
    return { ...rule, signals };
  }).find((rule) => rule.signals.length > 0);

  if (!matched) {
    return {
      destination: "Knowledge Base",
      category: "corporate_overview",
      readinessArea: "General company evidence",
      confidence: "low",
      signals: [],
      note:
        "No strong filename signal was found. The indexer will still classify chunks by content, but consider renaming if this is a specific readiness file.",
    };
  }

  return {
    destination: "Knowledge Base",
    category: matched.category,
    readinessArea: matched.readinessArea,
    confidence: matched.signals.length > 1 ? "high" : "medium",
    signals: matched.signals,
    note:
      "This is the expected starting bucket. The indexer will still classify individual chunks by content.",
  };
}

async function buildPreview(file: File) {
  const format = getSupportedDocumentFormat(file);

  if (format === "pdf") {
    return `PDF detected — content preview is not available in the browser.\n\nVerify this is the correct file before confirming:\n• Filename: ${file.name}\n• Size: ${(file.size / 1024).toFixed(0)} KB\n• Type: PDF document\n\nAfter upload, you can open the original file using the "Open" button in the document list.`;
  }

  if (format === "docx") {
    return `Word document detected — content preview is not available in the browser.\n\nVerify this is the correct file before confirming:\n• Filename: ${file.name}\n• Size: ${(file.size / 1024).toFixed(0)} KB\n• Type: DOCX document\n\nAfter upload, you can open the original file using the "Open" button in the document list.`;
  }

  const text = await file.text();
  const trimmed = text.trim();
  if (!trimmed) {
    return "This text file appears to be empty. Upload a different file.";
  }

  return trimmed.length > 1200 ? `${trimmed.slice(0, 1200)}...` : trimmed;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

function getStatusLabel(status: UploadStatus) {
  switch (status) {
    case "review":
      return "ready";
    case "complete":
      return "indexed";
    default:
      return status;
  }
}

export function DocumentUploader({
  type,
  title,
  description,
  onComplete,
}: DocumentUploaderProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const readyFiles = useMemo(
    () => files.filter((file) => file.status === "review" && file.sourceFile),
    [files]
  );

  const updateFile = useCallback(
    (id: string, updates: Partial<UploadedFile>) => {
      setFiles((prev) =>
        prev.map((file) => (file.id === id ? { ...file, ...updates } : file))
      );
    },
    []
  );

  const uploadCompanyDocument = useCallback(
    async (file: File, uploadedFileId: string): Promise<UploadWorkflowResult> => {
      updateFile(uploadedFileId, {
        status: "uploading",
        stage: "Uploading document",
        error: undefined,
      });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", type === "legacy_proposal" ? "legacy_proposal" : "company");
      if (type === "legacy_proposal") {
        formData.append("ingestionMode", "legacy_proposal");
      }

      const uploadResponse = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json().catch(() => ({}));
        throw new Error(error.error || "Upload failed");
      }

      const { document } = await uploadResponse.json();

      updateFile(uploadedFileId, {
        status: "processing",
        stage: "Indexing knowledge base",
      });

      const indexResponse = await fetch(
        `/api/knowledge-base/index/${document.id}`,
        {
          method: "POST",
        }
      );

      const indexResult = await indexResponse.json().catch(() => ({}));

      if (!indexResponse.ok || indexResult.status === "error") {
        throw new Error(
          indexResult.error ||
            "Knowledge base indexing failed. Remove this item and reupload the file after correcting the issue."
        );
      }

      updateFile(uploadedFileId, {
        status: "complete",
        stage: "Indexed",
      });

      return { documentId: document.id };
    },
    [type, updateFile]
  );

  const uploadRfpDocument = useCallback(
    async (file: File, uploadedFileId: string): Promise<UploadWorkflowResult> => {
      updateFile(uploadedFileId, {
        status: "uploading",
        stage: "Uploading RFP",
        error: undefined,
      });

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

      updateFile(uploadedFileId, {
        status: "processing",
        stage: "Creating solicitation",
      });

      const solicitationResponse = await fetch("/api/solicitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceDocumentId: document.id,
        }),
      });

      if (!solicitationResponse.ok) {
        const error = await solicitationResponse.json().catch(() => ({}));
        throw new Error(error.error || "Failed to create solicitation");
      }

      const { solicitation } = await solicitationResponse.json();

      const proposalResponse = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitationId: solicitation.id,
        }),
      });

      if (!proposalResponse.ok) {
        const error = await proposalResponse.json().catch(() => ({}));
        throw new Error(error.error || "Failed to create proposal");
      }

      const { proposal } = await proposalResponse.json();

      updateFile(uploadedFileId, {
        status: "processing",
        stage: "Analyzing RFP",
      });

      const analyzeResponse = await fetch(
        `/api/solicitations/${solicitation.id}/analyze`,
        {
          method: "POST",
        }
      );

      if (!analyzeResponse.ok) {
        const error = await analyzeResponse.json().catch(() => ({}));
        throw new Error(error.error || "RFP analysis failed");
      }

      updateFile(uploadedFileId, {
        status: "complete",
        stage: "Analysis complete",
      });

      return {
        documentId: document.id,
        solicitationId: solicitation.id,
        proposalId: proposal.id,
      };
    },
    [updateFile]
  );

  const processFiles = useCallback(
    async (newFiles: File[]) => {
      const invalidFiles = newFiles.filter((file) => !isSupportedDocumentFile(file));
      if (invalidFiles.length > 0) {
        toast.error("Only PDF, DOCX, and TXT files are supported.");
      }

      const validFiles = newFiles.filter((f) => isSupportedDocumentFile(f));

      const uploadFiles = await Promise.all(
        validFiles.map(async (f) => ({
          id: crypto.randomUUID(),
          name: f.name,
          size: f.size,
          type: f.type,
          sourceFile: f,
          status: "review" as const,
          stage: "Review before upload",
          preview: await buildPreview(f),
          mapping: inferMapping(f.name, type),
        }))
      );

      setFiles((prev) => [...prev, ...uploadFiles]);
    },
    [type]
  );

  const uploadReviewedFiles = useCallback(
    async (fileIds?: string[]) => {
      const candidates = files.filter(
        (file) =>
          file.status === "review" &&
          file.sourceFile &&
          (!fileIds || fileIds.includes(file.id))
      );

      if (candidates.length === 0) {
        return;
      }

      const successfulUploads: UploadWorkflowResult[] = [];

      for (const uploadFile of candidates) {
        if (!uploadFile.sourceFile) {
          continue;
        }

        try {
          const result =
            type === "company" || type === "legacy_proposal"
              ? await uploadCompanyDocument(uploadFile.sourceFile, uploadFile.id)
              : await uploadRfpDocument(uploadFile.sourceFile, uploadFile.id);

          successfulUploads.push(result);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Upload workflow failed";
          updateFile(uploadFile.id, {
            status: "error",
            stage: "Failed - reupload required",
            error: message,
          });
          toast.error(message);
        }
      }

      if (successfulUploads.length > 0) {
        onComplete?.(successfulUploads);
        toast.success(
          type === "rfp"
            ? "RFP uploaded and analyzed successfully."
            : type === "legacy_proposal"
            ? "Legacy proposal extracted into reusable evidence."
            : "Company documents indexed successfully."
        );
      }
    },
    [
      files,
      onComplete,
      type,
      updateFile,
      uploadCompanyDocument,
      uploadRfpDocument,
    ]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      processFiles(droppedFiles);
    },
    [processFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selectedFiles = Array.from(e.target.files);
        processFiles(selectedFiles);
        e.target.value = "";
      }
    },
    [processFiles]
  );

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div className="space-y-3">
      <Card
        data-document-type={type}
        className={cn(
          "border-2 border-dashed transition-all cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/30"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center justify-center py-10">
          <label className="flex cursor-pointer flex-col items-center gap-3">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
                isDragging ? "bg-primary/15" : "bg-muted"
              )}
            >
              <Upload
                className={cn(
                  "h-5 w-5 transition-colors",
                  isDragging ? "text-primary" : "text-muted-foreground"
                )}
              />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>
              <p className="text-xs text-muted-foreground/60 mt-2">
                PDF, DOCX, or TXT · drag & drop or{" "}
                <span className="text-primary font-medium">browse files</span>
              </p>
              <p className="text-[11px] text-muted-foreground/40 mt-1">
                Multiple files can be uploaded at once
              </p>
            </div>
            <input
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.docx,.txt"
              onChange={handleFileSelect}
            />
          </label>
        </CardContent>
      </Card>

      {readyFiles.length > 1 ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
          <div>
            <p className="text-sm font-medium">
              {readyFiles.length} files ready for review
            </p>
            <p className="text-xs text-muted-foreground">
              Nothing is uploaded until you confirm.
            </p>
          </div>
          <Button onClick={() => uploadReviewedFiles()}>
            Upload all reviewed files
          </Button>
        </div>
      ) : null}

      {files.length > 0 ? (
        <div className="space-y-3">
          {files.map((file) => (
            <div key={file.id} className="rounded-lg border bg-card">
              <div className="flex items-center gap-3 px-4 py-3">
                <FileText className="h-4 w-4 text-primary/60 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <Badge
                  variant={
                    file.status === "complete"
                      ? "default"
                      : file.status === "error"
                      ? "destructive"
                      : "secondary"
                  }
                  className={cn(
                    "text-xs shrink-0",
                    file.status === "complete" &&
                      "bg-success/10 text-success border-success/20"
                  )}
                >
                  {(file.status === "uploading" || file.status === "processing") && (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  )}
                  {file.status === "complete" && (
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                  )}
                  {file.status === "error" && (
                    <AlertCircle className="mr-1 h-3 w-3" />
                  )}
                  {getStatusLabel(file.status)}
                </Badge>
                <button
                  onClick={() => removeFile(file.id)}
                  className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {file.status === "review" ? (
                <div className="border-t px-4 py-3">
                  <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Expected destination
                        </p>
                        <p className="text-sm font-medium">{file.mapping.destination}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Expected mapping
                        </p>
                        <p className="text-sm font-medium">
                          {file.mapping.category
                            ? CATEGORY_LABELS[file.mapping.category]
                            : file.mapping.readinessArea}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {file.mapping.note}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline">{file.mapping.confidence} confidence</Badge>
                        {file.mapping.signals.length > 0 ? (
                          file.mapping.signals.map((signal) => (
                            <Badge key={signal} variant="secondary">
                              {signal}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="destructive">weak filename signal</Badge>
                        )}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Preview before upload
                      </p>
                      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
                        {file.preview}
                      </pre>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Nothing is uploaded until you confirm.
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => removeFile(file.id)}>
                        Remove
                      </Button>
                      <Button onClick={() => uploadReviewedFiles([file.id])} className="gap-2">
                        <Upload className="h-3.5 w-3.5" />
                        Upload & Index
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {file.stage ? (
                <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                  {file.stage}
                </p>
              ) : null}
              {file.error ? (
                <p className="border-t px-4 py-2 text-xs text-destructive">
                  {file.error}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
