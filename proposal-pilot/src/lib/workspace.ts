import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export interface WorkspaceContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User | null;
  workspaceId: string | null;
  role: string | null;
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
      role: null,
    };
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  return {
    supabase,
    user,
    workspaceId: membership?.workspace_id || null,
    role: membership?.role || null,
  };
}
