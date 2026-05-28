/**
 * Document parsing utilities
 *
 * Converts PDF, DOCX, and TXT files to clean text for processing.
 */

import mammoth from "mammoth";
import {
  getDocumentExtension,
  getSupportedDocumentFormat,
} from "@/lib/documents/validation";

export interface ParsedDocument {
  text: string;
  metadata: {
    title?: string;
    pageCount?: number;
    wordCount: number;
    format: "pdf" | "docx" | "txt";
  };
}

/**
 * Parse a document file into clean text.
 */
export async function parseDocument(
  buffer: Buffer,
  filename: string,
  mimeType = ""
): Promise<ParsedDocument> {
  const format = getSupportedDocumentFormat({ name: filename, type: mimeType });

  switch (format) {
    case "pdf":
      return parsePDF(buffer);
    case "docx":
      return parseDOCX(buffer);
    case "txt":
      return parseTXT(buffer);
    default:
      throw new Error(
        `Unsupported file format: ${getDocumentExtension(filename) || mimeType || "unknown"}`
      );
  }
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

async function parsePDF(buffer: Buffer): Promise<ParsedDocument> {
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text: rawText } = await extractText(pdf, { mergePages: true });
  const { info } = await pdf.getMetadata();
  await pdf.destroy();

  const text = rawText.trim();

  return {
    text,
    metadata: {
      title: (info as Record<string, unknown>)?.Title as string | undefined,
      pageCount: totalPages || undefined,
      wordCount: countWords(text),
      format: "pdf",
    },
  };
}

async function parseDOCX(buffer: Buffer): Promise<ParsedDocument> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.trim();

  return {
    text,
    metadata: {
      wordCount: countWords(text),
      format: "docx",
    },
  };
}

async function parseTXT(buffer: Buffer): Promise<ParsedDocument> {
  const text = buffer.toString("utf-8").trim();
  return {
    text,
    metadata: {
      wordCount: countWords(text),
      format: "txt",
    },
  };
}
