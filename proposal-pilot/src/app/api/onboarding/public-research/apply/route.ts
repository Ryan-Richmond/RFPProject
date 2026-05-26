import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import {
  applyPublicBaselineSuggestions,
  type PublicBaselineSuggestions,
} from "@/services/onboarding/public-baseline";

const ALLOWED_FIELDS = new Set<keyof PublicBaselineSuggestions>([
  "business_description",
  "naics_codes",
  "core_capabilities",
  "certifications",
  "preferred_agencies",
  "past_contract_vehicles",
]);

export async function PATCH(request: NextRequest) {
  try {
    const { user, workspaceId } = await getWorkspaceContext();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const body = await request.json();
    const researchId = String(body.researchId || "").trim();
    if (!researchId) {
      return NextResponse.json({ error: "researchId is required" }, { status: 400 });
    }

    const fields = Array.isArray(body.fields)
      ? body.fields.filter((field: unknown): field is keyof PublicBaselineSuggestions =>
          typeof field === "string" &&
          ALLOWED_FIELDS.has(field as keyof PublicBaselineSuggestions)
        )
      : [];
    if (fields.length === 0) {
      return NextResponse.json({ error: "At least one field is required" }, { status: 400 });
    }

    const profile = await applyPublicBaselineSuggestions({ workspaceId, researchId, fields });
    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Public research apply error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to apply suggestions" },
      { status: 500 }
    );
  }
}
