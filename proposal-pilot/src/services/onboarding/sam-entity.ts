import { createClient } from "@/lib/supabase/server";
import { isAIMockMode } from "@/lib/ai/mock";
import type { PublicBaselineSuggestions, StoredPublicResearch } from "./public-baseline";

const SAM_ENTITY_URL = "https://api.sam.gov/entity-information/v2/entities";

interface SamEntityInput {
  workspaceId: string;
  companyName?: string;
  uei?: string;
  cage?: string;
}

function resolveSamKey() {
  return process.env.SAM_GOV_API_KEY || process.env.SAM_API_KEY;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["entityData", "entities", "data", "results"]) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
  }
  return [];
}

function pickString(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function collectNaics(entity: Record<string, unknown>) {
  const candidates = [
    entity.naics,
    entity.naicsCode,
    entity.naicsCodes,
    entity.entityRegistration,
    entity.coreData,
    entity.assertions,
  ];
  const codes = new Set<string>();

  function walk(value: unknown) {
    if (!value) return;
    if (typeof value === "string") {
      const matches = value.match(/\b\d{6}\b/g) || [];
      matches.forEach((code) => codes.add(code));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === "object") {
      Object.values(value as Record<string, unknown>).forEach(walk);
    }
  }

  candidates.forEach(walk);
  return [...codes].slice(0, 12);
}

function collectBusinessTypes(entity: Record<string, unknown>) {
  const out = new Set<string>();
  function walk(value: unknown) {
    if (!value) return;
    if (typeof value === "string") {
      if (/8\(a\)|sdvosb|wosb|hubzone|small business/i.test(value)) out.add(value.trim());
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const label = pickString(obj, ["businessTypeDesc", "businessType", "description", "name"]);
      if (label) walk(label);
      Object.values(obj).forEach(walk);
    }
  }
  walk(entity);
  return [...out].slice(0, 12);
}

function normalizeEntityPayload(payload: unknown, input: SamEntityInput) {
  const first = asArray(payload)[0];
  if (!first || typeof first !== "object") return null;
  const entity = first as Record<string, unknown>;
  const registration = (entity.entityRegistration || entity.registration || {}) as Record<
    string,
    unknown
  >;
  const legalName =
    pickString(entity, ["legalBusinessName", "entityName", "businessName"]) ||
    pickString(registration, ["legalBusinessName", "entityName", "businessName"]) ||
    input.companyName ||
    input.uei ||
    input.cage ||
    "SAM entity";

  const uei =
    pickString(entity, ["ueiSAM", "uei", "ueiSam"]) ||
    pickString(registration, ["ueiSAM", "uei", "ueiSam"]) ||
    input.uei ||
    "";
  const cage =
    pickString(entity, ["cageCode", "cage"]) ||
    pickString(registration, ["cageCode", "cage"]) ||
    input.cage ||
    "";
  const naicsCodes = collectNaics(entity);
  const businessTypes = collectBusinessTypes(entity);

  const suggestions: PublicBaselineSuggestions = {
    business_description: `${legalName} is registered in SAM.gov${
      naicsCodes.length ? ` under NAICS ${naicsCodes.join(", ")}` : ""
    }. Verify this profile against internal company materials before using it in proposal narratives.`,
    naics_codes: naicsCodes.map((code) => ({
      code,
      rationale: "Registered on the company's SAM.gov entity record.",
    })),
    certifications: businessTypes.map((value) => ({
      value,
      rationale: "Reported in the company's SAM.gov entity record.",
    })),
  };

  return {
    legalName,
    uei,
    cage,
    suggestions,
    summary: `${legalName}${uei ? ` (UEI ${uei})` : ""}${
      cage ? `, CAGE ${cage}` : ""
    } was imported from the SAM.gov Entity Management API.`,
  };
}

export async function importSamEntity(input: SamEntityInput): Promise<StoredPublicResearch> {
  const supabase = await createClient();
  const companyQuery = input.companyName || input.uei || input.cage;
  if (!companyQuery) throw new Error("Company name, UEI, or CAGE is required");

  if (isAIMockMode()) {
    const suggestions: PublicBaselineSuggestions = {
      business_description:
        "Northstar Digital Services is registered in SAM.gov for mock federal IT, cloud modernization, and cybersecurity services.",
      naics_codes: [
        { code: "541512", label: "Computer Systems Design Services", rationale: "Mock SAM entity record." },
        { code: "541519", label: "Other Computer Related Services", rationale: "Mock SAM entity record." },
      ],
      certifications: [{ value: "Small Business", rationale: "Mock SAM entity record." }],
    };
    const { data, error } = await supabase
      .from("public_company_research")
      .insert({
        workspace_id: input.workspaceId,
        source_type: "sam_entity",
        trust_level: "sam_verified",
        status: "complete",
        company_query: companyQuery,
        uei: input.uei || "MOCKUEI12345",
        cage: input.cage || "MOCK1",
        summary: "Mock SAM.gov entity import complete.",
        suggestions,
        citations: ["https://sam.gov/entity-information"],
        confidence: "high",
      })
      .select("*")
      .single();
    if (error) throw error;
    return {
      id: data.id,
      status: data.status,
      source_type: data.source_type,
      trust_level: data.trust_level,
      summary: data.summary,
      suggestions: data.suggestions,
      citations: data.citations || [],
      confidence: data.confidence,
      error_message: data.error_message,
    };
  }

  const key = resolveSamKey();
  if (!key) {
    throw new Error("SAM_GOV_API_KEY is required for SAM.gov entity import.");
  }

  const { data: research, error: insertError } = await supabase
    .from("public_company_research")
    .insert({
      workspace_id: input.workspaceId,
      source_type: "sam_entity",
      trust_level: "sam_verified",
      status: "running",
      company_query: companyQuery,
      uei: input.uei || null,
      cage: input.cage || null,
      confidence: "high",
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  try {
    const body: Record<string, unknown> = {};
    if (input.uei) body.ueiSAM = [input.uei];
    if (input.cage) body.cageCode = [input.cage];
    if (input.companyName && !input.uei && !input.cage) body.legalBusinessName = input.companyName;

    const response = await fetch(`${SAM_ENTITY_URL}?api_key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `SAM.gov entity import failed (${response.status}): ${await response.text().catch(() => "")}`
      );
    }

    const payload = await response.json();
    const normalized = normalizeEntityPayload(payload, input);
    if (!normalized) {
      throw new Error("No SAM.gov entity record matched the provided identifier.");
    }

    const { data: updated, error: updateError } = await supabase
      .from("public_company_research")
      .update({
        status: "complete",
        company_query: normalized.legalName,
        uei: normalized.uei || input.uei || null,
        cage: normalized.cage || input.cage || null,
        summary: normalized.summary,
        suggestions: normalized.suggestions,
        citations: ["https://open.gsa.gov/api/entity-api/", "https://sam.gov/entity-information"],
        confidence: "high",
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
    const message = error instanceof Error ? error.message : "SAM.gov entity import failed";
    await supabase
      .from("public_company_research")
      .update({ status: "error", error_message: message.slice(0, 1000) })
      .eq("id", research.id);
    throw error;
  }
}
