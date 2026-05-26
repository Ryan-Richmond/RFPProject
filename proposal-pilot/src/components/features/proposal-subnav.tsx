"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle, FileSearch, PenTool } from "lucide-react";
import { cn } from "@/lib/utils";

const proposalNavItems = [
  { label: "Workflows", href: "/proposals", icon: FileSearch },
  { label: "Drafting", href: "/drafting", icon: PenTool },
  { label: "Compliance", href: "/compliance", icon: CheckCircle },
];

export function ProposalSubnav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1" aria-label="Proposal workflow">
      {proposalNavItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
            )}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
