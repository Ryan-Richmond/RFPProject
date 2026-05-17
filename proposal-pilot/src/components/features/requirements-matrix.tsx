"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  Search,
  ShieldQuestion,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type MatchStatus = "suggested" | "confirmed" | "overridden" | "rejected";
type Confidence = "strong" | "partial" | "weak" | "none";
type Readiness = "green" | "yellow" | "red";

export interface RequirementMatch {
  id: string;
  requirement_id: string;
  evidence_chunk_id: string;
  similarity_score: number;
  llm_confidence: Confidence | null;
  llm_justification: string | null;
  status: MatchStatus;
  updated_at: string;
  evidence_chunk: {
    id: string;
    content: string;
    category: string;
    source_document_name: string | null;
  } | null;
}

export interface MatrixRequirement {
  id: string;
  requirement_id: string;
  category: string;
  text: string;
  section_ref?: string | null;
  evaluation_weight?: "high" | "medium" | "low" | null;
  readiness_score?: Readiness | null;
}

export interface MatrixDraftSection {
  id: string;
  title: string;
  content: string;
  requirement_mappings: string[] | null;
}

interface Props {
  proposalId: string;
  requirements: MatrixRequirement[];
  matches: RequirementMatch[];
  draftSections: MatrixDraftSection[];
  onRefresh: () => void;
}

type FilterValue =
  | "all"
  | "strong"
  | "partial"
  | "weak"
  | "no-match"
  | "unconfirmed";

const FILTERS: Array<{ value: FilterValue; label: string }> = [
  { value: "all", label: "All" },
  { value: "strong", label: "Strong" },
  { value: "partial", label: "Partial" },
  { value: "weak", label: "Weak" },
  { value: "no-match", label: "No match" },
  { value: "unconfirmed", label: "Unconfirmed" },
];

