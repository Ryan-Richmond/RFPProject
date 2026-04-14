"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, Save, Loader2, Plus, X } from "lucide-react";

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

export default function ProfilePage() {
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
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Client Profile
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Define your business profile for opportunity matching
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            "Saved!"
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Profile
            </>
          )}
        </Button>
      </div>

      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Company Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name</Label>
            <Input
              id="company_name"
              value={profile.company_name || ""}
              onChange={(e) =>
                setProfile((p) => ({ ...p, company_name: e.target.value }))
              }
              placeholder="Your company name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="business_description">Business Description</Label>
            <textarea
              id="business_description"
              value={profile.business_description || ""}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  business_description: e.target.value,
                }))
              }
              placeholder="Describe what your company does, areas of expertise, and target market"
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NAICS & Certifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">NAICS Codes</CardTitle>
        </CardHeader>
        <CardContent>
          <TagInput
            tags={profile.naics_codes || []}
            onAdd={(tag) =>
              setProfile((p) => ({
                ...p,
                naics_codes: [...(p.naics_codes || []), tag],
              }))
            }
            onRemove={(tag) =>
              setProfile((p) => ({
                ...p,
                naics_codes: (p.naics_codes || []).filter((t) => t !== tag),
              }))
            }
            placeholder="Add NAICS code (e.g., 541512)"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Certifications</CardTitle>
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
        </CardContent>
      </Card>

      {/* Contract Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Contract Preferences</CardTitle>
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
                placeholder="0"
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
              placeholder="e.g., GSA MAS, SEWP V"
            />
          </div>
        </CardContent>
      </Card>

      {/* Core Capabilities */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Core Capabilities</CardTitle>
        </CardHeader>
        <CardContent>
          <TagInput
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
            placeholder="e.g., Cloud Migration, Cybersecurity, DevOps"
          />
        </CardContent>
      </Card>

      {/* Preferred / Excluded Agencies */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Preferred Agencies</CardTitle>
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
              placeholder="e.g., NASA, DOD"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Excluded Agencies</CardTitle>
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
              placeholder="e.g., IRS"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
