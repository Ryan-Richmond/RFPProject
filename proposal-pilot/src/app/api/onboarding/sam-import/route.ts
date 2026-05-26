import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { importSamEntity } from "@/services/onboarding/sam-entity";

export async function POST(request: NextRequest) {
  try {
    const { user, workspaceId } = await getWorkspaceContext();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const body = await request.json();
    const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
    const uei = typeof body.uei === "string" ? body.uei.trim() : "";
    const cage = typeof body.cage === "string" ? body.cage.trim() : "";

    if (!companyName && !uei && !cage) {
      return NextResponse.json(
        { error: "Provide companyName, UEI, or CAGE" },
        { status: 400 }
      );
    }

    const research = await importSamEntity({
      workspaceId,
      companyName: companyName || undefined,
      uei: uei || undefined,
      cage: cage || undefined,
    });

    return NextResponse.json({ research }, { status: 201 });
  } catch (error) {
    console.error("SAM import error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SAM.gov import failed" },
      { status: 500 }
    );
  }
}
