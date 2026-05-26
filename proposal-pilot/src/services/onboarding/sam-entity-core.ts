import type { PublicBaselineSuggestions } from "./public-baseline";

const SAM_ENTITY_URL = "https://api.sam.gov/entity-information/v2/entities";

export interface SamEntityLookupInput {
  companyName?: string;
  uei?: string;
  cage?: string;
}

export function buildSamEntityRequestUrl(input: SamEntityLookupInput, apiKey: string) {
  const params = new URLSearchParams({
    api_key: apiKey,
    includeSections: "entityRegistration,coreData,assertions,pointsOfContact",
  });
  if (input.uei) params.set("ueiSAM", input.uei);
  if (input.cage) params.set("cageCode", input.cage);
  if (input.companyName && !input.uei && !input.cage) {
    params.set("legalBusinessName", input.companyName);
  }
  return `${SAM_ENTITY_URL}?${params.toString()}`;
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

export function normalizeEntityPayload(payload: unknown, input: SamEntityLookupInput) {
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
