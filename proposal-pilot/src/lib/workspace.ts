import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const ACTIVE_WORKSPACE_COOKIE = "proposalpilot_active_workspace_id";
export const ACTIVE_WORKSPACE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

export interface WorkspaceMembership {
  workspaceId: string;
  workspaceName: string;
  role: string;
}

export interface WorkspaceContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User | null;
  workspaceId: string | null;
  workspaceName: string | null;
  role: string | null;
  memberships: WorkspaceMembership[];
}

export async function getWorkspaceContext(): Promise<WorkspaceContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
      workspaceId: null,
      workspaceName: null,
      role: null,
      memberships: [],
    };
  }

  const cookieStore = await cookies();
  const activeWorkspaceId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;

  const { data: membershipRows } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(id, name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const memberships = (membershipRows || []).map((membership) => {
    const workspace = Array.isArray(membership.workspaces)
      ? membership.workspaces[0]
      : membership.workspaces;

    return {
      workspaceId: membership.workspace_id,
      workspaceName: workspace?.name || "Workspace",
      role: membership.role,
    };
  });

  const activeMembership =
    memberships.find((membership) => membership.workspaceId === activeWorkspaceId) ||
    memberships[0] ||
    null;

  return {
    supabase,
    user,
    workspaceId: activeMembership?.workspaceId || null,
    workspaceName: activeMembership?.workspaceName || null,
    role: activeMembership?.role || null,
    memberships,
  };
}
