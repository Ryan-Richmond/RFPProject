export type EvidenceCategory =
  | "past_performance"
  | "technical_approach"
  | "key_personnel"
  | "corporate_overview"
  | "certifications"
  | "management";

export interface LegacyProposalArtifact {
  artifact_type: string;
  artifact_title?: string;
  category: EvidenceCategory;
  confidence?: "high" | "medium" | "low";
  content: string;
  keywords?: string[];
  naics_codes?: string[];
  agency?: string | null;
  contract_type?: string | null;
  date?: string | null;
}

const VALID_CATEGORIES = new Set<EvidenceCategory>([
  "past_performance",
  "technical_approach",
  "key_personnel",
  "corporate_overview",
  "certifications",
  "management",
]);

export function safeJsonExtract(text: string): unknown {
  const cleaned = text.replace(/```json?/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export function defaultArtifactType(category: EvidenceCategory) {
  switch (category) {
    case "corporate_overview":
      return "capability_statement";
    case "certifications":
      return "certifications";
    case "key_personnel":
      return "key_personnel";
    case "past_performance":
      return "past_performance";
    case "technical_approach":
      return "technical_approach";
    default:
      return "management";
  }
}

export function parseLegacyProposalArtifactsFromResponse(text: string): LegacyProposalArtifact[] {
  const parsed = safeJsonExtract(text);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item): LegacyProposalArtifact | null => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const content = typeof row.content === "string" ? row.content.trim() : "";
      const rawCategory = String(row.category || "").trim() as EvidenceCategory;
      const category = VALID_CATEGORIES.has(rawCategory) ? rawCategory : "corporate_overview";
      if (content.length < 80) return null;
      const confidence = row.confidence === "high" || row.confidence === "low" ? row.confidence : "medium";
      return {
        artifact_type:
          typeof row.artifact_type === "string" && row.artifact_type.trim()
            ? row.artifact_type.trim()
            : defaultArtifactType(category),
        artifact_title:
          typeof row.artifact_title === "string" ? row.artifact_title.trim() : undefined,
        category,
        confidence,
        content,
        keywords: Array.isArray(row.keywords) ? row.keywords.map(String).slice(0, 12) : [],
        naics_codes: Array.isArray(row.naics_codes)
          ? row.naics_codes.map(String).map((code) => code.replace(/\D/g, "").slice(0, 6)).filter(Boolean)
          : [],
        agency: typeof row.agency === "string" ? row.agency : null,
        contract_type: typeof row.contract_type === "string" ? row.contract_type : null,
        date: typeof row.date === "string" ? row.date : null,
      };
    })
    .filter(Boolean) as LegacyProposalArtifact[];
}
