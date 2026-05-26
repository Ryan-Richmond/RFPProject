"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Globe2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface ClientProfileLike {
  company_name?: string;
  business_description?: string;
  naics_codes?: string[];
  certifications?: string[];
  past_contract_vehicles?: string[];
  preferred_agencies?: string[];
  core_capabilities?: string[];
}

interface PublicResearch {
  id: string;
  status: "running" | "complete" | "error";
  trust_level: "public_unverified" | "sam_verified";
  source_type: "public_research" | "sam_entity";
  summary?: string | null;
  suggestions?: {
    business_description?: string;
    naics_codes?: Array<{ code: string; label?: string; rationale?: string }>;
    core_capabilities?: Array<{ value: string; rationale?: string }>;
    certifications?: Array<{ value: string; rationale?: string }>;
    preferred_agencies?: Array<{ value: string; rationale?: string }>;
    past_contract_vehicles?: Array<{ value: string; rationale?: string }>;
    public_awards?: Array<{ title: string; agency?: string; value?: string }>;
  };
  citations?: string[];
  confidence?: "high" | "medium" | "low" | null;
  error_message?: string | null;
}

interface PublicBaselinePanelProps {
  profile: ClientProfileLike;
  onApplied: (profile: ClientProfileLike) => void;
}

const APPLY_FIELDS = [
  "business_description",
  "naics_codes",
  "core_capabilities",
  "certifications",
  "preferred_agencies",
  "past_contract_vehicles",
];

export function PublicBaselinePanel({ profile, onApplied }: PublicBaselinePanelProps) {
  const [companyName, setCompanyName] = useState(profile.company_name || "");
  const [website, setWebsite] = useState("");
  const [uei, setUei] = useState("");
  const [cage, setCage] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [research, setResearch] = useState<PublicResearch | null>(null);

  useEffect(() => {
    setCompanyName(profile.company_name || "");
  }, [profile.company_name]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/onboarding/public-research")
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!cancelled) setResearch(payload?.research || null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const suggestionCount = useMemo(() => {
    const suggestions = research?.suggestions || {};
    return [
      suggestions.business_description,
      ...(suggestions.naics_codes || []),
      ...(suggestions.core_capabilities || []),
      ...(suggestions.certifications || []),
      ...(suggestions.preferred_agencies || []),
      ...(suggestions.past_contract_vehicles || []),
    ].filter(Boolean).length;
  }, [research]);

  async function runPublicResearch() {
    const trimmed = companyName.trim();
    if (!trimmed) {
      toast.error("Enter a company name first.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/onboarding/public-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: trimmed, website, uei, cage }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Public research failed");
      setResearch(payload.research);
      toast.success("Public baseline ready for review.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Public research failed");
    } finally {
      setLoading(false);
    }
  }

  async function runSamImport() {
    if (!companyName.trim() && !uei.trim() && !cage.trim()) {
      toast.error("Enter a company name, UEI, or CAGE first.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/onboarding/sam-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, uei, cage }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "SAM.gov import failed");
      setResearch(payload.research);
      toast.success("SAM.gov entity data imported.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "SAM.gov import failed");
    } finally {
      setLoading(false);
    }
  }

  async function applySuggestions() {
    if (!research) return;
    setApplying(true);
    try {
      const response = await fetch("/api/onboarding/public-research/apply", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ researchId: research.id, fields: APPLY_FIELDS }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Failed to apply suggestions");
      onApplied(payload.profile);
      toast.success("Profile updated from reviewed baseline.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to apply suggestions");
    } finally {
      setApplying(false);
    }
  }

  return (
    <Card id="public-baseline">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Globe2 className="h-4 w-4" />
          Public Baseline
        </CardTitle>
        <CardDescription className="text-xs">
          Start from cited public sources, then approve only the fields that belong in your profile.
          Public findings stay out of proposal evidence until verified.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="baseline-company">Company name</Label>
            <Input
              id="baseline-company"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Acme Federal Solutions"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="baseline-website">Website</Label>
            <Input
              id="baseline-website"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder="https://company.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="baseline-uei">UEI</Label>
            <Input
              id="baseline-uei"
              value={uei}
              onChange={(event) => setUei(event.target.value.toUpperCase())}
              placeholder="12-character UEI"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="baseline-cage">CAGE</Label>
            <Input
              id="baseline-cage"
              value={cage}
              onChange={(event) => setCage(event.target.value.toUpperCase())}
              placeholder="CAGE code"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={runPublicResearch} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe2 className="h-4 w-4" />}
            Run Public Research
          </Button>
          <Button onClick={runSamImport} disabled={loading} variant="outline" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Import SAM Entity
          </Button>
        </div>

        {research ? (
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={
                  research.trust_level === "sam_verified"
                    ? "bg-success/10 text-success border-success/20"
                    : "bg-warning/10 text-warning border-warning/20"
                }
              >
                {research.trust_level === "sam_verified" ? "SAM verified" : "Public unverified"}
              </Badge>
              {research.confidence ? <Badge variant="secondary">{research.confidence} confidence</Badge> : null}
              <Badge variant="outline">{suggestionCount} suggestions</Badge>
            </div>
            {research.summary ? (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{research.summary}</p>
            ) : null}
            {research.suggestions?.core_capabilities?.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {research.suggestions.core_capabilities.slice(0, 8).map((item) => (
                  <Badge key={item.value} variant="secondary">
                    {item.value}
                  </Badge>
                ))}
              </div>
            ) : null}
            {research.status === "error" ? (
              <p className="mt-3 text-sm text-destructive">{research.error_message}</p>
            ) : null}
            {research.status === "complete" ? (
              <Button onClick={applySuggestions} disabled={applying} size="sm" className="mt-4 gap-2">
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Apply Reviewed Suggestions
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
