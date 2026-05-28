export type SupportedDocumentFormat = "pdf" | "docx" | "txt";

const FORMAT_BY_EXTENSION: Record<string, SupportedDocumentFormat> = {
  pdf: "pdf",
  docx: "docx",
  txt: "txt",
};

const FORMAT_BY_MIME_TYPE: Record<string, SupportedDocumentFormat> = {
  "application/pdf": "pdf",
  "application/x-pdf": "pdf",
  "application/acrobat": "pdf",
  "application/vnd.pdf": "pdf",
  "text/pdf": "pdf",
  "text/x-pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
};

const GENERIC_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  "binary/octet-stream",
]);

export const SUPPORTED_DOCUMENT_LABEL = "PDF, DOCX, or TXT";

export function getDocumentExtension(filename: string) {
  return filename.split(".").pop()?.toLowerCase() || "";
}

function normalizeMimeType(mimeType: string) {
  return mimeType.toLowerCase().split(";")[0].trim();
}

export function getSupportedDocumentFormat(file: Pick<File, "name" | "type">) {
  const mimeType = normalizeMimeType(file.type);
  const mimeFormat = FORMAT_BY_MIME_TYPE[mimeType];
  if (mimeFormat) {
    return mimeFormat;
  }

  const extensionFormat = FORMAT_BY_EXTENSION[getDocumentExtension(file.name)];
  if (extensionFormat && GENERIC_MIME_TYPES.has(mimeType)) {
    return extensionFormat;
  }

  return null;
}

export function isSupportedDocumentFile(file: Pick<File, "name" | "type">) {
  return getSupportedDocumentFormat(file) !== null;
}

export function getCanonicalMimeType(format: SupportedDocumentFormat) {
  switch (format) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "txt":
      return "text/plain";
  }
}
