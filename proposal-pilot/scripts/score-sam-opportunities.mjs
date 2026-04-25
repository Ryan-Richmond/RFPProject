#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i++;
  }
  return args;
}

function toArray(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTextValues(values = []) {
  return values.map((value) => value.trim().toLowerCase()).filter(Boolean);
}

function normalizeNaics(code) {
  return String(code || "")
    .replace(/\D/g, "")
    .slice(0, 6);
}

function scoreNaics(opportunity, profile) {
  const profileCodes = (profile.naics_codes || []).map(normalizeNaics).filter(Boolean);
  const allOppCodes = [normalizeNaics(opportunity.naics_code), ...((opportunity.naics_codes || []).map(normalizeNaics))].filter(Boolean);

  if (!profileCodes.length || !allOppCodes.length) return 0;
  if (allOppCodes.some((code) => profileCodes.includes(code))) return 100;

  let best = 0;
  for (const oppCode of allOppCodes) {
    for (const profileCode of profileCodes) {
      if (oppCode.slice(0, 4) === profileCode.slice(0, 4)) best = Math.max(best, 60);
      else if (oppCode.slice(0, 3) === profileCode.slice(0, 3)) best = Math.max(best, 30);
      else if (oppCode.slice(0, 2) === profileCode.slice(0, 2)) best = Math.max(best, 10);
    }
  }

  return best;
}

function requiredSetAsideCert(value) {
  const normalized = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!normalized || normalized === "NONE" || normalized === "UNRESTRICTED") return null;
  if (normalized.includes("8A")) return "8A";
  if (normalized.includes("SDVOSB")) return "SDVOSB";
  if (normalized.includes("WOSB") || normalized.includes("EDWOSB")) return "WOSB";
  if (normalized === "HZC" || normalized.includes("HUBZONE")) return "HUBZONE";
  if (["SBA", "SBP"].includes(normalized) || normalized.includes("SMALLBUS")) return "SB";
  return "UNKNOWN";
}

function certificationSet(values = []) {
  const certs = new Set();
  for (const cert of normalizeTextValues(values)) {
    if (["sb", "smallbusiness", "small business"].includes(cert)) certs.add("SB");
    if (["8a", "8(a)"].includes(cert)) certs.add("8A");
    if (["sdvosb", "sdvosbc", "sdvosbs"].includes(cert)) certs.add("SDVOSB");
    if (["wosb", "edwosb"].includes(cert)) {
      certs.add("WOSB");
      certs.add("EDWOSB");
    }
    if (["hubzone", "hzc"].includes(cert)) certs.add("HUBZONE");
  }
  return certs;
}

function scoreSetAside(opportunity, profile) {
  const required = requiredSetAsideCert(opportunity.type_of_set_aside);
  if (!required) return { score: 70, disqualified: false, reason: null };
  if (required === "UNKNOWN") return { score: 40, disqualified: false, reason: null };

  const certs = certificationSet(profile.certifications || []);
  const eligible = certs.has(required) || (required === "WOSB" && certs.has("EDWOSB"));

  if (eligible) return { score: 100, disqualified: false, reason: null };
  return { score: 0, disqualified: true, reason: `Ineligible for set-aside: ${opportunity.type_of_set_aside || "unknown"}` };
}

function scoreAgency(opportunity, profile) {
  const agency = String(opportunity.full_parent_path_name || "").toLowerCase();
  const excluded = normalizeTextValues(profile.excluded_agencies || []);
  const preferred = normalizeTextValues(profile.preferred_agencies || []);

  if (excluded.some((term) => agency.includes(term))) {
    return { score: 0, disqualified: true, reason: "Agency is excluded by profile" };
  }
  if (preferred.some((term) => agency.includes(term))) return { score: 100, disqualified: false, reason: null };

  return { score: 50, disqualified: false, reason: null };
}

function scoreTimeline(opportunity, now) {
  if (!opportunity.response_deadline) return { score: 40, disqualified: false, reason: null };

  const deadline = new Date(opportunity.response_deadline);
  if (Number.isNaN(deadline.getTime())) return { score: 40, disqualified: false, reason: null };
  if (deadline.getTime() < now.getTime()) return { score: 0, disqualified: true, reason: "Response deadline has passed" };

  const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / 86400000);
  if (diffDays <= 3) return { score: 20, disqualified: false, reason: null };
  if (diffDays <= 7) return { score: 50, disqualified: false, reason: null };
  if (diffDays <= 21) return { score: 90, disqualified: false, reason: null };
  if (diffDays <= 60) return { score: 100, disqualified: false, reason: null };
  return { score: 80, disqualified: false, reason: null };
}

