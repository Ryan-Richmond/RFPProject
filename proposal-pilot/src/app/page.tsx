import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle,
  ClipboardCheck,
  Database,
  FileSearch,
  FileText,
  Layers3,
  PenTool,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const agents = [
  {
    icon: BookOpen,
    title: "Knowledge Base Indexer",
    description:
      "Turns past proposals, resumes, certifications, and performance references into tagged, searchable evidence.",
  },
  {
    icon: FileSearch,
    title: "RFP Analyzer",
    description:
      "Extracts requirements, flags ambiguities, scores readiness, and builds the compliance matrix.",
  },
  {
    icon: PenTool,
    title: "Proposal Drafter",
    description:
      "Drafts proposal sections with evidence citations, requirement mappings, and visible placeholders for gaps.",
  },
  {
    icon: CheckCircle,
    title: "Compliance Checker",
    description:
      "Verifies every requirement before export and catches weak responses, missing forms, and format issues.",
  },
];

const stack = [
  { icon: Layers3, label: "Next.js 16" },
  { icon: Database, label: "Supabase pgvector" },
  { icon: Sparkles, label: "Perplexity APIs" },
  { icon: ShieldCheck, label: "Evidence guardrails" },
];

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_0%,oklch(0.93_0.06_74),transparent_32%),radial-gradient(circle_at_88%_8%,oklch(0.9_0.08_220),transparent_30%),linear-gradient(180deg,oklch(0.985_0.002_247),oklch(0.965_0.017_248))]">
      <header className="sticky top-0 z-40 border-b border-white/70 bg-background/80 px-5 py-4 backdrop-blur-xl sm:px-8">
        <nav className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="flex items-center gap-3" aria-label="ProposalPilot home">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground text-background shadow-lg shadow-primary/15">
              <PenTool className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight">ProposalPilot</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "ghost" }), "hidden sm:inline-flex")}
            >
              Log in
            </Link>
            <Link href="/signup" className={cn(buttonVariants(), "h-10 rounded-full px-4")}>
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1fr_0.95fr] lg:pb-28 lg:pt-24">
          <div className="animate-fade-up flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-white/70 px-4 py-2 text-sm font-medium text-primary shadow-sm backdrop-blur">
              <Sparkles className="h-4 w-4" />
              Vercel-ready proposal intelligence for GovCon teams
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.045em] text-foreground sm:text-6xl lg:text-7xl">
              Ship compliant proposals from a living evidence base.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
              ProposalPilot turns RFPs and company documents into requirements,
              compliance matrices, cited first drafts, and review-ready pursuit rooms.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-12 rounded-full px-6 text-base shadow-xl shadow-primary/20"
                )}
              >
                Start a workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-12 rounded-full bg-white/70 px-6 text-base backdrop-blur"
                )}
              >
                Open dashboard
              </Link>
            </div>
            <div className="mt-10 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
              {stack.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/70 bg-white/60 p-3 text-sm font-medium text-foreground shadow-sm backdrop-blur"
                  >
                    <Icon className="mb-2 h-4 w-4 text-primary" />
                    {item.label}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="animate-fade-up relative min-h-[540px]">
            <div className="absolute inset-x-10 top-10 h-72 rounded-full bg-primary/10 blur-3xl" />
            <div className="animate-float-card relative mx-auto max-w-xl rounded-[2rem] border border-white/70 bg-white/75 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur-xl">
              <div className="rounded-[1.5rem] border border-border/70 bg-card p-4">
                <div className="mb-5 flex items-center justify-between border-b pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                      Live pursuit room
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">W911NF-26-R-0042</h2>
                  </div>
                  <div className="rounded-full bg-success/10 px-3 py-1 text-sm font-semibold text-success">
                    92% ready
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Green", "42", "text-success"],
                    ["Yellow", "12", "text-warning"],
                    ["Red", "6", "text-danger"],
                  ].map(([label, value, color]) => (
                    <div key={label} className="rounded-2xl border bg-background p-4">
                      <p className="text-xs text-muted-foreground">{label} requirements</p>
                      <p className={cn("mt-2 text-3xl font-semibold", color)}>{value}</p>
                    </div>
                  ))}
                </div>

                <div className="relative mt-5 overflow-hidden rounded-2xl border bg-slate-950 p-4 text-slate-100">
                  <div className="animate-scan-line absolute left-0 top-0 h-px w-full bg-cyan-300/80" />
                  <div className="mb-4 flex items-center gap-2 text-xs text-cyan-200">
                    <ClipboardCheck className="h-4 w-4" />
                    Compliance matrix generated
                  </div>
                  <div className="space-y-3">
                    {[
                      ["Section L 4.2", "Technical volume, 50 page limit", "REQ-001"],
                      ["Section M", "Technical approach, 40 percent weight", "REQ-002"],
                      ["Section C 3.2.1", "Cybersecurity controls", "REQ-022"],
                    ].map(([section, detail, req]) => (
                      <div
                        key={req}
                        className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
                      >
                        <div>
                          <p className="font-medium">{section}</p>
                          <p className="mt-1 text-xs text-slate-400">{detail}</p>
                        </div>
                        <span className="rounded-full bg-cyan-300/10 px-2 py-1 text-xs text-cyan-200">
                          {req}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-2 left-0 hidden w-56 rounded-3xl border border-white/70 bg-white/80 p-4 shadow-xl shadow-slate-900/10 backdrop-blur lg:block">
              <FileText className="mb-3 h-5 w-5 text-primary" />
              <p className="text-sm font-semibold">Evidence citations required</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Factual claims trace back to approved company evidence or public sources.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
          <div className="mb-10 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">
              Four focused service agents
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
              Built around the actual proposal workflow.
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {agents.map((agent) => {
              const Icon = agent.icon;
              return (
                <article
                  key={agent.title}
                  className="group rounded-[1.75rem] border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10"
                >
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold">{agent.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {agent.description}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
