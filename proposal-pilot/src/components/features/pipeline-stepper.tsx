"use client";

import { cn } from "@/lib/utils";
import { BookOpen, FileSearch, PenTool, CheckCircle, Check } from "lucide-react";

export type PipelineStage = "indexed" | "analyzed" | "drafted" | "compliant";

export type StageStatus = "completed" | "active" | "pending";

interface PipelineStepperProps {
  /** Map of stage to status. Defaults to all pending. */
  stages?: Record<PipelineStage, StageStatus>;
}

const stageConfig: {
  id: PipelineStage;
  label: string;
  icon: typeof BookOpen;
}[] = [
  { id: "indexed", label: "Knowledge Indexed", icon: BookOpen },
  { id: "analyzed", label: "RFP Analyzed", icon: FileSearch },
  { id: "drafted", label: "Draft Ready", icon: PenTool },
  { id: "compliant", label: "Compliance Passed", icon: CheckCircle },
];

const defaultStages: Record<PipelineStage, StageStatus> = {
  indexed: "pending",
  analyzed: "pending",
  drafted: "pending",
  compliant: "pending",
};

export function PipelineStepper({ stages = defaultStages }: PipelineStepperProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-card px-6 py-4">
      {stageConfig.map((stage, index) => {
        const status = stages[stage.id];
        const Icon = stage.icon;

        return (
          <div key={stage.id} className="flex items-center">
            {/* Stage node */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full transition-all",
                  status === "completed" &&
                    "bg-success text-white",
                  status === "active" &&
                    "bg-primary text-white animate-pulse-indigo",
                  status === "pending" &&
                    "border-2 border-muted-foreground/30 text-muted-foreground/40"
                )}
              >
                {status === "completed" ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  status === "completed" && "text-success",
                  status === "active" && "text-primary font-semibold",
                  status === "pending" && "text-muted-foreground/50"
                )}
              >
                {stage.label}
              </span>
            </div>

            {/* Connector line */}
            {index < stageConfig.length - 1 && (
              <div
                className={cn(
                  "mx-4 h-[2px] w-16 rounded-full transition-all",
                  stages[stageConfig[index + 1].id] !== "pending" ||
                    status === "completed"
                    ? "bg-success"
                    : status === "active"
                    ? "bg-gradient-to-r from-primary to-muted-foreground/20"
                    : "bg-muted-foreground/15"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
