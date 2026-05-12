"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, Save, Loader2, Plus, X, Info, CheckCircle2, BookOpen, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { SuggestingTagInput, type TagSuggestion } from "@/components/features/suggesting-tag-input";
import { searchCapabilities, COMMON_CAPABILITIES } from "@/lib/profile/capabilities";
import { searchNaicsCodes, findNaicsByCode } from "@/lib/profile/naics-codes";

interface ClientProfile {
  company_name?: string;
  business_description?: string;
  naics_codes?: string[];
  certifications?: string[];
  annual_revenue_tier?: string;
  employee_count_tier?: string;
  past_contract_vehicles?: string[];
  preferred_agencies?: string[];
  excluded_agencies?: string[];
  min_contract_value?: number;
  max_contract_value?: number;
  core_capabilities?: string[];
}

const CERTIFICATIONS = [
  "8(a)",
  "SDVOSB",
  "WOSB",
  "EDWOSB",
  "HUBZone",
  "ISO 9001",
  "ISO 27001",
  "CMMI Level 3",
  "FedRAMP",
  "SOC 2",
];

const REVENUE_TIERS = [
  { value: "under_1m", label: "Under $1M" },
  { value: "1m_10m", label: "$1M - $10M" },
  { value: "10m_50m", label: "$10M - $50M" },
  { value: "50m_plus", label: "$50M+" },
];

const EMPLOYEE_TIERS = [
  { value: "micro", label: "Micro (1-10)" },
  { value: "small", label: "Small (11-100)" },
  { value: "mid", label: "Mid (101-500)" },
  { value: "large", label: "Large (500+)" },
];

function TagInput({
  tags,
  onAdd,
  onRemove,
  placeholder,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      onAdd(input.trim());
      setInput("");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
            {tag}
            <button
              onClick={() => onRemove(tag)}
              className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (input.trim()) {
              onAdd(input.trim());
              setInput("");
            }
          }}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground mt-1">
      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      {children}
    </p>
  );
}

