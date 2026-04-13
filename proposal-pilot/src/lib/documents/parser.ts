/**
 * Document parsing utilities
 *
 * Converts PDF, DOCX, and TXT files to clean text for processing.
 * Uses pdf-parse and mammoth.js (to be installed in Epic 2).
 */

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
 * Placeholder — will use pdf-parse and mammoth.js when installed.
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

async function parsePDF(buffer: Buffer): Promise<ParsedDocument> {
  // TODO: Install pdf-parse and implement
  // const pdfParse = require("pdf-parse");
  // const data = await pdfParse(buffer);
  const text = "PDF parsing will be implemented in Epic 2.";
  return {
    text,
    metadata: {
      wordCount: text.split(/\s+/).length,
      format: "pdf",
    },
  };
}

async function parseDOCX(buffer: Buffer): Promise<ParsedDocument> {
  // TODO: Install mammoth and implement
  // const mammoth = require("mammoth");
  // const result = await mammoth.extractRawText({ buffer });
  const text = "DOCX parsing will be implemented in Epic 2.";
  return {
    text,
    metadata: {
      wordCount: text.split(/\s+/).length,
      format: "docx",
    },
  };
}

async function parseTXT(buffer: Buffer): Promise<ParsedDocument> {
  const text = buffer.toString("utf-8");
  return {
    text,
    metadata: {
      wordCount: text.split(/\s+/).length,
      format: "txt",
    },
  };
}
