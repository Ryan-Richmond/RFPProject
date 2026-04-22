"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Loader2, RefreshCw, Shield, UserPlus, Users, X } from "lucide-react";

interface TeamMember {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  member_email?: string | null;
  created_at: string;
}

interface TeamInvite {
  id: string;
  email?: string | null;
  role: "admin" | "member";
  code: string;
  expires_at: string;
  used_at?: string | null;
  revoked_at?: string | null;
  created_at: string;
}

interface TeamPayload {
  workspace?: { id: string; name: string } | null;
  currentUserRole: "owner" | "admin" | "member" | null;
  members: TeamMember[];
  invites: TeamInvite[];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getInviteStatus(invite: TeamInvite) {
  if (invite.revoked_at) return "revoked";
  if (invite.used_at) return "used";
  if (new Date(invite.expires_at).getTime() < Date.now()) return "expired";
  return "active";
}

export default function TeamPage() {
  const [payload, setPayload] = useState<TeamPayload | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const canInvite = payload?.currentUserRole === "owner" || payload?.currentUserRole === "admin";
  const activeInvites = useMemo(
    () => (payload?.invites || []).filter((invite) => getInviteStatus(invite) === "active"),
    [payload]
  );

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/team");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load team");
      }

      setPayload(data);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  async function createInvite() {
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() || null, role }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create invite");
      }

      setEmail("");
      setRole("member");
      await fetchTeam();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create invite");
    } finally {
      setCreating(false);
    }
  }

  async function revokeInvite(inviteId: string) {
    setError(null);
    const response = await fetch(`/api/team?id=${inviteId}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || "Failed to revoke invite");
      return;
    }
    await fetchTeam();
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Invite teammates into the same proposal workspace
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTeam} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4" />
            Create Invite
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canInvite ? (
            <>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="teammate@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <div className="flex rounded-lg border p-1">
                    {(["member", "admin"] as const).map((option) => (
                      <Button
                        key={option}
                        type="button"
                        size="sm"
                        variant={role === option ? "default" : "ghost"}
                        onClick={() => setRole(option)}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <Button onClick={createInvite} disabled={creating} className="gap-2">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Generate Invite Code
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ask a workspace owner or admin to create invite codes.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading members...
              </div>
            ) : payload?.members.length ? (
              <div className="space-y-2">
                {payload.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {member.member_email || member.user_id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Joined {formatDate(member.created_at)}
                      </p>
                    </div>
                    <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                      {member.role}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No members found.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              Invite Codes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeInvites.length ? (
              <div className="space-y-2">
                {activeInvites.map((invite) => (
                  <div key={invite.id} className="rounded-lg border px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold">{invite.code}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {invite.email || "Any email"} · {invite.role} · Expires {formatDate(invite.expires_at)}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => copyCode(invite.code)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => revokeInvite(invite.id)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {copiedCode === invite.code ? (
                      <p className="mt-1 text-xs text-primary">Copied</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No active invite codes.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
