/**
 * Document Upload Service
 *
 * Handles file validation, storage to Supabase, and
 * creation of source_document records with processing job tracking.
 */

import { createClient } from "@/lib/supabase/server";

export type DocumentType = "rfp" | "company";
export type ProcessingStatus =
  | "queued"
  | "processing"
  | "complete"
  | "error";

export interface SourceDocument {
  id: string;
  workspace_id: string;
  document_type: DocumentType;
  filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  processing_status: ProcessingStatus;
  created_at: string;
  updated_at: string;
}

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Upload a document to Supabase Storage and create a tracking record.
 */
export async function uploadDocument(
  file: File,
  workspaceId: string,
  documentType: DocumentType
): Promise<SourceDocument> {
  // Validate
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(
      `Invalid file type: ${file.type}. Allowed: PDF, DOCX, TXT`
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size: 50MB`);
  }

  const supabase = await createClient();

  // Generate a unique file path
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${workspaceId}/${documentType}/${timestamp}_${sanitizedName}`;

  // Upload to Supabase Storage
  const { error: storageError } = await supabase.storage
    .from("documents")
    .upload(filePath, file);

  if (storageError) {
    throw new Error(`Upload failed: ${storageError.message}`);
  }

  // Create source_document record
  const { data: docData, error: docError } = await supabase
    .from("source_documents")
    .insert({
      workspace_id: workspaceId,
      document_type: documentType,
      filename: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      processing_status: "queued",
    })
    .select()
    .single();

  if (docError) {
    throw new Error(`Failed to create document record: ${docError.message}`);
  }

  return docData as SourceDocument;
}
