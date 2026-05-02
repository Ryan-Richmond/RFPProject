import { NextRequest, NextResponse } from "next/server";
import {
  ACTIVE_WORKSPACE_COOKIE,
  ACTIVE_WORKSPACE_COOKIE_OPTIONS,
  getWorkspaceContext,
} from "@/lib/workspace";

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const inviteCode =
      typeof body.inviteCode === "string"
        ? body.inviteCode.trim().toUpperCase()
        : "";

    if (!inviteCode) {
      return NextResponse.json(
        { error: "Invite code is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc("redeem_workspace_invite", {
      invite_code: inviteCode,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const redeemed = Array.isArray(data) ? data[0] : data;

    if (!redeemed?.workspace_id) {
      return NextResponse.json(
        { error: "Invite could not be redeemed" },
        { status: 400 }
      );
    }

    const response = NextResponse.json({
      workspaceId: redeemed.workspace_id,
      role: redeemed.role,
    });

    response.cookies.set(
      ACTIVE_WORKSPACE_COOKIE,
      redeemed.workspace_id,
      ACTIVE_WORKSPACE_COOKIE_OPTIONS
    );

    return response;
  } catch (error) {
    console.error("Invite redeem error:", error);
    return NextResponse.json(
      { error: "Failed to redeem invite" },
      { status: 500 }
    );
  }
}
