import { PenTool, Sparkles, Target, CheckCircle2 } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel — hero left side */}
      <aside className="relative hidden flex-col justify-between overflow-hidden gradient-indigo px-12 py-12 text-white lg:flex lg:w-[44%] xl:w-[40%]">
        <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_top_left,white,transparent_60%),radial-gradient(circle_at_bottom_right,white,transparent_50%)]" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <PenTool className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">ProposalPilot</span>
          </div>
        </div>

        <div className="relative space-y-8">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">
              Win more federal contracts.
              <br />
              <span className="text-white/80">In a fraction of the time.</span>
            </h1>
            <p className="mt-4 max-w-md text-white/80">
              Discover RFPs that fit your business, generate compliant drafts
              grounded in your own past performance, and ship proposals your
              evaluators actually want to read.
            </p>
          </div>

          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/15">
                <Target className="h-3 w-3" />
              </span>
              <span className="text-white/90">
                Daily SAM.gov scan scored against your real capabilities and certifications
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/15">
                <Sparkles className="h-3 w-3" />
              </span>
              <span className="text-white/90">
                AI drafts that cite your own docs — never hallucinated boilerplate
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/15">
                <CheckCircle2 className="h-3 w-3" />
              </span>
              <span className="text-white/90">
                Section L/M compliance checks before you submit
              </span>
            </li>
          </ul>
        </div>

        <div className="relative text-xs text-white/60">
          © {new Date().getFullYear()} ProposalPilot · Built on Perplexity
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex flex-1 items-center justify-center bg-background px-6 py-10">
        <div className="w-full max-w-md animate-content-rise">{children}</div>
      </main>
    </div>
  );
}
