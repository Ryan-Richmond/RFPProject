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
  Settings,
  LogOut,
  Target,
  Building2,
  Cpu,
  Users,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

      {/* User Menu */}
      <div className="px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent/50 cursor-pointer"
          >
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                {displayName ? getInitials(displayName) : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 text-left">
              <p className="line-clamp-1 text-xs font-medium text-sidebar-foreground">
                {activeWorkspace?.workspaceName || "My Workspace"}
              </p>
              {activeWorkspace?.role ? (
                <p className="text-[11px] capitalize text-sidebar-foreground/50">
                  {activeWorkspace.role}
                </p>
              ) : null}
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground/40 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-[200px]">
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            {workspaces.length ? (
              workspaces.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.workspaceId}
                  onClick={() => handleWorkspaceSwitch(workspace.workspaceId)}
                  className="flex-col items-start gap-0.5"
                >
                  <span className="line-clamp-1">
                    {workspace.workspaceName}
                  </span>
                  <span className="text-[11px] capitalize text-muted-foreground">
                    {workspace.workspaceId === activeWorkspaceId
                      ? "Active"
                      : workspace.role}
                  </span>
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled>No workspaces found</DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/profile")}>
              <Settings className="mr-2 h-4 w-4" />
              Company Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
