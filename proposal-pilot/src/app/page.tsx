import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileSearch, BookOpen, PenTool, CheckCircle, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-indigo">
            <PenTool className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-semibold">ProposalPilot</span>
        </div>
        <div className="flex gap-3">
          <Link href="/login">
            <Button variant="ghost">Log in</Button>
          </Link>
          <Link href="/signup">
            <Button>Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center rounded-full border bg-secondary/50 px-4 py-1.5 text-sm text-muted-foreground">
            AI-native proposal response for GovCon
          </div>
          <h1 className="mb-6 text-5xl font-bold tracking-tight leading-[1.1]">
            Turn dense RFPs into{" "}
            <span className="text-gradient">compliant proposals</span>
            {" "}in hours, not days
          </h1>
          <p className="mb-10 text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            ProposalPilot helps small-to-mid government contractors parse solicitations,
            extract requirements, and generate grounded first-draft proposals with
            citations — all backed by your company&apos;s own evidence.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="gap-2">
                Start Your First Proposal <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="mx-auto mt-24 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: BookOpen,
              title: "Knowledge Base",
              description: "Upload past proposals and company docs. Auto-indexed for retrieval.",
            },
            {
              icon: FileSearch,
              title: "RFP Analyzer",
              description: "Extract every requirement. Build a compliance matrix automatically.",
            },
            {
              icon: PenTool,
              title: "Proposal Drafter",
              description: "Generate grounded drafts with citations and requirement mappings.",
            },
            {
              icon: CheckCircle,
              title: "Compliance Checker",
              description: "Verify coverage before export. Catch gaps the manual process misses.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:border-primary/20"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mb-1.5 font-semibold text-sm">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
