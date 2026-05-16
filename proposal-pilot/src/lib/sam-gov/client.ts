/**
 * SAM.gov public API client.
 *
 * Fetches the full solicitation description and attachments for a notice so
 * the RFP analyzer can work off the real source-of-truth content (SOW,
 * Sections L/M, amendments) rather than a discovery synopsis.
 *
 * Requires `SAM_GOV_API_KEY` in the environment.
 */

const SAM_API_BASE = "https://api.sam.gov";

export interface SamResource {
  resourceId: string;
  name: string;
  url: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface SamFetchResult {
  description: string;
  resources: SamResource[];
  attachments: Array<{
    resource: SamResource;
    text: string;
    pageCount?: number;
    bytes: number;
  }>;
  failedAttachments: Array<{ resource: SamResource; error: string }>;
  /** Set when the description endpoint threw (network, 401, etc.). */
  descriptionError?: string;
  /** Set when the resource-list endpoint threw (network, 401, etc.). */
  resourceListError?: string;
}

function resolveSamKey(): string | undefined {
  return process.env.SAM_GOV_API_KEY || process.env.SAM_API_KEY;
}

export function isSamApiConfigured(): boolean {
  return Boolean(resolveSamKey());
}

function requireKey(): string {
  const key = resolveSamKey();
  if (!key) {
    throw new Error(
      "SAM_GOV_API_KEY is not configured. Set it in Vercel env vars (or .env.local for local dev) to enable SAM.gov fetches."
    );
  }
  return key;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Fetch the long-form description for a notice. SAM returns HTML.
 */
export async function fetchNoticeDescription(noticeId: string): Promise<string> {
  const key = requireKey();
  const url = `${SAM_API_BASE}/prod/opportunities/v1/noticedesc?noticeid=${encodeURIComponent(
    noticeId
  )}&api_key=${encodeURIComponent(key)}`;

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(
      `SAM.gov description fetch failed (${response.status}): ${await response.text().catch(() => "")}`
    );
  }

  const payload = (await response.json()) as { description?: string };
  const html = payload.description || "";
  return stripHtml(html);
}

interface SamResourceListResponse {
  opportunityAttachmentList?: Array<{
    attachments?: Array<{
      resourceId?: string;
      name?: string;
      url?: string;
      uri?: string;
      mimeType?: string;
      type?: string;
      size?: number | string;
      attachmentByteSize?: number | string;
    }>;
  }>;
}

/**
 * List downloadable attachments for a notice (SOW, Sections L/M, amendments…).
 */
export async function listNoticeResources(
  noticeId: string
): Promise<SamResource[]> {
  const key = requireKey();
  const url = `${SAM_API_BASE}/prod/opportunities/v1/${encodeURIComponent(
    noticeId
  )}/resources?api_key=${encodeURIComponent(key)}`;

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    // 404 is normal for notices with no attachments — caller treats as empty list.
    if (response.status === 404) return [];
    throw new Error(
      `SAM.gov resource list failed (${response.status}): ${await response
        .text()
        .catch(() => "")}`
    );
  }

  const payload = (await response.json()) as SamResourceListResponse;
  const out: SamResource[] = [];

  for (const bundle of payload.opportunityAttachmentList || []) {
    for (const attachment of bundle.attachments || []) {
      const downloadUrl = attachment.url || attachment.uri;
      const resourceId = attachment.resourceId;
      if (!downloadUrl || !resourceId) continue;

      const size =
        typeof attachment.size === "number"
          ? attachment.size
          : typeof attachment.attachmentByteSize === "number"
            ? attachment.attachmentByteSize
            : Number(attachment.size ?? attachment.attachmentByteSize ?? NaN);

      out.push({
        resourceId,
        name: attachment.name || `attachment-${resourceId}`,
        url: downloadUrl,
        mimeType: attachment.mimeType || attachment.type,
        sizeBytes: Number.isFinite(size) ? size : undefined,
      });
    }
  }

  return out;
}

/**
 * Download a single resource. SAM redirects to a signed S3 URL; fetch follows.
 * Caller is responsible for size guarding before parsing.
 */
export async function downloadResource(resource: SamResource): Promise<Buffer> {
  const key = requireKey();
  const separator = resource.url.includes("?") ? "&" : "?";
  const url = `${resource.url}${separator}api_key=${encodeURIComponent(key)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Download failed for ${resource.name} (${response.status})`
    );
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer;
}

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25MB per attachment
const PARSEABLE_EXTENSIONS = new Set(["pdf", "docx", "doc", "txt"]);

function extensionOf(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

/**
 * Pull everything we can for a notice: long description + all parseable
 * attachments. Errors on individual attachments are reported but do not abort
 * the whole fetch.
 */
export async function fetchNoticeBundle(
  noticeId: string
): Promise<SamFetchResult> {
  const { parseDocument } = await import("@/lib/documents/parser");

  let descriptionError: string | undefined;
  let resourceListError: string | undefined;

  const [description, resources] = await Promise.all([
    fetchNoticeDescription(noticeId).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      descriptionError = message;
      console.warn(`SAM description fetch failed for ${noticeId}:`, error);
      return "";
    }),
    listNoticeResources(noticeId).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      resourceListError = message;
      console.warn(`SAM resource list failed for ${noticeId}:`, error);
      return [] as SamResource[];
    }),
  ]);

  const attachments: SamFetchResult["attachments"] = [];
  const failedAttachments: SamFetchResult["failedAttachments"] = [];

  for (const resource of resources) {
    const ext = extensionOf(resource.name);
    if (!PARSEABLE_EXTENSIONS.has(ext)) {
      failedAttachments.push({
        resource,
        error: `Skipped: unsupported file type .${ext || "unknown"}`,
      });
      continue;
    }

    if (resource.sizeBytes && resource.sizeBytes > MAX_ATTACHMENT_BYTES) {
      failedAttachments.push({
        resource,
        error: `Skipped: file exceeds 25MB limit`,
      });
      continue;
    }

    try {
      const buffer = await downloadResource(resource);
      if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
        failedAttachments.push({
          resource,
          error: `Skipped: file exceeds 25MB limit after download`,
        });
        continue;
      }

      const parsed = await parseDocument(buffer, resource.name);
      attachments.push({
        resource,
        text: parsed.text,
        pageCount: parsed.metadata.pageCount,
        bytes: buffer.byteLength,
      });
    } catch (error) {
      failedAttachments.push({
        resource,
        error: error instanceof Error ? error.message : "Unknown parse error",
      });
    }
  }

  return {
    description,
    resources,
    attachments,
    failedAttachments,
    descriptionError,
    resourceListError,
  };
}

/**
 * Stitch the description + attachment text into one analyzer-ready blob with
 * section headers so the LLM can attribute requirements back to their source.
 */
export function buildAnalyzerText(bundle: SamFetchResult): string {
  const sections: string[] = [];

  if (bundle.description) {
    sections.push(
      "=== SAM.gov Notice Description ===\n" + bundle.description.trim()
    );
  }

  for (const attachment of bundle.attachments) {
    if (!attachment.text.trim()) continue;
    sections.push(
      `=== Attachment: ${attachment.resource.name} ===\n${attachment.text.trim()}`
    );
  }

  return sections.join("\n\n");
}
