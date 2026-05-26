import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import {
  getLatestPublicBaseline,
  runPublicBaselineResearch,
} from "@/services/onboarding/public-baseline";

export async function GET() {
  try {
    const { user, workspaceId } = await getWorkspaceContext();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    return NextResponse.json({ research: await getLatestPublicBaseline(workspaceId) });
  } catch (error) {
    console.error("Public research GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load research" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, workspaceId } = await getWorkspaceContext();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const body = await request.json();
    const companyName = String(body.companyName || "").trim();
    if (!companyName) {
      return NextResponse.json({ error: "companyName is required" }, { status: 400 });
    }

    const research = await runPublicBaselineResearch({
      workspaceId,
      companyName,
      website: typeof body.website === "string" ? body.website.trim() : undefined,
      uei: typeof body.uei === "string" ? body.uei.trim() : undefined,
      cage: typeof body.cage === "string" ? body.cage.trim() : undefined,
    });

    return NextResponse.json({ research }, { status: 201 });
  } catch (error) {
    console.error("Public research POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Public research failed" },
      { status: 500 }
    );
  }
}
