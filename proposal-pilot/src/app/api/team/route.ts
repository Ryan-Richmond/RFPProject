import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";

function createInviteCode() {
  return `PP-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function isAdmin(role: string | null) {
  return role === "owner" || role === "admin";
}

export async function GET() {
  try {
    const { supabase, user, workspaceId, role } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const [{ data: workspace }, { data: members }, { data: invites }] =
      await Promise.all([
        supabase.from("workspaces").select("id, name").eq("id", workspaceId).single(),
        supabase
          .from("workspace_members")
          .select("id, user_id, role, member_email, created_at")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: true }),
        isAdmin(role)
          ? supabase
              .from("workspace_invites")
              .select("id, email, role, code, expires_at, used_at, revoked_at, created_at")
              .eq("workspace_id", workspaceId)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);

    return NextResponse.json({
      workspace,
      currentUserRole: role,
      members: members || [],
      invites: invites || [],
    });
  } catch (error) {
    console.error("Team GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch team" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, workspaceId, role } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    if (!isAdmin(role)) {
      return NextResponse.json(
        { error: "Only workspace owners and admins can invite teammates" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const email = typeof body.email === "string" && body.email.trim()
      ? body.email.trim().toLowerCase()
      : null;
    const inviteRole = body.role === "admin" ? "admin" : "member";
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const { data: invite, error } = await supabase
      .from("workspace_invites")
      .insert({
        workspace_id: workspaceId,
        email,
        role: inviteRole,
        code: createInviteCode(),
        created_by: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select("id, email, role, code, expires_at, used_at, revoked_at, created_at")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    console.error("Team POST error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create invite",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, user, workspaceId, role } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    if (!isAdmin(role)) {
      return NextResponse.json(
        { error: "Only workspace owners and admins can revoke invites" },
        { status: 403 }
      );
    }

    const inviteId = request.nextUrl.searchParams.get("id");
    if (!inviteId) {
      return NextResponse.json({ error: "Invite id is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("workspace_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", inviteId)
      .eq("workspace_id", workspaceId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ status: "revoked" });
  } catch (error) {
    console.error("Team DELETE error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to revoke invite",
      },
      { status: 500 }
    );
  }
}
