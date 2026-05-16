import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import {
  fetchNoticeBundle,
  isSamApiConfigured,
} from "@/lib/sam-gov/client";

/**
 * Diagnostic endpoint — reports which integration env vars are present on
 * the running server. Does NOT return any values, only presence booleans
 * and short key prefixes for verification. Workspace-gated.
 *
 * Optional `?probe_notice_id=<id>` parameter triggers a live SAM.gov fetch
 * against that notice so you can verify the API path end-to-end from a
 * deployed environment.
 */
export async function GET(request: NextRequest) {
  const { user } = await getWorkspaceContext();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const samKey = process.env.SAM_GOV_API_KEY || process.env.SAM_API_KEY;
  const samKeyName = process.env.SAM_GOV_API_KEY
    ? "SAM_GOV_API_KEY"
    : process.env.SAM_API_KEY
      ? "SAM_API_KEY (legacy)"
      : null;

  const result: Record<string, unknown> = {
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    sam_gov: {
      configured: Boolean(samKey),
      env_var_name: samKeyName,
      key_prefix: samKey ? `${samKey.slice(0, 6)}…` : null,
    },
    gemini: {
      configured: Boolean(process.env.GEMINI_API_KEY),
      key_prefix: process.env.GEMINI_API_KEY
        ? `${process.env.GEMINI_API_KEY.slice(0, 6)}…`
        : null,
    },
    perplexity: {
      configured: Boolean(process.env.PERPLEXITY_API_KEY),
    },
    supabase: {
      url_configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      service_role_configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
  };

  const probeNoticeId = request.nextUrl.searchParams.get("probe_notice_id");
  if (probeNoticeId) {
    if (!isSamApiConfigured()) {
      result.sam_probe = {
        notice_id: probeNoticeId,
        success: false,
        error: "SAM API key not configured — cannot probe.",
      };
    } else {
      try {
        const bundle = await fetchNoticeBundle(probeNoticeId);
        result.sam_probe = {
          notice_id: probeNoticeId,
          success: true,
          description_chars: bundle.description.length,
          resources_listed: bundle.resources.length,
          attachments_parsed: bundle.attachments.length,
          attachments_failed: bundle.failedAttachments.length,
          failed_details: bundle.failedAttachments.map((f) => ({
            name: f.resource.name,
            error: f.error,
          })),
        };
      } catch (error) {
        result.sam_probe = {
          notice_id: probeNoticeId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  }

  return NextResponse.json(result);
}
