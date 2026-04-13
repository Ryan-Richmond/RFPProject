import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PipelineStepper } from "@/components/features/pipeline-stepper";
import {
  FileText,
  FileSearch,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  AlertCircle,
  Download,
} from "lucide-react";

// Demo data for the 3-column view
const demoRequirements = [
  {
    id: "REQ-001",
    category: "technical",
    text: "Contractor shall provide cloud migration services using FedRAMP-authorized platforms.",
    section_ref: "Section C, para 3.2.1",
    readiness: "green" as const,
  },
  {
    id: "REQ-002",
    category: "technical",
    text: "System shall support 99.9% uptime SLA for all production environments.",
    section_ref: "Section C, para 3.2.3",
    readiness: "green" as const,
  },
  {
    id: "REQ-003",
    category: "management",
    text: "Contractor shall provide a dedicated Program Manager with PMP certification.",
    section_ref: "Section C, para 4.1",
    readiness: "yellow" as const,
  },
  {
    id: "REQ-004",
    category: "past_performance",
    text: "Offeror shall demonstrate 3 relevant past performance references within the last 5 years.",
    section_ref: "Section L, para 5.3",
    readiness: "green" as const,
  },
  {
    id: "REQ-005",
    category: "compliance",
    text: "Contractor must hold an active Top Secret facility clearance.",
    section_ref: "Section H, para 2.1",
    readiness: "red" as const,
  },
  {
    id: "REQ-006",
    category: "pricing",
    text: "Pricing shall be submitted as a firm-fixed-price for CLIN 0001 through 0004.",
    section_ref: "Section B, para 1.2",
    readiness: "yellow" as const,
  },
];

const demoDocuments = [
  { name: "RFP_W911NF-26-R-0042.pdf", pages: 78, uploaded: "2h ago" },
  { name: "Amendment_001.pdf", pages: 12, uploaded: "1h ago" },
  { name: "Attachments_SOW.pdf", pages: 34, uploaded: "2h ago" },
];

function readinessDot(readiness: "green" | "yellow" | "red") {
  const colors = {
    green: "bg-success",
    yellow: "bg-warning",
    red: "bg-danger",
  };
  const labels = {
    green: "Ready",
    yellow: "Partial",
    red: "Gap",
  };
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors[readiness]}`} />
      <span className="text-xs text-muted-foreground">{labels[readiness]}</span>
    </div>
  );
}

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            NASA SEWP VI — IT Modernization Services
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">
              Federal
            </Badge>
            <span className="text-xs text-muted-foreground">
              W911NF-26-R-0042
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">Due June 15, 2026</span>
          </div>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export to Word
        </Button>
      </div>

      {/* Pipeline */}
      <PipelineStepper
        stages={{
          indexed: "completed",
          analyzed: "completed",
          drafted: "active",
          compliant: "pending",
        }}
      />

      {/* Tabs for different views */}
      <Tabs defaultValue="analysis" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        {/* Analysis View — 3-column layout */}
        <TabsContent value="analysis" className="space-y-0">
          <div className="grid grid-cols-12 gap-4">
            {/* Left Column: Source Documents */}
            <div className="col-span-3 space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground px-1">
                Source Documents
              </h3>
              {demoDocuments.map((doc) => (
                <Card
                  key={doc.name}
                  className="cursor-pointer transition-all hover:shadow-sm hover:border-primary/20"
                >
                  <CardContent className="flex items-start gap-3 p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 shrink-0">
                      <FileText className="h-4 w-4 text-destructive/70" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.pages} pages • {doc.uploaded}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Center Column: Requirements */}
            <div className="col-span-5 space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Extracted Requirements
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {demoRequirements.length} found
                </Badge>
              </div>
              {demoRequirements.map((req) => (
                <Card
                  key={req.id}
                  className="transition-all hover:shadow-sm hover:border-primary/10"
                >
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono px-1.5">
                          {req.id}
                        </Badge>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {req.category.replace("_", " ")}
                        </Badge>
                      </div>
                      {readinessDot(req.readiness)}
                    </div>
                    <p className="text-sm leading-relaxed">{req.text}</p>
                    <p className="text-xs text-muted-foreground">{req.section_ref}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Right Column: Compliance Matrix */}
            <div className="col-span-4 space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground px-1">
                Compliance Matrix
              </h3>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Requirement</TableHead>
                        <TableHead className="text-xs text-center">Readiness</TableHead>
                        <TableHead className="text-xs text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {demoRequirements.map((req) => (
                        <TableRow key={req.id} className="text-xs">
                          <TableCell className="font-mono text-xs py-2.5">
                            {req.id}
                          </TableCell>
                          <TableCell className="text-center py-2.5">
                            <span
                              className={`inline-block h-2.5 w-2.5 rounded-full ${
                                req.readiness === "green"
                                  ? "bg-success"
                                  : req.readiness === "yellow"
                                  ? "bg-warning"
                                  : "bg-danger"
                              }`}
                            />
                          </TableCell>
                          <TableCell className="text-right py-2.5">
                            <Badge
                              variant="secondary"
                              className={`text-xs ${
                                req.readiness === "green"
                                  ? "bg-success/10 text-success"
                                  : req.readiness === "yellow"
                                  ? "bg-warning/10 text-warning"
                                  : "bg-danger/10 text-danger"
                              }`}
                            >
                              {req.readiness === "green"
                                ? "Ready"
                                : req.readiness === "yellow"
                                ? "Partial"
                                : "Gap"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Readiness Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Readiness Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span className="text-sm">Ready</span>
                    </div>
                    <span className="text-sm font-semibold">3</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-warning" />
                      <span className="text-sm">Partial Match</span>
                    </div>
                    <span className="text-sm font-semibold">2</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-danger" />
                      <span className="text-sm">Gap</span>
                    </div>
                    <span className="text-sm font-semibold">1</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Draft View */}
        <TabsContent value="draft">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <CircleDashed className="h-5 w-5 text-primary animate-spin" />
              </div>
              <p className="text-sm font-medium">Draft generation in progress</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                ProposalPilot is generating a first draft based on your requirements
                and company evidence.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance View */}
        <TabsContent value="compliance">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <FileSearch className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Compliance check available after draft review
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                Complete your draft and run the compliance checker to verify
                requirement coverage before export.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
