"use client";

import { useCallback, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, X, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DocumentUploaderProps {
  type: "company" | "rfp";
  title: string;
  description: string;
  onComplete?: (results: UploadWorkflowResult[]) => void;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "queued" | "processing" | "complete" | "error";
  stage?: string;
  error?: string;
}

export interface UploadWorkflowResult {
  documentId: string;
  solicitationId?: string;
  proposalId?: string;
}

export function DocumentUploader({
  type,
  title,
  description,
  onComplete,
}: DocumentUploaderProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

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
      });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", "company");

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

      if (!indexResponse.ok) {
        const error = await indexResponse.json().catch(() => ({}));
        throw new Error(error.error || "Knowledge base indexing failed");
      }

      updateFile(uploadedFileId, {
        status: "complete",
        stage: "Indexed",
      });

      return { documentId: document.id };
    },
    [updateFile]
  );

  const uploadRfpDocument = useCallback(
    async (file: File, uploadedFileId: string): Promise<UploadWorkflowResult> => {
      updateFile(uploadedFileId, {
        status: "uploading",
        stage: "Uploading RFP",
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

  const processFiles = useCallback(async (newFiles: File[]) => {
    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    const invalidFiles = newFiles.filter((file) => !validTypes.includes(file.type));
    if (invalidFiles.length > 0) {
      toast.error("Only PDF, DOCX, and TXT files are supported.");
    }

    const validFiles = newFiles.filter((f) => validTypes.includes(f.type));

    const uploadFiles: UploadedFile[] = validFiles
      .map((f) => ({
        id: crypto.randomUUID(),
        name: f.name,
        size: f.size,
        status: "queued" as const,
        stage: "Queued",
      }));

    setFiles((prev) => [...prev, ...uploadFiles]);

    const successfulUploads: UploadWorkflowResult[] = [];

    for (let index = 0; index < uploadFiles.length; index += 1) {
      const uploadFile = uploadFiles[index];
      const sourceFile = validFiles[index];

      if (!sourceFile) {
        continue;
      }

      try {
        const result =
          type === "company"
            ? await uploadCompanyDocument(sourceFile, uploadFile.id)
            : await uploadRfpDocument(sourceFile, uploadFile.id);

        successfulUploads.push(result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload workflow failed";
        updateFile(uploadFile.id, {
          status: "error",
          stage: "Failed",
          error: message,
        });
        toast.error(message);
      }
    }

    if (successfulUploads.length > 0) {
      onComplete?.(successfulUploads);
      toast.success(
        type === "company"
          ? "Company documents indexed successfully."
          : "RFP uploaded and analyzed successfully."
      );
    }
  }, [onComplete, type, updateFile, uploadCompanyDocument, uploadRfpDocument]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    processFiles(droppedFiles);
  }, [processFiles]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selectedFiles = Array.from(e.target.files);
        processFiles(selectedFiles);
      }
    },
    [processFiles]
  );

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
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
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
              <p className="text-xs text-muted-foreground/60 mt-2">
                PDF, DOCX, or TXT • Drag & drop or{" "}
                <span className="text-primary font-medium">browse</span>
              </p>
            </div>
            <input
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.docx,.doc,.txt"
              onChange={handleFileSelect}
            />
          </label>
        </CardContent>
      </Card>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div key={file.id} className="space-y-1">
              <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
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
                  {file.status === "uploading" && (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  )}
                  {file.status === "processing" && (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  )}
                  {file.status === "complete" && (
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                  )}
                  {file.status}
                </Badge>
                <button
                  onClick={() => removeFile(file.id)}
                  className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {file.stage && (
                <p className="pl-7 text-xs text-muted-foreground">{file.stage}</p>
              )}
              {file.error && (
                <p className="pl-7 text-xs text-destructive">{file.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
