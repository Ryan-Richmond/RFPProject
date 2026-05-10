import { NextRequest, NextResponse } from "next/server";
import {
  ACTIVE_WORKSPACE_COOKIE,
  ACTIVE_WORKSPACE_COOKIE_OPTIONS,
  getWorkspaceContext,
} from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { user, workspaceId, memberships } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      activeWorkspaceId: workspaceId,
      workspaces: memberships,
    });
  } catch (error) {
    console.error("Workspaces GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspaces" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json(
        { error: "Workspace name is required" },
        { status: 400 }
      );
    }

    const { data: workspace, error: wsError } = await supabase
      .from("workspaces")
      .insert({ name, owner_id: user.id })
      .select("id, name")
      .single();

    if (wsError || !workspace) {
      throw wsError ?? new Error("Failed to create workspace");
    }

    const response = NextResponse.json({ workspace }, { status: 201 });
    response.cookies.set(
      ACTIVE_WORKSPACE_COOKIE,
      workspace.id,
      ACTIVE_WORKSPACE_COOKIE_OPTIONS
    );

    return response;
  } catch (error) {
    console.error("Workspaces POST error:", error);
    return NextResponse.json(
      { error: "Failed to create workspace" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, memberships } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const workspaceId =
      typeof body.workspaceId === "string" ? body.workspaceId : null;

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 }
      );
    }

    const membership = memberships.find(
      (item) => item.workspaceId === workspaceId
    );

    if (!membership) {
      return NextResponse.json(
        { error: "You are not a member of that workspace" },
        { status: 403 }
      );
    }

    const response = NextResponse.json({
      activeWorkspaceId: membership.workspaceId,
      workspace: membership,
    });

    response.cookies.set(
      ACTIVE_WORKSPACE_COOKIE,
      membership.workspaceId,
      ACTIVE_WORKSPACE_COOKIE_OPTIONS
    );

    return response;
  } catch (error) {
    console.error("Workspaces PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to switch workspace" },
      { status: 500 }
    );
  }
}