export function RequirementsMatrix({
  proposalId,
  requirements,
  matches,
  draftSections,
  onRefresh,
}: Props) {
  const [filter, setFilter] = useState<FilterValue>("all");
  const [search, setSearch] = useState("");
  const [openRequirementId, setOpenRequirementId] = useState<string | null>(null);
  const [updatingMatchId, setUpdatingMatchId] = useState<string | null>(null);

  const matchesByRequirementId = useMemo(() => {
    const map = new Map<string, RequirementMatch[]>();
    for (const m of matches) {
      const list = map.get(m.requirement_id) || [];
      list.push(m);
      map.set(m.requirement_id, list);
    }
    return map;
  }, [matches]);

  const sectionTitleByReqRef = useMemo(() => {
    const map = new Map<string, string>();
    for (const section of draftSections) {
      for (const reqRef of section.requirement_mappings || []) {
        if (!map.has(reqRef)) {
          map.set(reqRef, section.title);
        }
      }
    }
    return map;
  }, [draftSections]);

  const rows = useMemo(() => {
    return requirements.map((req) => {
      const reqMatches = (matchesByRequirementId.get(req.id) || []).slice().sort(
        (a, b) => b.similarity_score - a.similarity_score
      );
      const preferred =
        reqMatches.find((m) => m.status === "confirmed" || m.status === "overridden") ||
        reqMatches[0] ||
        null;
      const draftSection = sectionTitleByReqRef.get(req.requirement_id) || null;
      return { req, matches: reqMatches, preferred, draftSection };
    });
  }, [requirements, matchesByRequirementId, sectionTitleByReqRef]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(({ req, preferred, matches: reqMatches }) => {
      if (term) {
        const haystack = [
          req.requirement_id,
          req.text,
          req.category,
          req.section_ref || "",
          preferred?.evidence_chunk?.source_document_name || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      switch (filter) {
        case "all":
          return true;
        case "strong":
          return reqMatches.some((m) => m.llm_confidence === "strong");
        case "partial":
          return reqMatches.some((m) => m.llm_confidence === "partial");
        case "weak":
          return (
            reqMatches.length > 0 &&
            reqMatches.every(
              (m) => m.llm_confidence === "weak" || m.llm_confidence === "none"
            )
          );
        case "no-match":
          return reqMatches.length === 0;
        case "unconfirmed":
          return reqMatches.length > 0 && reqMatches.every((m) => m.status === "suggested");
      }
    });
  }, [rows, filter, search]);

  const counts = useMemo(() => {
    return {
      all: rows.length,
      strong: rows.filter((r) =>
        r.matches.some((m) => m.llm_confidence === "strong")
      ).length,
      partial: rows.filter((r) =>
        r.matches.some((m) => m.llm_confidence === "partial")
      ).length,
      weak: rows.filter(
        (r) =>
          r.matches.length > 0 &&
          r.matches.every(
            (m) => m.llm_confidence === "weak" || m.llm_confidence === "none"
          )
      ).length,
      noMatch: rows.filter((r) => r.matches.length === 0).length,
      unconfirmed: rows.filter(
        (r) => r.matches.length > 0 && r.matches.every((m) => m.status === "suggested")
      ).length,
      confirmed: rows.filter((r) =>
        r.matches.some((m) => m.status === "confirmed" || m.status === "overridden")
      ).length,
    };
  }, [rows]);

  const openRow = openRequirementId
    ? rows.find((r) => r.req.id === openRequirementId) || null
    : null;

  async function updateMatchStatus(matchId: string, status: MatchStatus) {
    setUpdatingMatchId(matchId);
    try {
      const res = await fetch(
        `/api/proposals/${proposalId}/requirement-matches/${matchId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update match");
      }
      toast.success(
        status === "confirmed"
          ? "Match confirmed"
          : status === "rejected"
          ? "Match rejected"
          : status === "overridden"
          ? "Override saved"
          : "Match status updated"
      );
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setUpdatingMatchId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-sm">Requirements Matrix</CardTitle>
            <p className="text-xs text-muted-foreground">
              Each RFP requirement mapped to your strongest capability evidence and the
              draft section addressing it.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            render={
              <a
                href={`/api/proposals/${proposalId}/requirements-matrix.csv`}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => {
              const count =
                f.value === "all"
                  ? counts.all
                  : f.value === "strong"
                  ? counts.strong
                  : f.value === "partial"
                  ? counts.partial
                  : f.value === "weak"
                  ? counts.weak
                  : f.value === "no-match"
                  ? counts.noMatch
                  : counts.unconfirmed;
              return (
                <Button
                  key={f.value}
                  variant={filter === f.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(f.value)}
                >
                  {f.label}
                  <Badge
                    variant="secondary"
                    className="ml-2 px-1.5 py-0 text-[10px]"
                  >
                    {count}
                  </Badge>
                </Button>
              );
            })}
            <div className="ml-auto flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search requirements"
                className="h-8 w-56"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {requirements.length === 0
                  ? "Analyze the RFP to extract requirements and build the matrix."
                  : "No requirements match the current filter."}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Req</th>
                    <th className="px-3 py-2 text-left font-medium">Requirement</th>
                    <th className="px-3 py-2 text-left font-medium">RFP §</th>
                    <th className="px-3 py-2 text-left font-medium">Top Match</th>
                    <th className="px-3 py-2 text-left font-medium">Confidence</th>
                    <th className="px-3 py-2 text-left font-medium">Draft Section</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(({ req, preferred, draftSection }) => (
                    <tr
                      key={req.id}
                      className="cursor-pointer border-t transition hover:bg-muted/40"
                      onClick={() => setOpenRequirementId(req.id)}
                    >
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="w-fit font-mono text-[11px]">
                            {req.requirement_id}
                          </Badge>
                          <Badge variant="secondary" className="w-fit text-[10px] capitalize">
                            {req.category.replace("_", " ")}
                          </Badge>
                        </div>
                      </td>
                      <td className="max-w-[380px] px-3 py-2 align-top">
                        <p className="line-clamp-2 leading-relaxed">{req.text}</p>
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                        {req.section_ref || "—"}
                      </td>
                      <td className="px-3 py-2 align-top text-xs">
                        {preferred?.evidence_chunk?.source_document_name || (
                          <span className="text-muted-foreground">No match</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {preferred ? (
                          <ConfidencePill
                            confidence={preferred.llm_confidence}
                            similarity={preferred.similarity_score}
                          />
                        ) : (
                          <Badge variant="outline" className="text-[10px]">none</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-xs">
                        {draftSection || (
                          <span className="text-muted-foreground">Not drafted</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <StatusBadge status={preferred?.status || null} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(openRow)}
        onOpenChange={(open) => {
          if (!open) setOpenRequirementId(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          {openRow ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    {openRow.req.requirement_id}
                  </Badge>
                  <Badge variant="secondary" className="capitalize">
                    {openRow.req.category.replace("_", " ")}
                  </Badge>
                  {openRow.req.readiness_score ? (
                    <ReadinessPill readiness={openRow.req.readiness_score} />
                  ) : null}
                </DialogTitle>
                {openRow.req.section_ref ? (
                  <DialogDescription>{openRow.req.section_ref}</DialogDescription>
                ) : null}
              </DialogHeader>

              <div className="space-y-5">
                <section>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Requirement
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed">{openRow.req.text}</p>
                </section>

                <section>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Candidate matches ({openRow.matches.length})
                  </p>
                  {openRow.matches.length === 0 ? (
                    <div className="mt-2 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                      No capability evidence matched. Consider uploading relevant past
                      performance, or flag this as a gap for a SME response.
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {openRow.matches.map((m) => (
                        <div
                          key={m.id}
                          className="rounded-lg border p-3 text-sm"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <ConfidencePill
                              confidence={m.llm_confidence}
                              similarity={m.similarity_score}
                            />
                            <StatusBadge status={m.status} />
                            {m.evidence_chunk?.source_document_name ? (
                              <Badge variant="outline" className="font-normal">
                                <ExternalLink className="mr-1 h-3 w-3" />
                                {m.evidence_chunk.source_document_name}
                              </Badge>
                            ) : null}
                            <Badge variant="secondary" className="capitalize text-[10px]">
                              {m.evidence_chunk?.category.replace("_", " ") || "—"}
                            </Badge>
                          </div>
                          {m.llm_justification ? (
                            <p className="mt-2 text-xs italic text-muted-foreground">
                              {m.llm_justification}
                            </p>
                          ) : null}
                          {m.evidence_chunk?.content ? (
                            <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-foreground/80">
                              {m.evidence_chunk.content}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant={m.status === "confirmed" ? "default" : "outline"}
                              onClick={() => updateMatchStatus(m.id, "confirmed")}
                              disabled={updatingMatchId === m.id}
                            >
                              {updatingMatchId === m.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3" />
                              )}
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant={m.status === "overridden" ? "default" : "outline"}
                              onClick={() => updateMatchStatus(m.id, "overridden")}
                              disabled={updatingMatchId === m.id}
                            >
                              Override
                            </Button>
                            <Button
                              size="sm"
                              variant={m.status === "rejected" ? "default" : "outline"}
                              onClick={() => updateMatchStatus(m.id, "rejected")}
                              disabled={updatingMatchId === m.id}
                            >
                              <XCircle className="h-3 w-3" />
                              Reject
                            </Button>
                            {m.status !== "suggested" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => updateMatchStatus(m.id, "suggested")}
                                disabled={updatingMatchId === m.id}
                              >
                                Reset
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Draft section
                  </p>
                  {openRow.draftSection ? (
                    <p className="mt-1.5 text-sm">
                      <span className="font-medium">{openRow.draftSection}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        — addresses {openRow.req.requirement_id}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
                      <ShieldQuestion className="h-3.5 w-3.5" />
                      No draft section currently addresses this requirement.
                    </p>
                  )}
                </section>
              </div>

              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setOpenRequirementId(null)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConfidencePill({
  confidence,
  similarity,
}: {
  confidence: Confidence | null;
  similarity: number;
}) {
  const label = confidence || "none";
  const className =
    confidence === "strong"
      ? "bg-success/10 text-success border-success/20"
      : confidence === "partial"
      ? "bg-warning/10 text-warning border-warning/20"
      : "bg-danger/10 text-danger border-danger/20";
  return (
    <div className="flex items-center gap-1.5">
      <Badge className={`${className} text-[10px] capitalize`}>{label}</Badge>
      <span className="text-[10px] text-muted-foreground">
        {(similarity * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: MatchStatus | null }) {
  if (!status) {
    return (
      <Badge variant="outline" className="text-[10px]">
        —
      </Badge>
    );
  }
  const className =
    status === "confirmed"
      ? "bg-success/10 text-success border-success/20"
      : status === "overridden"
      ? "bg-primary/10 text-primary border-primary/20"
      : status === "rejected"
      ? "bg-muted text-muted-foreground border-border"
      : "bg-warning/10 text-warning border-warning/20";
  return <Badge className={`${className} text-[10px] capitalize`}>{status}</Badge>;
}

function ReadinessPill({ readiness }: { readiness: Readiness }) {
  const className =
    readiness === "green"
      ? "bg-success/10 text-success border-success/20"
      : readiness === "yellow"
      ? "bg-warning/10 text-warning border-warning/20"
      : "bg-danger/10 text-danger border-danger/20";
  return <Badge className={className}>{readiness}</Badge>;
}
