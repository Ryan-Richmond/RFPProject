/**
 * Document parsing utilities
 *
 * Converts PDF, DOCX, and TXT files to clean text for processing.
 */

import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

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
  filename: string
): Promise<ParsedDocument> {
  const ext = filename.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "pdf":
      return parsePDF(buffer);
    case "docx":
    case "doc":
      return parseDOCX(buffer);
    case "txt":
      return parseTXT(buffer);
    default:
      throw new Error(`Unsupported file format: ${ext}`);
  }
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

async function parsePDF(buffer: Buffer): Promise<ParsedDocument> {
  const parser = new PDFParse({ data: buffer });
  const [textResult, infoResult] = await Promise.all([
    parser.getText(),
    parser.getInfo({ parsePageInfo: true }),
  ]);
  await parser.destroy();

  const text = textResult.text.trim();

  return {
    text,
    metadata: {
      title: infoResult.info?.Title || undefined,
      pageCount: infoResult.total || undefined,
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
