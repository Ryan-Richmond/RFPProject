"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Building2,
  CheckCircle,
  Cpu,
  FileSearch,
  LayoutDashboard,
  PenTool,
  Search,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type CommandKind = "navigation" | "action" | "workspace";

interface Command {
  id: string;
  label: string;
  hint?: string;
  kind: CommandKind;
  icon?: React.ComponentType<{ className?: string }>;
  keywords?: string[];
  shortcut?: string;
  run: () => void | Promise<void>;
}

interface WorkspaceOption {
  workspaceId: string;
  workspaceName: string;
  role: string;
}

function groupCommands(commands: Command[]): Map<CommandKind, Command[]> {
  const map = new Map<CommandKind, Command[]>();
  for (const cmd of commands) {
    const existing = map.get(cmd.kind) || [];
    existing.push(cmd);
    map.set(cmd.kind, existing);
  }
  return map;
}

const KIND_LABEL: Record<CommandKind, string> = {
  navigation: "Navigation",
  action: "Quick Actions",
  workspace: "Workspaces",
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Cmd+K / Ctrl+K to toggle, plus G-letter chord shortcuts (g o, g p, ...)
  useEffect(() => {
    // Chord state: after pressing "g" alone (not in an input), we wait ~1.2s
    // for the next key to navigate.
    let gPendingUntil = 0;
    let gToastEl: HTMLDivElement | null = null;
    const CHORD_WINDOW_MS = 1200;

    const chordMap: Record<string, string> = {
      w: "/workspace",
      o: "/opportunities",
      k: "/knowledge-base",
      r: "/proposals",
      d: "/drafting",
      c: "/compliance",
      p: "/profile",
      t: "/team",
    };

    function clearGToast() {
      if (gToastEl) {
        gToastEl.remove();
        gToastEl = null;
      }
    }

    function showGToast() {
      clearGToast();
      const el = document.createElement("div");
      el.setAttribute("aria-hidden", "true");
      el.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--popover);
        color: var(--popover-foreground);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 8px 14px;
        font-size: 12px;
        font-family: var(--font-sans);
        box-shadow: 0 12px 32px -16px oklch(0 0 0 / 30%);
        z-index: 9998;
        opacity: 0;
        transition: opacity 120ms ease-out;
      `;
      el.innerHTML = `Press <kbd class="kbd">O</kbd>, <kbd class="kbd">K</kbd>, <kbd class="kbd">P</kbd>… to navigate`;
      document.body.appendChild(el);
      requestAnimationFrame(() => (el.style.opacity = "1"));
      gToastEl = el;
    }

    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (target.isContentEditable) return true;
      return false;
    }

    function handler(e: KeyboardEvent) {
      const isModK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isModK) {
        e.preventDefault();
        gPendingUntil = 0;
        clearGToast();
        setOpen((prev) => !prev);
        return;
      }

      if (e.key === "Escape" && open) {
        setOpen(false);
        return;
      }

      // Don't intercept typing in inputs.
      if (isTypingTarget(e.target)) return;
      // Don't intercept while the palette or any dialog is open.
      if (open) return;
      // Modifier-bearing keystrokes are reserved for OS / browser.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      // Inside the chord window — try to resolve the second key.
      if (gPendingUntil > Date.now()) {
        gPendingUntil = 0;
        clearGToast();
        const dest = chordMap[key];
        if (dest) {
          e.preventDefault();
          router.push(dest);
        }
        return;
      }

      // Start a chord — only "g" pressed alone.
      if (key === "g") {
        e.preventDefault();
        gPendingUntil = Date.now() + CHORD_WINDOW_MS;
        showGToast();
        window.setTimeout(() => {
          if (gPendingUntil <= Date.now()) clearGToast();
        }, CHORD_WINDOW_MS + 50);
      }
    }

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      clearGToast();
    };
  }, [open, router]);

  // Load workspaces on first open
  useEffect(() => {
    if (!open || workspaces.length > 0) return;
    let cancelled = false;
    fetch("/api/workspaces")
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (cancelled || !payload) return;
        setWorkspaces(payload.workspaces || []);
        setActiveWorkspaceId(payload.activeWorkspaceId || null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, workspaces.length]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlightedIndex(0);
      // focus on next tick after Dialog mounts
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  function go(path: string) {
    setOpen(false);
    router.push(path);
  }

  async function runDiscovery() {
    setOpen(false);
    try {
      const res = await fetch("/api/opportunities/discover", { method: "POST" });
      if (res.ok) {
        const { toast } = await import("sonner");
        const data = await res.json().catch(() => ({}));
        toast.success(
          `Discovery complete: ${data.opportunitiesCreated || 0} new opportunities.`
        );
        if (typeof window !== "undefined") {
          window.location.assign("/opportunities");
        }
      } else {
        const { toast } = await import("sonner");
        toast.error("Discovery failed. Check that your profile is complete.");
      }
    } catch {
      const { toast } = await import("sonner");
      toast.error("Discovery failed.");
    }
  }

  async function switchWorkspace(workspaceId: string) {
    setOpen(false);
    if (workspaceId === activeWorkspaceId) return;
    const res = await fetch("/api/workspaces", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });
    if (res.ok) {
      window.location.assign("/workspace");
    }
  }

  const allCommands = useMemo<Command[]>(() => {
    const nav: Command[] = [
      { id: "nav-workspace", label: "Go to Workspace", kind: "navigation", icon: LayoutDashboard, keywords: ["dashboard", "home"], shortcut: "G W", run: () => go("/workspace") },
      { id: "nav-opps", label: "Go to Opportunities", kind: "navigation", icon: Target, keywords: ["rfp", "pipeline"], shortcut: "G O", run: () => go("/opportunities") },
      { id: "nav-kb", label: "Go to Knowledge Base", kind: "navigation", icon: BookOpen, keywords: ["documents", "uploads"], shortcut: "G K", run: () => go("/knowledge-base") },
      { id: "nav-proposals", label: "Go to RFP Analysis", kind: "navigation", icon: FileSearch, keywords: ["proposals"], shortcut: "G R", run: () => go("/proposals") },
      { id: "nav-drafting", label: "Go to Drafting", kind: "navigation", icon: PenTool, shortcut: "G D", run: () => go("/drafting") },
      { id: "nav-compliance", label: "Go to Compliance", kind: "navigation", icon: CheckCircle, shortcut: "G C", run: () => go("/compliance") },
      { id: "nav-profile", label: "Go to Company Profile", kind: "navigation", icon: Building2, shortcut: "G P", run: () => go("/profile") },
      { id: "nav-team", label: "Go to Team", kind: "navigation", icon: Users, run: () => go("/team") },
      { id: "nav-ops", label: "Go to Computer Ops", kind: "navigation", icon: Cpu, run: () => go("/computer-ops") },
    ];

    const actions: Command[] = [
      { id: "act-discovery", label: "Run Discovery", hint: "Search SAM.gov for new opportunities", kind: "action", icon: Search, keywords: ["search", "sam", "scan"], run: runDiscovery },
      { id: "act-new-proposal", label: "Start New Proposal", kind: "action", icon: PenTool, run: () => go("/proposals") },
      { id: "act-upload", label: "Upload Company Documents", kind: "action", icon: BookOpen, run: () => go("/knowledge-base") },
      { id: "act-profile", label: "Edit Company Profile", kind: "action", icon: Building2, run: () => go("/profile") },
    ];

    const ws: Command[] = workspaces.map((w) => ({
      id: `ws-${w.workspaceId}`,
      label: w.workspaceName,
      hint: w.workspaceId === activeWorkspaceId ? "Active" : `Switch — ${w.role}`,
      kind: "workspace",
      icon: Sparkles,
      run: () => switchWorkspace(w.workspaceId),
    }));

    return [...nav, ...actions, ...ws];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaces, activeWorkspaceId]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allCommands;
    const q = query.toLowerCase();
    return allCommands.filter((c) => {
      const haystack = [c.label, c.hint || "", ...(c.keywords || [])]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [allCommands, query]);

  // Reset highlight when filter changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  // Scroll highlighted into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-cmd-index="${highlightedIndex}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[highlightedIndex];
      if (cmd) cmd.run();
    }
  }

  const grouped = groupCommands(filtered);
  const order: CommandKind[] = ["action", "navigation", "workspace"];
  let flatIndex = 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 gap-0 max-w-xl overflow-hidden">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search or run a command…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="kbd">ESC</kbd>
        </div>

        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto p-2"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No matches. Try &ldquo;discovery&rdquo;, &ldquo;profile&rdquo;, or a page name.
            </div>
          ) : (
            order.map((kind) => {
              const items = grouped.get(kind);
              if (!items?.length) return null;
              return (
                <div key={kind} className="mb-2 last:mb-0">
                  <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    {KIND_LABEL[kind]}
                  </p>
                  <div>
                    {items.map((cmd) => {
                      const Icon = cmd.icon;
                      const myIndex = flatIndex++;
                      const isActive = myIndex === highlightedIndex;
                      return (
                        <button
                          key={cmd.id}
                          type="button"
                          data-cmd-index={myIndex}
                          onMouseEnter={() => setHighlightedIndex(myIndex)}
                          onClick={() => cmd.run()}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                            isActive
                              ? "bg-primary/10 text-foreground"
                              : "text-foreground/90 hover:bg-muted"
                          )}
                        >
                          {Icon && (
                            <Icon
                              className={cn(
                                "h-4 w-4 shrink-0",
                                isActive ? "text-primary" : "text-muted-foreground"
                              )}
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{cmd.label}</p>
                            {cmd.hint && (
                              <p className="truncate text-xs text-muted-foreground">
                                {cmd.hint}
                              </p>
                            )}
                          </div>
                          {cmd.shortcut && (
                            <span className="flex items-center gap-1">
                              {cmd.shortcut.split(" ").map((k) => (
                                <kbd key={k} className="kbd">
                                  {k}
                                </kbd>
                              ))}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <kbd className="kbd">↑</kbd>
            <kbd className="kbd">↓</kbd>
            <span>navigate</span>
            <kbd className="kbd">↵</kbd>
            <span>select</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="kbd">⌘</kbd>
            <kbd className="kbd">K</kbd>
            <span>to open</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
