import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function CompliancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compliance</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Verify every requirement is addressed before export
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <CheckCircle className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Compliance Checker</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            After your draft is reviewed, run the compliance checker to get a
            requirement-by-requirement coverage assessment, format checks, and
            an overall compliance score.
          </p>
          <Link href="/proposals">
            <Button variant="outline" className="gap-2">
              View Proposals <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
