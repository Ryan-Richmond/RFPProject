"use client";

import { useCallback, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, X, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentUploaderProps {
  type: "company" | "rfp";
  title: string;
  description: string;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "queued" | "processing" | "complete" | "error";
}

export function DocumentUploader({ type, title, description }: DocumentUploaderProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

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
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selectedFiles = Array.from(e.target.files);
        processFiles(selectedFiles);
      }
    },
    []
  );

  function processFiles(newFiles: File[]) {
    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    const uploadFiles: UploadedFile[] = newFiles
      .filter((f) => validTypes.includes(f.type))
      .map((f) => ({
        id: crypto.randomUUID(),
        name: f.name,
        size: f.size,
        status: "queued" as const,
      }));

    setFiles((prev) => [...prev, ...uploadFiles]);

    // Simulate processing (will be replaced with real Supabase upload)
    uploadFiles.forEach((uf) => {
      setTimeout(() => {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uf.id ? { ...f, status: "processing" } : f
          )
        );
      }, 1000);

      setTimeout(() => {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uf.id ? { ...f, status: "complete" } : f
          )
        );
      }, 3000);
    });
  }

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
            <div
              key={file.id}
              className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
            >
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
          ))}
        </div>
      )}
    </div>
  );
}
