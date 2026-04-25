export const PSC_PREFIX_TO_CAPABILITIES: Record<string, string[]> = {
  D3: ["it", "software", "information technology", "systems integration"],
  D7: ["it", "automation", "data processing", "cloud"],
  R4: ["professional services", "program management", "consulting"],
  R7: ["training", "education", "professional services"],
  R8: ["support services", "technical assistance"],
  DA: ["it", "business applications", "software"],
  DB: ["it", "it services", "telecom"],
  DC: ["it", "network", "hardware", "systems"],
  DD: ["it", "digital", "telecommunications"],
  DE: ["it", "operations", "maintenance", "support"],
  DJ: ["it", "security", "cybersecurity"],
  F1: ["environmental", "remediation", "engineering"],
  H9: ["maintenance", "repair", "equipment services"],
  J0: ["maintenance", "repair", "support"],
  K0: ["modification", "upgrade", "engineering"],
  M1: ["operations", "facility support"],
  Q5: ["medical", "health", "clinical"],
  S2: ["housekeeping", "janitorial", "facilities"],
  T0: ["logistics", "supply chain", "transportation"],
  V2: ["transportation", "freight", "logistics"],
};

export function lookupPscCapabilities(classificationCode?: string | null): string[] {
  const normalized = (classificationCode || "").trim().toUpperCase();
  if (!normalized) return [];

  const prefix2 = normalized.slice(0, 2);
  const prefix1 = normalized.slice(0, 1);

  return (
    PSC_PREFIX_TO_CAPABILITIES[prefix2] ||
    PSC_PREFIX_TO_CAPABILITIES[prefix1] ||
    []
  );
}
