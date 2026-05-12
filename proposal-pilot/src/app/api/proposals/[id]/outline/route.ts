import { NextRequest, NextResponse } from "next/server";
import {
  generateOutline,
  getOutlineSections,
  updateOutlineSection,
} from "@/services/proposal-outline";
import { getWorkspaceContext } from "@/lib/workspace";

async function verifyProposal(id: string, workspaceId: string) {
  const { supabase } = await getWorkspaceContext();
  const { data: proposal } = await supabase
    .from("proposal_drafts")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();

  return proposal;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, workspaceId } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const proposal = await verifyProposal(id, workspaceId);
    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    const outlineSections = await getOutlineSections(id, workspaceId);
    return NextResponse.json({ outlineSections });
  } catch (error) {
    console.error("Proposal outline GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch proposal outline" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, workspaceId } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const proposal = await verifyProposal(id, workspaceId);
    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const outlineSections = await generateOutline(id, workspaceId, {
      regenerate: Boolean(body.regenerate),
    });

    return NextResponse.json({ outlineSections });
  } catch (error) {
    console.error("Proposal outline POST error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate proposal outline",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, workspaceId } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const proposal = await verifyProposal(id, workspaceId);
    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    const body = await request.json();
    const sectionId = body.sectionId as string | undefined;
    if (!sectionId) {
      return NextResponse.json({ error: "sectionId is required" }, { status: 400 });
    }

    const section = await updateOutlineSection(id, workspaceId, sectionId, body.patch || {});
    return NextResponse.json({ section });
  } catch (error) {
    console.error("Proposal outline PATCH error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update proposal outline",
      },
      { status: 500 }
    );
  }
}
