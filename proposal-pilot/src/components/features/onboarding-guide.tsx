"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, X, ArrowRight, UserCircle, BookOpen, Target, FileSearch, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ProgressRing } from "@/components/ui/progress-ring";

interface OnboardingGuideProps {
  hasProfile: boolean;
  hasDocuments: boolean;
  hasOpportunities: boolean;
  hasAnalysis: boolean;
  hasDraft?: boolean;
  onDismiss: () => void;
  /** Preview mode: dismiss closes without persisting to the database */
  preview?: boolean;
}

export function OnboardingGuide({
  hasProfile,
  hasDocuments,
  hasOpportunities,
  hasAnalysis,
  hasDraft = false,
  onDismiss,
  preview = false,
}: OnboardingGuideProps) {
  const [dismissing, setDismissing] = useState(false);

  const steps = [
    {
      title: "Set Up Company Profile",
      description: "Define your capabilities, NAICS codes, and target agencies so the AI scores opportunities accurately.",
      completed: hasProfile,
      href: "/profile",
      icon: UserCircle,
      cta: "Open Profile",
    },
    {
      title: "Upload Company Docs",
      description: "Add past proposals, capability statements, and resumes so the AI can cite real evidence in drafts.",
      completed: hasDocuments,
      href: "/knowledge-base",
      icon: BookOpen,
      cta: "Go to Knowledge Base",
    },
    {
      title: "Discover Opportunities",
      description: "Run the SAM.gov sync to find RFPs that match your profile and capabilities.",
      completed: hasOpportunities,
      href: "/opportunities",
      icon: Target,
      cta: "Find Opportunities",
    },
    {
      title: "Analyze an RFP",
      description: "Upload or select an RFP — the AI extracts all requirements and builds your compliance matrix.",
      completed: hasAnalysis,
      href: "/proposals",
      icon: FileSearch,
      cta: "Upload an RFP",
    },
    {
      title: "Generate & Export",
      description: "Generate a draft from your analyzed RFP, review each section, run compliance, then export to DOCX.",
      completed: hasDraft,
      href: "/drafting",
      icon: Download,
      cta: "Go to Drafting",
    },
  ];

  const completedStepsCount = steps.filter((s) => s.completed).length;
  const progressPercentage = Math.round((completedStepsCount / steps.length) * 100);

  async function handleDismiss() {
    if (preview) {
      onDismiss();
      return;
    }

    setDismissing(true);
    try {
      const response = await fetch("/api/workspace/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ has_completed_onboarding: true }),
      });

      if (!response.ok) throw new Error("Failed to dismiss onboarding");

      onDismiss();
      toast.success("You're all set. The guide won't show again.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to dismiss guide");
      setDismissing(false);
    }
  }

  const nextIncompleteStep = steps.find((s) => !s.completed);

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.06] via-background to-violet/[0.05] shadow-md animate-content-rise">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-primary/10 blur-3xl"
      />
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 z-10 h-8 w-8 text-muted-foreground hover:bg-background/50 hover:text-foreground"
        onClick={handleDismiss}
        disabled={dismissing}
        title={preview ? "Close guide" : "Dismiss this guide"}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Dismiss</span>
      </Button>

      <CardHeader className="relative pb-4">
        <div className="flex items-start gap-5">
          <ProgressRing value={progressPercentage} size={84} stroke={8} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Getting started
              </span>
            </div>
            <CardTitle className="text-xl mt-1.5">
              {progressPercentage === 100
                ? "You&rsquo;re ready to win."
                : "Get to your first proposal"}
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              {progressPercentage === 100
                ? "Every milestone hit. Come back to this guide anytime from the Profile page."
                : `${completedStepsCount} of ${steps.length} steps done — your next step is below.`}
            </CardDescription>

            {nextIncompleteStep ? (
              <div className="mt-3">
                <Link href={nextIncompleteStep.href}>
                  <Button size="sm" className="gap-2">
                    {nextIncompleteStep.cta} <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2 text-sm font-medium text-success">
                <CheckCircle2 className="h-4 w-4" />
                All steps complete.
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isNextAction = !step.completed && (index === 0 || steps[index - 1].completed);

            return (
              <Link key={step.title} href={step.href} className="block group">
                <div
                  className={`relative flex h-full flex-col rounded-lg border p-4 card-lift ${
                    step.completed
                      ? "bg-muted/30 border-muted opacity-70"
                      : isNextAction
                      ? "bg-background border-primary/60 shadow-sm hover:border-primary/80"
                      : "bg-background border-muted hover:border-border"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div
                      className={`rounded-md p-2 ${
                        step.completed
                          ? "bg-muted"
                          : isNextAction
                          ? "bg-primary/10 text-primary"
                          : "bg-muted"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    {step.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-muted-foreground/30 text-[10px] font-bold text-muted-foreground/50">
                        {index + 1}
                      </span>
                    )}
                  </div>

                  <h4
                    className={`text-sm font-semibold mt-1 ${
                      step.completed
                        ? "text-muted-foreground line-through decoration-muted-foreground/40"
                        : ""
                    }`}
                  >
                    {step.title}
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
                    {step.description}
                  </p>

                  {isNextAction && (
                    <div className="mt-auto pt-3 flex items-center text-xs font-medium text-primary group-hover:gap-1.5 transition-all gap-1">
                      {step.cta} <ArrowRight className="h-3 w-3" />
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
