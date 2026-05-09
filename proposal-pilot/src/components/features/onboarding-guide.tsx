"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, X, ArrowRight, UserCircle, BookOpen, Target, FileSearch } from "lucide-react";
import { toast } from "sonner";

interface OnboardingGuideProps {
  hasProfile: boolean;
  hasDocuments: boolean;
  hasOpportunities: boolean;
  hasAnalysis: boolean;
  onDismiss: () => void;
}

export function OnboardingGuide({
  hasProfile,
  hasDocuments,
  hasOpportunities,
  hasAnalysis,
  onDismiss,
}: OnboardingGuideProps) {
  const [dismissing, setDismissing] = useState(false);

  const steps = [
    {
      title: "Complete Your Profile",
      description: "Define your capabilities and target agencies to get accurate opportunity scores.",
      completed: hasProfile,
      href: "/profile",
      icon: UserCircle,
    },
    {
      title: "Upload Company Docs",
      description: "Add past proposals and capability statements to your AI knowledge base.",
      completed: hasDocuments,
      href: "/knowledge-base",
      icon: BookOpen,
    },
    {
      title: "Discover Opportunities",
      description: "Run the SAM.gov sync to find RFPs that match your profile.",
      completed: hasOpportunities,
      href: "/opportunities",
      icon: Target,
    },
    {
      title: "Analyze an RFP",
      description: "Extract requirements and generate a compliance matrix.",
      completed: hasAnalysis,
      href: "/proposals",
      icon: FileSearch,
    },
  ];

  const completedStepsCount = steps.filter((s) => s.completed).length;
  const progressPercentage = (completedStepsCount / steps.length) * 100;

  async function handleDismiss() {
    setDismissing(true);
    try {
      const response = await fetch("/api/workspace/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ has_completed_onboarding: true }),
      });

      if (!response.ok) throw new Error("Failed to dismiss onboarding");

      onDismiss();
      toast.success("Onboarding guide dismissed.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to dismiss guide");
      setDismissing(false);
    }
  }

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-background to-primary/5 shadow-md">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:bg-background/50 hover:text-foreground"
        onClick={handleDismiss}
        disabled={dismissing}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Dismiss</span>
      </Button>

      <CardHeader className="pb-4">
        <CardTitle className="text-xl">Welcome to ProposalPilot</CardTitle>
        <CardDescription className="text-sm">
          Let&apos;s get your workspace set up so you can start generating winning proposals.
        </CardDescription>
        
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/50">
            <div
              className="h-full bg-primary transition-all duration-500 ease-in-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {completedStepsCount} of {steps.length} completed
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isNextAction = !step.completed && (index === 0 || steps[index - 1].completed);

            return (
              <Link key={step.title} href={step.href} className="block group">
                <div
                  className={`relative flex h-full flex-col rounded-lg border p-4 transition-all ${
                    step.completed
                      ? "bg-muted/30 border-muted opacity-80"
                      : isNextAction
                      ? "bg-background border-primary shadow-sm hover:border-primary/80"
                      : "bg-background border-muted hover:border-border"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className={`rounded-md p-2 ${step.completed ? "bg-muted" : isNextAction ? "bg-primary/10 text-primary" : "bg-muted"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    {step.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/30" />
                    )}
                  </div>
                  
                  <h4 className={`text-sm font-semibold mt-1 ${step.completed ? "text-muted-foreground line-through decoration-muted-foreground/50" : ""}`}>
                    {step.title}
                  </h4>
                  <p className={`mt-1 text-xs line-clamp-2 ${step.completed ? "text-muted-foreground" : "text-muted-foreground"}`}>
                    {step.description}
                  </p>
                  
                  {isNextAction && (
                    <div className="mt-auto pt-3 flex items-center text-xs font-medium text-primary">
                      Get Started <ArrowRight className="ml-1 h-3 w-3" />
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
