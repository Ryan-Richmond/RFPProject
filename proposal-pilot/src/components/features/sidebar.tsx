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
  Plus,
  Loader2,
  Search,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
    label: "RFP Analysis",
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
    label: "Profile",
    href: "/profile",
    icon: Building2,
  },
  {
    label: "Team",
    href: "/team",
    icon: Users,
  },
  {
    label: "Computer Ops",
    href: "/computer-ops",
    icon: Cpu,
  },
];

interface WorkspaceOption {
  workspaceId: string;
  workspaceName: string;
  role: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);

  const activeWorkspace = workspaces.find(
    (workspace) => workspace.workspaceId === activeWorkspaceId
  );

  useEffect(() => {
    let isMounted = true;

    async function loadWorkspaces() {
      try {
        const response = await fetch("/api/workspaces");
        if (!response.ok) return;

        const payload = await response.json();
        if (!isMounted) return;

        setWorkspaces(payload.workspaces || []);
        setActiveWorkspaceId(payload.activeWorkspaceId || null);
      } catch (error) {
        console.error("Failed to load workspaces:", error);
      }
    }

    loadWorkspaces();

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

    window.location.assign("/workspace");
  }

  function openCreateWorkspace() {
    setCreateName("");
    setCreateOpen(true);
  }

  async function submitCreateWorkspace() {
    const trimmed = createName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to create workspace");
      }
      toast.success(`Workspace "${trimmed}" created.`);
      window.location.assign("/workspace");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create workspace");
      setCreating(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-[220px] flex-col border-r bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-indigo">
          <PenTool className="h-4 w-4 text-white" />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">
          ProposalPilot
        </span>
      </div>

      <Separator />

      {/* Quick search / command trigger */}
      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={() => {
            if (typeof window === "undefined") return;
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
            );
          }}
          className="flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar/40 px-3 py-2 text-xs text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Quick actions…</span>
          <span className="flex items-center gap-0.5">
            <kbd className="kbd">⌘</kbd>
            <kbd className="kbd">K</kbd>
          </span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
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
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                PP
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left">
              <p className="line-clamp-1 text-xs font-medium text-sidebar-foreground">
                {activeWorkspace?.workspaceName || "My Workspace"}
              </p>
              {activeWorkspace?.role ? (
                <p className="text-[11px] capitalize text-sidebar-foreground/50">
                  {activeWorkspace.role}
                </p>
              ) : null}
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground/40" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-[200px]">
            <DropdownMenuGroup>
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
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={openCreateWorkspace}>
              <Plus className="mr-2 h-4 w-4" />
              Create new workspace
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/profile")}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={createOpen} onOpenChange={(next) => !creating && setCreateOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a new workspace</DialogTitle>
            <DialogDescription>
              Workspaces keep proposals, documents, and team members for one client or business unit separate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-workspace-name">Workspace name</Label>
            <Input
              id="new-workspace-name"
              value={createName}
              autoFocus
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && createName.trim()) {
                  e.preventDefault();
                  void submitCreateWorkspace();
                }
              }}
              placeholder="e.g. Meridian Federal Group"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={submitCreateWorkspace}
              disabled={creating || !createName.trim()}
              className="gap-2"
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Create workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
