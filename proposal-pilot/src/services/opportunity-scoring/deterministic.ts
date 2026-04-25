import { createClient } from "@/lib/supabase/server";
import { lookupPscCapabilities } from "@/services/opportunity-scoring/psc-mapping";

const WEIGHTS = {
  naics: 0.35,
  setAside: 0.25,
  agency: 0.15,
  timeline: 0.15,
  psc: 0.1,
} as const;

type SamOpportunity = {
  id: string;
  title: string;
  full_parent_path_name: string | null;
  naics_code: string | null;
  naics_codes: string[] | null;
  type_of_set_aside: string | null;
  response_deadline: string | null;
  classification_code: string | null;
};

type ClientProfile = {
  workspace_id: string;
  naics_codes: string[] | null;
  certifications: string[] | null;
  preferred_agencies: string[] | null;
  excluded_agencies: string[] | null;
  core_capabilities: string[] | null;
};

export interface DeterministicScoreResult {
  samOpportunityId: string;
  naicsMatchScore: number;
  setAsideEligibilityScore: number;
  agencyAlignmentScore: number;
  timelineViabilityScore: number;
  pscDomainScore: number;
  overallScore: number;
  recommendation: "pursue" | "monitor" | "pass";
  isDisqualified: boolean;
  disqualificationReason: string | null;
}

function normalizeTextValues(values?: string[] | null): string[] {
  return (values || []).map((value) => value.trim().toLowerCase()).filter(Boolean);
}

function normalizeNaics(code?: string | null): string {
  return (code || "").replace(/\D/g, "").slice(0, 6);
}

function scoreNaics(opportunity: SamOpportunity, profile: ClientProfile): number {
  const profileCodes = (profile.naics_codes || []).map(normalizeNaics).filter(Boolean);
  const primaryCode = normalizeNaics(opportunity.naics_code);
  const allOppCodes = [primaryCode, ...((opportunity.naics_codes || []).map(normalizeNaics))]
    .filter(Boolean);

  if (profileCodes.length === 0 || allOppCodes.length === 0) return 0;

  if (allOppCodes.some((oppCode) => profileCodes.includes(oppCode))) return 100;

  const strongestPrefixScore = allOppCodes.reduce((best, oppCode) => {
    const scoreForCode = profileCodes.reduce((localBest, profileCode) => {
      if (oppCode.slice(0, 4) === profileCode.slice(0, 4)) return Math.max(localBest, 60);
      if (oppCode.slice(0, 3) === profileCode.slice(0, 3)) return Math.max(localBest, 30);
      if (oppCode.slice(0, 2) === profileCode.slice(0, 2)) return Math.max(localBest, 10);
      return localBest;
    }, 0);

    return Math.max(best, scoreForCode);
  }, 0);

  return strongestPrefixScore;
}

