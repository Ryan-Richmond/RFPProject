import { Card, CardContent } from "@/components/ui/card";
import { PenTool, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function DraftingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Drafting</h1>
        <p className="text-muted-foreground text-sm mt-1">
          AI-generated proposal drafts grounded in your company evidence
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <PenTool className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Ready to draft</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            Select a proposal with a completed RFP analysis to generate an
            evidence-grounded first draft. Each section will include citations
            and requirement mappings.
          </p>
          <Link href="/proposals">
            <Button className="gap-2">
              View Proposals <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