function completionScore(profile: ClientProfile): number {
  const checks = [
    Boolean(profile.company_name?.trim()),
    Boolean(profile.business_description?.trim()),
    (profile.naics_codes?.length ?? 0) > 0,
    (profile.certifications?.length ?? 0) > 0,
    (profile.core_capabilities?.length ?? 0) > 0,
    Boolean(profile.annual_revenue_tier),
    Boolean(profile.employee_count_tier),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ClientProfile>({
    naics_codes: [],
    certifications: [],
    past_contract_vehicles: [],
    preferred_agencies: [],
    excluded_agencies: [],
    core_capabilities: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const data = await res.json();
          setProfile({
            ...data,
            naics_codes: data.naics_codes || [],
            certifications: data.certifications || [],
            past_contract_vehicles: data.past_contract_vehicles || [],
            preferred_agencies: data.preferred_agencies || [],
            excluded_agencies: data.excluded_agencies || [],
            core_capabilities: data.core_capabilities || [],
          });
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        toast.error("Failed to load company profile.");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        setSaved(true);
        toast.success("Company profile saved. Opportunity scoring will use the updated profile.");
        setTimeout(() => setSaved(false), 3000);
      } else {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to save profile");
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleLaunchGuide() {
    router.push("/workspace?guide=open");
  }

  async function fetchAiSuggestions(
    kind: "naics" | "capabilities",
    freeText: string,
    existing: string[]
  ): Promise<TagSuggestion[]> {
    const res = await fetch("/api/profile/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, text: freeText, existing }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.error || "Suggestion request failed");
    }
    const data = (await res.json()) as {
      suggestions?: Array<{ value: string; label?: string; rationale?: string }>;
    };
    return (data.suggestions || []).map((s) => ({
      value: s.value,
      label: s.label,
      rationale: s.rationale,
    }));
  }

  function getCapabilitySuggestions(query: string, existing: string[]): TagSuggestion[] {
    return searchCapabilities(query, existing, 8).map((s) => ({
      value: s.label,
      hint: s.group,
    }));
  }

  function getNaicsSuggestions(query: string, existing: string[]): TagSuggestion[] {
    const existingSet = new Set(existing);
    return searchNaicsCodes(query, 8)
      .filter((s) => !existingSet.has(s.code))
      .map((s) => ({
        value: s.code,
        label: s.title,
        hint: s.code,
      }));
  }

  function renderNaicsTag(code: string): string {
    const known = findNaicsByCode(code);
    return known ? `${code} — ${known.title}` : code;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground mt-2">Loading company profile...</p>
      </div>
    );
  }

  const score = completionScore(profile);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Company Profile</h1>
          <p className="text-muted-foreground text-sm mt-1">
            This profile drives opportunity scoring and RFP matching. The more complete it is, the better the AI can target the right RFPs for you.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2 shrink-0">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Saved
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Profile
            </>
          )}
        </Button>
      </div>

      {/* Completion indicator */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Profile Completeness</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {score < 50
                ? "Complete your profile to unlock accurate opportunity scoring"
                : score < 85
                ? "Good start — fill in the remaining fields for best results"
                : "Your profile is well-configured for high-quality matches"}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  score >= 85 ? "bg-success" : score >= 50 ? "bg-primary" : "bg-warning"
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
            <span className="text-sm font-bold tabular-nums">{score}%</span>
          </div>
        </div>
      </div>

      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Company Information
          </CardTitle>
          <CardDescription className="text-xs">
            Used as the primary identity in proposal headers and agency matching.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name <span className="text-destructive">*</span></Label>
            <Input
              id="company_name"
              value={profile.company_name || ""}
              onChange={(e) =>
                setProfile((p) => ({ ...p, company_name: e.target.value }))
              }
              placeholder="Your company name"
            />
            <FieldHint>This name appears in the sidebar and is included in your generated proposals.</FieldHint>
          </div>
          <div className="space-y-2">
            <Label htmlFor="business_description">Business Description <span className="text-destructive">*</span></Label>
            <textarea
              id="business_description"
              value={profile.business_description || ""}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  business_description: e.target.value,
                }))
              }
              placeholder="Describe what your company does, your areas of expertise, and the types of agencies you target"
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <FieldHint>This text is used by the AI to score opportunities and tailor proposal language. Be specific about your domain.</FieldHint>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Annual Revenue</Label>
              <select
                value={profile.annual_revenue_tier || ""}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    annual_revenue_tier: e.target.value || undefined,
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select tier</option>
                {REVENUE_TIERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <FieldHint>Filters out contracts above or below your capacity.</FieldHint>
            </div>
            <div className="space-y-2">
              <Label>Employee Count</Label>
              <select
                value={profile.employee_count_tier || ""}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    employee_count_tier: e.target.value || undefined,
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select tier</option>
                {EMPLOYEE_TIERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <FieldHint>Used for small business size standard checks.</FieldHint>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Core Capabilities */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Core Capabilities <span className="text-destructive">*</span></CardTitle>
          <CardDescription className="text-xs">
            What your company actually delivers — the AI uses these to match you to relevant RFPs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SuggestingTagInput
            tags={profile.core_capabilities || []}
            onAdd={(tag) =>
              setProfile((p) => ({
                ...p,
                core_capabilities: [...(p.core_capabilities || []), tag],
              }))
            }
            onRemove={(tag) =>
              setProfile((p) => ({
                ...p,
                core_capabilities: (p.core_capabilities || []).filter(
                  (t) => t !== tag
                ),
              }))
            }
            placeholder="Start typing — e.g., Cloud Migration, Cybersecurity, DevSecOps"
            getLocalSuggestions={getCapabilitySuggestions}
            fetchAiSuggestions={(text, existing) =>
              fetchAiSuggestions("capabilities", text, existing)
            }
            aiButtonLabel="Suggest from my docs"
          />
          <FieldHint>
            Start typing to pick from {COMMON_CAPABILITIES.reduce((n, g) => n + g.items.length, 0)}+ common capabilities, or use{" "}
            <strong>Suggest from my docs</strong> to let the AI propose capabilities based on your business description and uploaded files.
          </FieldHint>
        </CardContent>
      </Card>

      {/* NAICS & Certifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">NAICS Codes <span className="text-destructive">*</span></CardTitle>
          <CardDescription className="text-xs">
            Used to match set-asides and filter eligible solicitations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SuggestingTagInput
            tags={profile.naics_codes || []}
            onAdd={(tag) => {
              const code = tag.replace(/\D/g, "").slice(0, 6);
              if (!code) return;
              setProfile((p) => ({
                ...p,
                naics_codes: [...(p.naics_codes || []), code],
              }));
            }}
            onRemove={(tag) =>
              setProfile((p) => ({
                ...p,
                naics_codes: (p.naics_codes || []).filter((t) => t !== tag),
              }))
            }
            placeholder="Search by code or description (e.g., 541512 or 'cloud migration')"
            getLocalSuggestions={getNaicsSuggestions}
            fetchAiSuggestions={(text, existing) =>
              fetchAiSuggestions("naics", text, existing)
            }
            renderTagLabel={renderNaicsTag}
            aiButtonLabel="Suggest from my docs"
          />
          <FieldHint>
            Most people don&apos;t know NAICS by number — type what your business does (e.g., &ldquo;software&rdquo;, &ldquo;construction&rdquo;,
            &ldquo;cybersecurity&rdquo;) and pick from the matches, or use <strong>Suggest from my docs</strong> for AI-recommended codes
            based on your business description and uploaded files.
          </FieldHint>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Certifications <span className="text-destructive">*</span></CardTitle>
          <CardDescription className="text-xs">
            Set-aside and eligibility filters are based on your certifications. Select all that apply.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {CERTIFICATIONS.map((cert) => (
              <Button
                key={cert}
                variant={
                  (profile.certifications || []).includes(cert)
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() => {
                  setProfile((p) => {
                    const certs = p.certifications || [];
                    return {
                      ...p,
                      certifications: certs.includes(cert)
                        ? certs.filter((c) => c !== cert)
                        : [...certs, cert],
                    };
                  });
                }}
              >
                {cert}
              </Button>
            ))}
          </div>
          <FieldHint>Selecting the wrong certifications can exclude you from eligible contracts — only select what you currently hold.</FieldHint>
        </CardContent>
      </Card>

      {/* Contract Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Contract Preferences</CardTitle>
          <CardDescription className="text-xs">
            Narrows discovery results to contracts your firm can realistically pursue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Min Contract Value ($)</Label>
              <Input
                type="number"
                value={profile.min_contract_value || ""}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    min_contract_value: Number(e.target.value) || 0,
                  }))
                }
                placeholder="e.g., 100000"
              />
            </div>
            <div className="space-y-2">
              <Label>Max Contract Value ($)</Label>
              <Input
                type="number"
                value={profile.max_contract_value || ""}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    max_contract_value: Number(e.target.value) || undefined,
                  }))
                }
                placeholder="No limit"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Past Contract Vehicles</Label>
            <TagInput
              tags={profile.past_contract_vehicles || []}
              onAdd={(tag) =>
                setProfile((p) => ({
                  ...p,
                  past_contract_vehicles: [
                    ...(p.past_contract_vehicles || []),
                    tag,
                  ],
                }))
              }
              onRemove={(tag) =>
                setProfile((p) => ({
                  ...p,
                  past_contract_vehicles: (
                    p.past_contract_vehicles || []
                  ).filter((t) => t !== tag),
                }))
              }
              placeholder="e.g., GSA MAS, SEWP V, CIO-SP4"
            />
            <FieldHint>Listing your existing contract vehicles boosts your score on on-vehicle opportunities.</FieldHint>
          </div>
        </CardContent>
      </Card>

      {/* Preferred / Excluded Agencies */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Preferred Agencies</CardTitle>
            <CardDescription className="text-xs">
              Gets higher scores in opportunity ranking.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TagInput
              tags={profile.preferred_agencies || []}
              onAdd={(tag) =>
                setProfile((p) => ({
                  ...p,
                  preferred_agencies: [
                    ...(p.preferred_agencies || []),
                    tag,
                  ],
                }))
              }
              onRemove={(tag) =>
                setProfile((p) => ({
                  ...p,
                  preferred_agencies: (p.preferred_agencies || []).filter(
                    (t) => t !== tag
                  ),
                }))
              }
              placeholder="e.g., NASA, DOD, HHS"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Excluded Agencies</CardTitle>
            <CardDescription className="text-xs">
              Filtered out from discovery results.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TagInput
              tags={profile.excluded_agencies || []}
              onAdd={(tag) =>
                setProfile((p) => ({
                  ...p,
                  excluded_agencies: [
                    ...(p.excluded_agencies || []),
                    tag,
                  ],
                }))
              }
              onRemove={(tag) =>
                setProfile((p) => ({
                  ...p,
                  excluded_agencies: (p.excluded_agencies || []).filter(
                    (t) => t !== tag
                  ),
                }))
              }
              placeholder="e.g., IRS, TSA"
            />
          </CardContent>
        </Card>
      </div>

      {/* Help & Onboarding */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Help &amp; Getting Started
          </CardTitle>
          <CardDescription className="text-xs">
            Not sure where to start or want a refresher on how the system works?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Getting Started Guide</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Walks you through the full workflow — from uploading company docs to exporting your first proposal. Shows your actual current progress.
              </p>
            </div>
            <Button
              variant="outline"
              className="gap-2 shrink-0"
              onClick={handleLaunchGuide}
            >
              <BookOpen className="h-4 w-4" />
              Launch Guide
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save CTA */}
      <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/20 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Changes take effect on the next opportunity discovery run.
        </p>
        <Button onClick={handleSave} disabled={saving} className="gap-2 shrink-0">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Saved
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Profile
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