function normalizeSetAside(value?: string | null): string {
  return (value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

function certificationsToSet(values?: string[] | null): Set<string> {
  const normalized = normalizeTextValues(values);
  const results = new Set<string>();

  for (const cert of normalized) {
    if (["sb", "small business", "smallbusiness"].includes(cert)) results.add("SB");
    if (["8a", "8(a)"].includes(cert)) results.add("8A");
    if (["sdvosb", "sdvosbc", "sdvosbs"].includes(cert)) results.add("SDVOSB");
    if (["wosb", "edwosb"].includes(cert)) {
      results.add("WOSB");
      results.add("EDWOSB");
    }
    if (["hubzone", "hzc"].includes(cert)) results.add("HUBZONE");
  }

  return results;
}

function requiredSetAsideCert(setAside?: string | null): string | null {
  const normalized = normalizeSetAside(setAside);
  if (!normalized || normalized === "NONE" || normalized === "UNRESTRICTED") return null;

  if (normalized.includes("8A")) return "8A";
  if (normalized.includes("SDVOSB")) return "SDVOSB";
  if (normalized.includes("WOSB") || normalized.includes("EDWOSB")) return "WOSB";
  if (normalized === "HZC" || normalized.includes("HUBZONE")) return "HUBZONE";
  if (normalized === "SBA" || normalized === "SBP" || normalized.includes("SMALLBUS")) {
    return "SB";
  }

  return "UNKNOWN";
}

function scoreSetAside(opportunity: SamOpportunity, profile: ClientProfile): {
  score: number;
  disqualified: boolean;
  reason: string | null;
} {
  const requiredCert = requiredSetAsideCert(opportunity.type_of_set_aside);
  if (!requiredCert) {
    return { score: 70, disqualified: false, reason: null };
  }

  if (requiredCert === "UNKNOWN") {
    return { score: 40, disqualified: false, reason: null };
  }

  const certs = certificationsToSet(profile.certifications);
  const eligible = certs.has(requiredCert) || (requiredCert === "WOSB" && certs.has("EDWOSB"));

  if (eligible) return { score: 100, disqualified: false, reason: null };

  return {
    score: 0,
    disqualified: true,
    reason: `Ineligible for set-aside: ${opportunity.type_of_set_aside || "unknown"}`,
  };
}

function scoreAgency(opportunity: SamOpportunity, profile: ClientProfile): {
  score: number;
  disqualified: boolean;
  reason: string | null;
} {
  const agency = (opportunity.full_parent_path_name || "").toLowerCase();
  const excluded = normalizeTextValues(profile.excluded_agencies);
  const preferred = normalizeTextValues(profile.preferred_agencies);

  if (excluded.some((term) => agency.includes(term))) {
    return { score: 0, disqualified: true, reason: "Agency is excluded by profile" };
  }

  if (preferred.some((term) => agency.includes(term))) {
    return { score: 100, disqualified: false, reason: null };
  }

  return { score: 50, disqualified: false, reason: null };
}

function scoreTimeline(opportunity: SamOpportunity, now: Date): {
  score: number;
  disqualified: boolean;
  reason: string | null;
} {
  if (!opportunity.response_deadline) {
    return { score: 40, disqualified: false, reason: null };
  }

  const deadline = new Date(opportunity.response_deadline);
  if (Number.isNaN(deadline.getTime())) {
    return { score: 40, disqualified: false, reason: null };
  }

  if (deadline.getTime() < now.getTime()) {
    return { score: 0, disqualified: true, reason: "Response deadline has passed" };
  }

  const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 3) return { score: 20, disqualified: false, reason: null };
  if (diffDays <= 7) return { score: 50, disqualified: false, reason: null };
  if (diffDays <= 21) return { score: 90, disqualified: false, reason: null };
  if (diffDays <= 60) return { score: 100, disqualified: false, reason: null };

  return { score: 80, disqualified: false, reason: null };
}

function scorePsc(opportunity: SamOpportunity, profile: ClientProfile): number {
  const profileCapabilities = normalizeTextValues(profile.core_capabilities);
  if (profileCapabilities.length === 0) return 25;

  const mappedCapabilities = lookupPscCapabilities(opportunity.classification_code).map((v) =>
    v.toLowerCase()
  );

  if (mappedCapabilities.length === 0) return 25;

  const strictMatch = mappedCapabilities.some((mapped) =>
    profileCapabilities.some((capability) => capability.includes(mapped) || mapped.includes(capability))
  );

  if (strictMatch) return 100;

  const sectorMatch = mappedCapabilities.some((mapped) => {
    const mappedRoot = mapped.split(" ")[0];
    return profileCapabilities.some((capability) => capability.includes(mappedRoot));
  });

  if (sectorMatch) return 50;

  return 25;
}

export function scoreSingleOpportunity(
  opportunity: SamOpportunity,
  profile: ClientProfile,
  now = new Date()
): DeterministicScoreResult {
  const naicsMatchScore = scoreNaics(opportunity, profile);
  const setAsideResult = scoreSetAside(opportunity, profile);
  const agencyResult = scoreAgency(opportunity, profile);
  const timelineResult = scoreTimeline(opportunity, now);
  const pscDomainScore = scorePsc(opportunity, profile);

  const disqualifyReason =
    timelineResult.reason || agencyResult.reason || setAsideResult.reason || null;

  const isDisqualified = Boolean(disqualifyReason);

  const weighted =
    naicsMatchScore * WEIGHTS.naics +
    setAsideResult.score * WEIGHTS.setAside +
    agencyResult.score * WEIGHTS.agency +
    timelineResult.score * WEIGHTS.timeline +
    pscDomainScore * WEIGHTS.psc;

  const overallScore = isDisqualified ? 0 : Math.round(weighted);
  const recommendation: "pursue" | "monitor" | "pass" =
    overallScore >= 75 ? "pursue" : overallScore >= 50 ? "monitor" : "pass";

  return {
    samOpportunityId: opportunity.id,
    naicsMatchScore,
    setAsideEligibilityScore: setAsideResult.score,
    agencyAlignmentScore: agencyResult.score,
    timelineViabilityScore: timelineResult.score,
    pscDomainScore,
    overallScore,
    recommendation,
    isDisqualified,
    disqualificationReason: disqualifyReason,
  };
}

export async function scoreAllOpportunities(workspaceId: string): Promise<{
  scored: number;
  pursue: number;
  monitor: number;
  pass: number;
}> {
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("client_profiles")
    .select(
      "workspace_id,naics_codes,certifications,preferred_agencies,excluded_agencies,core_capabilities"
    )
    .eq("workspace_id", workspaceId)
    .single();

  if (profileError || !profile) {
    throw new Error(`Unable to load client profile for workspace ${workspaceId}`);
  }

  const { data: opportunities, error: opportunitiesError } = await supabase
    .from("sam_opportunities")
    .select(
      "id,title,full_parent_path_name,naics_code,naics_codes,type_of_set_aside,response_deadline,classification_code"
    );

  if (opportunitiesError) {
    throw new Error(opportunitiesError.message);
  }

  const now = new Date();
  const rows = (opportunities || []).map((opportunity) => {
    const score = scoreSingleOpportunity(opportunity, profile, now);

    return {
      sam_opportunity_id: score.samOpportunityId,
      workspace_id: workspaceId,
      naics_match_score: score.naicsMatchScore,
      set_aside_eligibility_score: score.setAsideEligibilityScore,
      agency_alignment_score: score.agencyAlignmentScore,
      timeline_viability_score: score.timelineViabilityScore,
      psc_domain_score: score.pscDomainScore,
      overall_score: score.overallScore,
      recommendation: score.recommendation,
      is_disqualified: score.isDisqualified,
      disqualification_reason: score.disqualificationReason,
      scored_at: now.toISOString(),
    };
  });

  if (rows.length === 0) {
    return { scored: 0, pursue: 0, monitor: 0, pass: 0 };
  }

  const { error: upsertError } = await supabase
    .from("sam_opportunity_scores")
    .upsert(rows, { onConflict: "sam_opportunity_id,workspace_id" });

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  const pursue = rows.filter((row) => row.recommendation === "pursue").length;
  const monitor = rows.filter((row) => row.recommendation === "monitor").length;
  const pass = rows.filter((row) => row.recommendation === "pass").length;

  return { scored: rows.length, pursue, monitor, pass };
}
