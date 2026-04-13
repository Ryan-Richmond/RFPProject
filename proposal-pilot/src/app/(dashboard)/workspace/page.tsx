import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  FileSearch,
  Upload,
  ArrowRight,
  FolderOpen,
  Clock,
} from "lucide-react";
import { PipelineStepper } from "@/components/features/pipeline-stepper";

export default function WorkspacePage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workspace</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your proposal command center
          </p>
        </div>
        <Link href="/proposals">
          <Button className="gap-2">
            <Upload className="h-4 w-4" /> New Proposal
          </Button>
        </Link>
      </div>

      {/* Pipeline overview */}
      <PipelineStepper
        stages={{
          indexed: "completed",
          analyzed: "active",
          drafted: "pending",
          compliant: "pending",
        }}
      />

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/knowledge-base">
          <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/20">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">Upload Company Docs</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Past proposals, resumes, capability statements
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-1" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/proposals">
          <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/20">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
                <FileSearch className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">Upload an RFP</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Start analyzing a new solicitation
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-1" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/proposals">
          <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/20">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
                <FolderOpen className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">View Proposals</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Manage your active proposal pipeline
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-1" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Proposals", value: "0", icon: FolderOpen },
          { label: "Documents Indexed", value: "0", icon: BookOpen },
          { label: "Requirements Tracked", value: "0", icon: FileSearch },
          { label: "Avg. Time Saved", value: "—", icon: Clock },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No activity yet. Upload company docs or an RFP to get started.
            </p>
            <Link href="/knowledge-base" className="mt-3">
              <Button variant="outline" size="sm" className="gap-2">
                <Upload className="h-3.5 w-3.5" /> Upload Documents
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