function scorePsc(opportunity, profile) {
  const capabilities = normalizeTextValues(profile.core_capabilities || []);
  if (!capabilities.length) return 25;

  const psc = String(opportunity.classification_code || "").toLowerCase();
  if (!psc) return 25;

  if (capabilities.some((capability) => psc.includes(capability.split(" ")[0]))) return 50;
  return 25;
}

function scoreOpportunity(opportunity, profile, now) {
  const naics = scoreNaics(opportunity, profile);
  const setAside = scoreSetAside(opportunity, profile);
  const agency = scoreAgency(opportunity, profile);
  const timeline = scoreTimeline(opportunity, now);
  const psc = scorePsc(opportunity, profile);

  const disqualificationReason = timeline.reason || agency.reason || setAside.reason || null;
  const isDisqualified = Boolean(disqualificationReason);

  const weighted = naics * 0.35 + setAside.score * 0.25 + agency.score * 0.15 + timeline.score * 0.15 + psc * 0.1;
  const overall = isDisqualified ? 0 : Math.round(weighted);
  const recommendation = overall >= 75 ? "pursue" : overall >= 50 ? "monitor" : "pass";

  return {
    sam_opportunity_id: opportunity.id,
    naics_match_score: naics,
    set_aside_eligibility_score: setAside.score,
    agency_alignment_score: agency.score,
    timeline_viability_score: timeline.score,
    psc_domain_score: psc,
    overall_score: overall,
    recommendation,
    is_disqualified: isDisqualified,
    disqualification_reason: disqualificationReason,
    scored_at: now.toISOString(),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const workspaceId = args["workspace-id"];

  if (!workspaceId) {
    console.error("Usage: node scripts/score-sam-opportunities.mjs --workspace-id <UUID> [--naics 541512,541519 --certs SB,SDVOSB --preferred-agencies Air --excluded-agencies IRS --capabilities it,cloud]");
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const inlineProfilePatch = {
    workspace_id: workspaceId,
    naics_codes: toArray(args.naics),
    certifications: toArray(args.certs),
    preferred_agencies: toArray(args["preferred-agencies"]),
    excluded_agencies: toArray(args["excluded-agencies"]),
    core_capabilities: toArray(args.capabilities),
    company_name: args["company-name"] || null,
  };

  const hasInlineProfile = Object.values(inlineProfilePatch).some((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value)
  );

  if (hasInlineProfile) {
    const { error: profileError } = await supabase
      .from("client_profiles")
      .upsert(inlineProfilePatch, { onConflict: "workspace_id" });

    if (profileError) {
      console.error("Failed to upsert inline profile:", profileError.message);
      process.exit(1);
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from("client_profiles")
    .select("workspace_id,naics_codes,certifications,preferred_agencies,excluded_agencies,core_capabilities")
    .eq("workspace_id", workspaceId)
    .single();

  if (profileError || !profile) {
    console.error("No client profile found for workspace", workspaceId);
    process.exit(1);
  }

  const { data: opportunities, error: opportunitiesError } = await supabase
    .from("sam_opportunities")
    .select("id,title,full_parent_path_name,naics_code,naics_codes,type_of_set_aside,response_deadline,classification_code");

  if (opportunitiesError) {
    console.error("Failed to fetch sam opportunities:", opportunitiesError.message);
    process.exit(1);
  }

  const now = new Date();
  const rows = (opportunities || []).map((opportunity) => ({
    workspace_id: workspaceId,
    ...scoreOpportunity(opportunity, profile, now),
  }));

  if (!rows.length) {
    console.log("No sam opportunities found to score.");
    return;
  }

  const { error: upsertError } = await supabase
    .from("sam_opportunity_scores")
    .upsert(rows, { onConflict: "sam_opportunity_id,workspace_id" });

  if (upsertError) {
    console.error("Failed to upsert scores:", upsertError.message);
    process.exit(1);
  }

  const summary = rows.reduce(
    (acc, row) => {
      acc[row.recommendation] += 1;
      if (row.is_disqualified) acc.disqualified += 1;
      return acc;
    },
    { pursue: 0, monitor: 0, pass: 0, disqualified: 0 }
  );

  console.log(`Scored ${rows.length} opportunities for workspace ${workspaceId}.`);
  console.table(summary);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
