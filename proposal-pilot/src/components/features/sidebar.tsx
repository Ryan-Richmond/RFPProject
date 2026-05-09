"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  FileSearch,
  PenTool,
  CheckCircle,
  LayoutDashboard,
  LogOut,
  Target,
  Building2,
  Cpu,
  Users,
  ChevronRight,
  Check,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  {
    label: "Workspace",
    href: "/workspace",
    icon: LayoutDashboard,
  },
  {
    label: "Opportunities",
    href: "/opportunities",
    icon: Target,
  },
  {
    label: "Knowledge Base",
    href: "/knowledge-base",
    icon: BookOpen,
  },
  {
    label: "Proposals",
    href: "/proposals",
    icon: FileSearch,
  },
  {
    label: "Drafting",
    href: "/drafting",
    icon: PenTool,
  },
  {
    label: "Compliance",
    href: "/compliance",
    icon: CheckCircle,
  },
  {
    label: "Company",
    href: "/profile",
    icon: Building2,
  },
  {
    label: "Team",
    href: "/team",
    icon: Users,
  },
  {
    label: "Automation",
    href: "/computer-ops",
    icon: Cpu,
  },
];

interface WorkspaceOption {
  workspaceId: string;
  workspaceName: string;
  role: string;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);

  const activeWorkspace = workspaces.find(
    (workspace) => workspace.workspaceId === activeWorkspaceId
  );

  const displayName = companyName || activeWorkspace?.workspaceName || null;

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [workspacesResponse, statusResponse] = await Promise.all([
          fetch("/api/workspaces"),
          fetch("/api/workspace/status"),
        ]);

        if (!isMounted) return;

        if (workspacesResponse.ok) {
          const payload = await workspacesResponse.json();
          setWorkspaces(payload.workspaces || []);
          setActiveWorkspaceId(payload.activeWorkspaceId || null);
        }

        if (statusResponse.ok) {
          const status = await statusResponse.json();
          if (status.companyName) setCompanyName(status.companyName);
        }
      } catch (error) {
        console.error("Failed to load sidebar data:", error);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleWorkspaceSwitch(workspaceId: string) {
    if (workspaceId === activeWorkspaceId) return;

    const response = await fetch("/api/workspaces", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });

    if (!response.ok) return;

    setActiveWorkspaceId(workspaceId);
    setCompanyName(null);
    router.refresh();
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-[220px] flex-col border-r bg-sidebar">
      {/* Logo + Company Name */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-indigo shrink-0">
            <PenTool className="h-4 w-4 text-white" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">
            ProposalPilot
          </span>
        </div>
        {displayName ? (
          <div className="mt-2.5 flex items-center gap-1.5 rounded-md bg-sidebar-accent/60 px-2.5 py-1.5">
            <Building2 className="h-3.5 w-3.5 text-sidebar-primary shrink-0" />
            <span className="line-clamp-1 text-xs font-medium text-sidebar-primary">
              {displayName}
            </span>
          </div>
        ) : null}
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-[18px] w-[18px]",
                  isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50"
                )}
              />
              {item.label}
              {isActive && (
                <ChevronRight className="ml-auto h-3 w-3 text-sidebar-primary/50" />
              )}
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* Workspace Switcher */}
      <div className="px-3 pt-3 pb-1">
        <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
          Workspaces
        </p>
        {workspaces.length > 0 ? (
          workspaces.map((workspace) => {
            const isActive = workspace.workspaceId === activeWorkspaceId;
            return (
              <button
                key={workspace.workspaceId}
                onClick={() => handleWorkspaceSwitch(workspace.workspaceId)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarFallback
                    className={cn(
                      "text-[10px] font-semibold",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {getInitials(workspace.workspaceName)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 min-w-0 truncate text-xs font-medium">
                  {workspace.workspaceName}
                </span>
                {isActive && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-sidebar-primary" />
                )}
              </button>
            );
          })
        ) : (
          <p className="px-3 py-2 text-xs text-sidebar-foreground/40">
            No workspaces found
          </p>
        )}
      </div>

      {/* Sign Out */}
      <div className="px-3 pb-3">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
