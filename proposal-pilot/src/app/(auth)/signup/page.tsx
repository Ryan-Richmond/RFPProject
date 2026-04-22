"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PenTool, Loader2 } from "lucide-react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const normalizedInviteCode = inviteCode.trim().toUpperCase();

    // 1. Create the user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          workspace_name: workspaceName,
          invite_code: normalizedInviteCode || undefined,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (!authData.user) {
      setError("Failed to create account. Please try again.");
      setLoading(false);
      return;
    }

    if (normalizedInviteCode) {
      await supabase
        .rpc("redeem_workspace_invite", { invite_code: normalizedInviteCode })
        .then(({ error: inviteError }) => {
          if (inviteError) {
            console.warn("Invite redemption will complete after confirmation:", inviteError);
          }
        });
    } else {
      // 2. Create the workspace for the first user.
      const { error: wsError } = await supabase.from("workspaces").insert({
        name: workspaceName,
        owner_id: authData.user.id,
      });

      if (wsError) {
        console.error("Workspace creation error:", wsError);
        // User is created but workspace failed — they can create it later
      } else {
        await supabase
          .from("workspace_members")
          .update({ member_email: email.trim().toLowerCase() })
          .eq("user_id", authData.user.id);
      }
    }

    router.push("/workspace");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl gradient-indigo">
          <PenTool className="h-6 w-6 text-white" />
        </div>
        <CardTitle className="text-2xl">Create your workspace</CardTitle>
        <CardDescription>
          Set up your ProposalPilot account to start winning proposals
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Workspace Name</Label>
            <Input
              id="workspace-name"
              type="text"
              placeholder="Acme Federal Solutions"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              required={!inviteCode.trim()}
              disabled={Boolean(inviteCode.trim())}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-code">Invite Code</Label>
            <Input
              id="invite-code"
              type="text"
              placeholder="PP-1234ABCD"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            />
            <p className="text-xs text-muted-foreground">
              Use this only if a teammate invited you to an existing workspace.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Workspace
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
