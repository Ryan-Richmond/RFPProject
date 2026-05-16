import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import {
  fetchNoticeBundle,
  isSamApiConfigured,
} from "@/lib/sam-gov/client";

/**
 * Diagnostic endpoint — reports which integration env vars are present on
 * the running server. Does NOT return any values, only presence booleans
 * and short key prefixes for verification. Restricted to workspace
 * owners/admins because the prefixes still leak partial secret material.
 *
 * Optional `?probe_notice_id=<id>` parameter triggers a live SAM.gov fetch
 * against that notice so you can verify the API path end-to-end from a
 * deployed environment. The probe reports `success: false` whenever the
 * underlying SAM endpoints raised (which `fetchNoticeBundle` would
 * otherwise swallow as empty results).
 */
export async function GET(request: NextRequest) {
  const { user, workspaceId, role } = await getWorkspaceContext();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!workspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 403 });
  }

  if (role !== "owner" && role !== "admin") {
    return NextResponse.json(
      { error: "Workspace admin or owner role required" },
      { status: 403 }
    );
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
    },
    gemini: {
      configured: Boolean(process.env.GEMINI_API_KEY),
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
        const upstreamErrors = [
          bundle.descriptionError && `description: ${bundle.descriptionError}`,
          bundle.resourceListError && `resources: ${bundle.resourceListError}`,
        ].filter(Boolean) as string[];
        const hasContent =
          bundle.description.trim().length > 0 || bundle.attachments.length > 0;
        const success = upstreamErrors.length === 0 && hasContent;

        result.sam_probe = {
          notice_id: probeNoticeId,
          success,
          ...(success
            ? {}
            : {
                error: upstreamErrors.length
                  ? `Upstream SAM.gov call failed — ${upstreamErrors.join("; ")}`
                  : "SAM.gov returned an empty bundle (no description, no parsed attachments).",
              }),
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
