import { callAgentAPI } from "@/lib/ai/gemini";
import { createClient } from "@/lib/supabase/server";

export interface PublicBaselineInput {
  workspaceId: string;
  companyName: string;
  website?: string;
  uei?: string;
  cage?: string;
}

export interface PublicBaselineSuggestions {
  business_description?: string;
  naics_codes?: Array<{ code: string; label?: string; rationale?: string }>;
  core_capabilities?: Array<{ value: string; rationale?: string }>;
  certifications?: Array<{ value: string; rationale?: string }>;
  preferred_agencies?: Array<{ value: string; rationale?: string }>;
  past_contract_vehicles?: Array<{ value: string; rationale?: string }>;
  public_awards?: Array<{
    title: string;
    agency?: string;
    value?: string;
    period?: string;
    source?: string;
  }>;
}

export interface StoredPublicResearch {
  id: string;
  status: "running" | "complete" | "error";
  source_type: "public_research" | "sam_entity";
  trust_level: "public_unverified" | "sam_verified";
  summary?: string | null;
  suggestions: PublicBaselineSuggestions;
  citations: string[];
  confidence?: "high" | "medium" | "low" | null;
  error_message?: string | null;
}

function safeJsonExtract(text: string): unknown {
  const cleaned = text.replace(/```json?/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/{[\s\S]*}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeSuggestions(value: unknown): PublicBaselineSuggestions {
  if (!value || typeof value !== "object") return {};
  const obj = value as Record<string, unknown>;
  return {
    business_description:
      typeof obj.business_description === "string" ? obj.business_description : undefined,
    naics_codes: Array.isArray(obj.naics_codes)
      ? obj.naics_codes
          .map((item) => {
            if (typeof item === "string") return { code: item.replace(/\D/g, "").slice(0, 6) };
            if (!item || typeof item !== "object") return null;
            const row = item as Record<string, unknown>;
            const code = String(row.code || row.value || "").replace(/\D/g, "").slice(0, 6);
            if (!code) return null;
            return {
              code,
              label: typeof row.label === "string" ? row.label : undefined,
              rationale: typeof row.rationale === "string" ? row.rationale : undefined,
            };
          })
          .filter(Boolean) as PublicBaselineSuggestions["naics_codes"]
      : undefined,
    core_capabilities: normalizeValueRationaleList(obj.core_capabilities),
    certifications: normalizeValueRationaleList(obj.certifications),
    preferred_agencies: normalizeValueRationaleList(obj.preferred_agencies),
    past_contract_vehicles: normalizeValueRationaleList(obj.past_contract_vehicles),
    public_awards: Array.isArray(obj.public_awards)
      ? obj.public_awards
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const row = item as Record<string, unknown>;
            const title = typeof row.title === "string" ? row.title : "";
            if (!title) return null;
            return {
              title,
              agency: typeof row.agency === "string" ? row.agency : undefined,
              value: typeof row.value === "string" ? row.value : undefined,
              period: typeof row.period === "string" ? row.period : undefined,
              source: typeof row.source === "string" ? row.source : undefined,
            };
          })
          .filter(Boolean) as PublicBaselineSuggestions["public_awards"]
      : undefined,
  };
}

function normalizeValueRationaleList(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((item) => {
      if (typeof item === "string") return { value: item };
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const candidate = String(row.value || row.label || "").trim();
      if (!candidate) return null;
      return {
        value: candidate,
        rationale: typeof row.rationale === "string" ? row.rationale : undefined,
      };
    })
    .filter(Boolean) as Array<{ value: string; rationale?: string }>;
}

export async function runPublicBaselineResearch(
  input: PublicBaselineInput
): Promise<StoredPublicResearch> {
  const supabase = await createClient();
  const { data: research, error: insertError } = await supabase
    .from("public_company_research")
    .insert({
      workspace_id: input.workspaceId,
      source_type: "public_research",
      trust_level: "public_unverified",
      status: "running",
      company_query: input.companyName,
      website: input.website || null,
      uei: input.uei || null,
      cage: input.cage || null,
      confidence: "medium",
    })
    .select("id")
    .single();

  if (insertError) throw insertError;

  try {
    const prompt = `Research this government contractor using only public, citable sources.

Company name: ${input.companyName}
Website: ${input.website || "(unknown)"}
UEI: ${input.uei || "(unknown)"}
CAGE: ${input.cage || "(unknown)"}

Return strict JSON:
{
  "summary": "2-4 sentence public profile summary",
  "confidence": "high" | "medium" | "low",
  "suggestions": {
    "business_description": "...",
    "naics_codes": [{ "code": "541512", "label": "Computer Systems Design Services", "rationale": "..." }],
    "core_capabilities": [{ "value": "Cloud Migration", "rationale": "..." }],
    "certifications": [{ "value": "SDVOSB", "rationale": "..." }],
    "preferred_agencies": [{ "value": "Department of Defense", "rationale": "..." }],
    "past_contract_vehicles": [{ "value": "GSA MAS", "rationale": "..." }],
    "public_awards": [{ "title": "...", "agency": "...", "value": "...", "period": "...", "source": "..." }]
  }
}

Rules:
- Public findings are public_unverified and cannot be used as proposal evidence until the user verifies them.
- Prefer SAM.gov, USAspending, FPDS, company website, and agency award pages.
- Do not invent certifications, vehicles, or awards. Omit uncertain fields.`;

    const response = await callAgentAPI(
      {
        input: prompt,
        instructions:
          "Return JSON only. Include only claims supported by public sources and keep uncertain fields omitted.",
        model: "sonar-pro",
        tools: [{ type: "web_search" }],
      },
      { workspaceId: input.workspaceId, operationType: "public_research" }
    );

    const parsed = safeJsonExtract(response.outputText) as
      | {
          summary?: string;
          confidence?: "high" | "medium" | "low";
          suggestions?: unknown;
        }
      | null;

    const suggestions = normalizeSuggestions(parsed?.suggestions || parsed || {});
    const confidence =
      parsed?.confidence === "high" || parsed?.confidence === "medium" || parsed?.confidence === "low"
        ? parsed.confidence
        : "medium";

    const { data: updated, error: updateError } = await supabase
      .from("public_company_research")
      .update({
        status: "complete",
        summary: parsed?.summary || null,
        suggestions,
        citations: response.citations,
        confidence,
      })
      .eq("id", research.id)
      .select("*")
      .single();

    if (updateError) throw updateError;
    return {
      id: updated.id,
      status: updated.status,
      source_type: updated.source_type,
      trust_level: updated.trust_level,
      summary: updated.summary,
      suggestions: updated.suggestions || {},
      citations: updated.citations || [],
      confidence: updated.confidence,
      error_message: updated.error_message,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Public research failed";
    await supabase
      .from("public_company_research")
      .update({ status: "error", error_message: message.slice(0, 1000) })
      .eq("id", research.id);
    throw error;
  }
}

export async function getLatestPublicBaseline(
  workspaceId: string
): Promise<StoredPublicResearch | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("public_company_research")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    status: data.status,
    source_type: data.source_type,
    trust_level: data.trust_level,
    summary: data.summary,
    suggestions: data.suggestions || {},
    citations: data.citations || [],
    confidence: data.confidence,
    error_message: data.error_message,
  };
}

export async function applyPublicBaselineSuggestions(input: {
  workspaceId: string;
  researchId: string;
  fields: Array<keyof PublicBaselineSuggestions>;
}) {
  const supabase = await createClient();
  const { data: research } = await supabase
    .from("public_company_research")
    .select("*")
    .eq("id", input.researchId)
    .eq("workspace_id", input.workspaceId)
    .single();

  if (!research) throw new Error("Public research result not found");
  const suggestions = normalizeSuggestions(research.suggestions || {});

  const { data: current } = await supabase
    .from("client_profiles")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  const patch: Record<string, unknown> = { workspace_id: input.workspaceId };
  const applied: Record<string, unknown> = {};

  if (input.fields.includes("business_description") && suggestions.business_description) {
    patch.business_description = suggestions.business_description;
    applied.business_description = suggestions.business_description;
  }
  if (input.fields.includes("naics_codes") && suggestions.naics_codes?.length) {
    patch.naics_codes = mergeUnique(
      current?.naics_codes || [],
      suggestions.naics_codes.map((item) => item.code)
    );
    applied.naics_codes = suggestions.naics_codes;
  }
  if (input.fields.includes("core_capabilities") && suggestions.core_capabilities?.length) {
    patch.core_capabilities = mergeUnique(
      current?.core_capabilities || [],
      suggestions.core_capabilities.map((item) => item.value)
    );
    applied.core_capabilities = suggestions.core_capabilities;
  }
  if (input.fields.includes("certifications") && suggestions.certifications?.length) {
    patch.certifications = mergeUnique(
      current?.certifications || [],
      suggestions.certifications.map((item) => item.value)
    );
    applied.certifications = suggestions.certifications;
  }
  if (input.fields.includes("preferred_agencies") && suggestions.preferred_agencies?.length) {
    patch.preferred_agencies = mergeUnique(
      current?.preferred_agencies || [],
      suggestions.preferred_agencies.map((item) => item.value)
    );
    applied.preferred_agencies = suggestions.preferred_agencies;
  }
  if (
    input.fields.includes("past_contract_vehicles") &&
    suggestions.past_contract_vehicles?.length
  ) {
    patch.past_contract_vehicles = mergeUnique(
      current?.past_contract_vehicles || [],
      suggestions.past_contract_vehicles.map((item) => item.value)
    );
    applied.past_contract_vehicles = suggestions.past_contract_vehicles;
  }

  const { data: profile, error } = await supabase
    .from("client_profiles")
    .upsert(
      {
        company_name: current?.company_name || research.company_query,
        business_description: current?.business_description || null,
        naics_codes: current?.naics_codes || [],
        certifications: current?.certifications || [],
        annual_revenue_tier: current?.annual_revenue_tier || null,
        employee_count_tier: current?.employee_count_tier || null,
        past_contract_vehicles: current?.past_contract_vehicles || [],
        preferred_agencies: current?.preferred_agencies || [],
        excluded_agencies: current?.excluded_agencies || [],
        min_contract_value: current?.min_contract_value || 0,
        max_contract_value: current?.max_contract_value || null,
        core_capabilities: current?.core_capabilities || [],
        ...patch,
      },
      { onConflict: "workspace_id" }
    )
    .select("*")
    .single();

  if (error) throw error;

  await supabase
    .from("public_company_research")
    .update({ applied_fields: { ...(research.applied_fields || {}), ...applied } })
    .eq("id", input.researchId);

  return profile;
}

function mergeUnique(existing: string[], incoming: string[]) {
  const seen = new Set(existing.map((value) => value.toLowerCase()));
  const result = [...existing];
  for (const value of incoming) {
    const clean = value.trim();
    if (!clean || seen.has(clean.toLowerCase())) continue;
    seen.add(clean.toLowerCase());
    result.push(clean);
  }
  return result;
}
