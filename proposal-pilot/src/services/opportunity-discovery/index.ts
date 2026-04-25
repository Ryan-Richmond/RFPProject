/**
 * Opportunity Discovery Service
 *
 * Proactively finds and scores government RFP opportunities
 * that match a client's profile using Perplexity Agent API.
 */

import { callAgentAPI, callAgentAPIWithSearch, searchSonar } from "@/lib/ai/perplexity";
import { createClient } from "@/lib/supabase/server";
import { logPipelineRun } from "@/services/opportunity-monitoring";
import { recordDeadLetter, withRetry } from "@/services/opportunity-monitoring/hardening";
import { scoreAllOpportunities } from "@/services/opportunity-scoring/deterministic";

// ---- Types ----

export interface DiscoveryResult {
  runId: string;
  opportunitiesFound: number;
  opportunitiesScored: number;
  opportunitiesCreated: number;
  opportunitiesRefreshed: number;
  opportunitiesSkipped: number;
  opportunities: DiscoveredOpportunity[];
}

export interface DiscoveredOpportunity {
  id: string;
  source: string;
  solicitationNumber?: string;
  title: string;
  agency: string;
  postedDate?: string;
  responseDeadline?: string;
  naicsCodes: string[];
  setAsideType?: string;
  estimatedValueMin?: number;
  estimatedValueMax?: number;
  contractType?: string;
  description?: string;
  sourceUrl?: string;
}

export interface OpportunityScore {
  id: string;
  opportunityId: string;
  naicsMatchScore: number;
  sizeFitScore: number;
  capabilityMatchScore: number;
  setAsideEligibilityScore: number;
  competitionLevelScore: number;
  timelineFitScore: number;
  overallScore: number;
  recommendation: "pursue" | "monitor" | "pass";
  scoreRationale: string;
  agencyIntel?: string;
  incumbentInfo?: string;
  competitiveLandscape?: string;
  citations: string[];
}

type SamOpportunityUpsertPayload = {
  notice_id: string | null;
  solicitation_number: string | null;
  title: string;
  full_parent_path_name: string;
  posted_date: string | null;
  response_deadline: string | null;
  naics_code: string | null;
  naics_codes: string[];
  type_of_set_aside: string | null;
  classification_code: string | null;
  source_url: string | null;
  description_url: string | null;
  raw_payload: Record<string, unknown>;
};

type OpportunitySaveResult = {
  id: string | null;
  action: "created" | "refreshed" | "skipped";
};

function normalizeSolicitationNumber(value?: string | null): string | null {
  const normalized = value
    ?.replace(/^solicitation\s*(number|#)?\s*[:#-]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  return normalized || null;
}

function normalizeSourceUrl(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const trackingParams = new Set([
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
    ]);

    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";

    for (const param of [...url.searchParams.keys()]) {
      if (trackingParams.has(param.toLowerCase())) {
        url.searchParams.delete(param);
      }
    }

    url.searchParams.sort();
    return url.toString();
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

function normalizeTitle(value?: string | null): string {
  return value?.replace(/\s+/g, " ").trim() || "Untitled Opportunity";
}

function normalizeAgency(value?: string | null): string {
  return value?.replace(/\s+/g, " ").trim() || "Unknown Agency";
}

function buildDiscoveryIdentity(payload: SamOpportunityUpsertPayload): string {
  if (payload.notice_id) {
    return `sam_gov:notice:${payload.notice_id}`;
  }

  if (payload.solicitation_number) {
    return `sam_gov:solicitation:${payload.solicitation_number}`;
  }

  if (payload.source_url) {
    return `sam_gov:url:${payload.source_url}`;
  }

  return [
    "sam_gov",
    "fallback",
    payload.title.toLowerCase(),
    payload.full_parent_path_name.toLowerCase(),
    payload.response_deadline || "",
  ].join(":");
}

async function findExistingSamOpportunityId(
  noticeId?: string | null,
  solicitationNumber?: string | null,
  sourceUrl?: string | null,
  fallback?: {
    title: string;
    agency: string;
    responseDeadline?: string | null;
  }
): Promise<string | null> {
  const supabase = await createClient();

  if (noticeId) {
    const { data } = await supabase
      .from("sam_opportunities")
      .select("id")
      .eq("notice_id", noticeId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (data?.[0]?.id) {
      return data[0].id;
    }
  }

  if (solicitationNumber) {
    const { data } = await supabase
      .from("sam_opportunities")
      .select("id")
      .eq("solicitation_number", solicitationNumber)
      .order("created_at", { ascending: true })
      .limit(1);

    if (data?.[0]?.id) {
      return data[0].id;
    }
  }

  if (sourceUrl) {
    const { data } = await supabase
      .from("sam_opportunities")
      .select("id")
      .eq("source_url", sourceUrl)
      .order("created_at", { ascending: true })
      .limit(1);

    if (data?.[0]?.id) {
      return data[0].id;
    }
  }

  if (fallback?.title && fallback.agency) {
    let query = supabase
      .from("sam_opportunities")
      .select("id")
      .eq("title", fallback.title)
      .eq("full_parent_path_name", fallback.agency)
      .order("created_at", { ascending: true })
      .limit(1);

    if (fallback.responseDeadline) {
      query = query.eq("response_deadline", fallback.responseDeadline);
    }

    const { data } = await query;

    if (data?.[0]?.id) {
      return data[0].id;
    }
  }

  return null;
}

async function saveDiscoveredOpportunity(
  payload: SamOpportunityUpsertPayload
): Promise<OpportunitySaveResult> {
  const supabase = await createClient();
  const normalizedPayload: SamOpportunityUpsertPayload = {
    ...payload,
    notice_id: payload.notice_id?.trim() || null,
    solicitation_number: normalizeSolicitationNumber(payload.solicitation_number),
    source_url: normalizeSourceUrl(payload.source_url),
    description_url: normalizeSourceUrl(payload.description_url),
    title: normalizeTitle(payload.title),
    full_parent_path_name: normalizeAgency(payload.full_parent_path_name),
    naics_code: payload.naics_code?.replace(/\D/g, "").slice(0, 6) || null,
    naics_codes: (payload.naics_codes || [])
      .map((code) => code.replace(/\D/g, "").slice(0, 6))
      .filter(Boolean),
  };

  const existingId = await findExistingSamOpportunityId(
    normalizedPayload.notice_id,
    normalizedPayload.solicitation_number,
    normalizedPayload.source_url,
    {
      title: normalizedPayload.title,
      agency: normalizedPayload.full_parent_path_name,
      responseDeadline: normalizedPayload.response_deadline,
    }
  );

  const query = existingId
    ? supabase.from("sam_opportunities").update(normalizedPayload).eq("id", existingId)
    : supabase.from("sam_opportunities").insert(normalizedPayload);

  const { data, error } = await query.select("id").single();

  if (error) {
    const recoveredId = await findExistingSamOpportunityId(
      normalizedPayload.notice_id,
      normalizedPayload.solicitation_number,
      normalizedPayload.source_url,
      {
        title: normalizedPayload.title,
        agency: normalizedPayload.full_parent_path_name,
        responseDeadline: normalizedPayload.response_deadline,
      }
    );

    if (recoveredId) {
      const { data: recovered } = await supabase
        .from("sam_opportunities")
        .update(normalizedPayload)
        .eq("id", recoveredId)
        .select("id")
        .single();

      return { id: recovered?.id || recoveredId, action: "refreshed" };
    }

    return { id: null, action: "skipped" };
  }

  return {
    id: data?.id || null,
    action: existingId ? "refreshed" : "created",
  };
}

// ---- Service Functions ----

/**
 * Discover opportunities from government RFP sources.
 */
export async function discoverOpportunities(
  workspaceId: string
): Promise<DiscoveryResult> {
  const startedAt = Date.now();
  const supabase = await createClient();

  // Get client profile for search filters
  const { data: profile } = await supabase
    .from("client_profiles")
    .select("*")
    .eq("workspace_id", workspaceId)
    .single();

  const naicsCodes = profile?.naics_codes || [];
  const certifications = profile?.certifications || [];
  const preferredAgencies = profile?.preferred_agencies || [];
  const excludedAgencies = profile?.excluded_agencies || [];

  // Create discovery run record
  const { data: run } = await supabase
    .from("discovery_runs")
    .insert({
      workspace_id: workspaceId,
      source: "sam_gov",
      status: "running",
    })
    .select("id")
    .single();

  const runId = run?.id || "";

  try {
    // Search SAM.gov for active solicitations
    const searchQuery = [
      "active government solicitations posted in last 30 days",
      naicsCodes.length > 0 ? `NAICS codes: ${naicsCodes.join(", ")}` : "",
      certifications.includes("8(a)") ? "8(a) set-aside" : "",
      certifications.includes("SDVOSB") ? "SDVOSB set-aside" : "",
      preferredAgencies.length > 0 ? `agencies: ${preferredAgencies.join(", ")}` : "",
      "federal procurement opportunities",
    ]
      .filter(Boolean)
      .join(", ");

    const samGovResults = await withRetry(
      () =>
        callAgentAPIWithSearch(
          {
            input: `Search for active government RFP opportunities on SAM.gov. ${searchQuery}

For each opportunity found, extract:
- notice_id
- solicitation_number
- title
- agency
- posted_date (ISO format)
- response_deadline (ISO format)
- naics_codes (array)
- naics_code
- set_aside_type
- classification_code
- description (brief)
- source_url
- description_url

Return a JSON array of opportunities. Return at least 5-10 results if available.`,
            instructions:
              "Search SAM.gov and related federal procurement sites. Return ONLY a valid JSON array.",
            domainAllowlist: ["sam.gov", "usaspending.gov"],
          },
          { workspaceId, operationType: "discovery" }
        ),
      { retries: 2, delayMs: 500 }
    );

    // Parse discovered opportunities
    let rawOpportunities: Array<Record<string, unknown>> = [];
    try {
      const cleaned = samGovResults.outputText
        .replace(/```json?\n?/g, "")
        .replace(/```/g, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      rawOpportunities = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // Try to extract any JSON arrays from the response
      const jsonMatch = samGovResults.outputText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          rawOpportunities = JSON.parse(jsonMatch[0]);
        } catch {
          rawOpportunities = [];
        }
      }
    }

    // Filter out excluded agencies
    if (excludedAgencies.length > 0) {
      rawOpportunities = rawOpportunities.filter(
        (opp) =>
          !excludedAgencies.some((ea: string) =>
            ((opp.agency as string) || "").toLowerCase().includes(ea.toLowerCase())
          )
      );
    }

    // Normalize and collapse duplicates inside a single discovery response before writing.
    let skippedDuplicateCount = 0;
    const dedupedOpportunities = new Map<string, SamOpportunityUpsertPayload>();

    for (const opp of rawOpportunities) {
      const naicsCodes = Array.isArray(opp.naics_codes)
        ? (opp.naics_codes as string[])
        : [];
      const primaryNaics =
        ((opp.naics_code as string) || naicsCodes[0] || "").replace(/\D/g, "").slice(0, 6) ||
        null;

      const payload: SamOpportunityUpsertPayload = {
        notice_id: ((opp.notice_id as string) || (opp.noticeId as string) || null),
        solicitation_number: normalizeSolicitationNumber(
          (opp.solicitation_number as string) || null
        ),
        title: normalizeTitle((opp.title as string) || null),
        full_parent_path_name: normalizeAgency((opp.agency as string) || null),
        posted_date: (opp.posted_date as string) || null,
        response_deadline: (opp.response_deadline as string) || null,
        naics_code: primaryNaics,
        naics_codes: naicsCodes,
        type_of_set_aside: (opp.set_aside_type as string) || null,
        classification_code: (opp.classification_code as string) || null,
        source_url: normalizeSourceUrl((opp.source_url as string) || null),
        description_url: normalizeSourceUrl((opp.description_url as string) || null),
        raw_payload: opp,
      };

      const identity = buildDiscoveryIdentity(payload);
      if (dedupedOpportunities.has(identity)) {
        skippedDuplicateCount += 1;
        continue;
      }

      dedupedOpportunities.set(identity, payload);
    }

    // Save to database
    const savedOpportunities: DiscoveredOpportunity[] = [];
    let createdCount = 0;
    let refreshedCount = 0;
    let skippedCount = skippedDuplicateCount;

    for (const opp of dedupedOpportunities.values()) {
      const saveResult = await saveDiscoveredOpportunity(opp);
      if (saveResult.action === "created") createdCount += 1;
      if (saveResult.action === "refreshed") refreshedCount += 1;
      if (saveResult.action === "skipped") skippedCount += 1;

      if (saveResult.id) {
        savedOpportunities.push({
          id: saveResult.id,
          source: "sam_gov",
          solicitationNumber: opp.solicitation_number || undefined,
          title: opp.title,
          agency: opp.full_parent_path_name,
          postedDate: opp.posted_date || undefined,
          responseDeadline: opp.response_deadline || undefined,
          naicsCodes: opp.naics_codes || (opp.naics_code ? [opp.naics_code] : []),
          setAsideType: opp.type_of_set_aside || undefined,
          description: (opp.raw_payload.description as string) || undefined,
          sourceUrl: opp.source_url || opp.description_url || undefined,
        });
      }
    }

    // Update run record
    await supabase
      .from("discovery_runs")
      .update({
        status: "completed",
        opportunities_found: savedOpportunities.length,
        opportunities_created: createdCount,
        opportunities_refreshed: refreshedCount,
        opportunities_skipped: skippedCount,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);

    await logPipelineRun({
      workspaceId,
      pipelineType: "discovery",
      status: "completed",
      durationMs: Date.now() - startedAt,
      rowsRead: rawOpportunities.length,
      rowsWritten: savedOpportunities.length,
      metadata: {
        opportunitiesCreated: createdCount,
        opportunitiesRefreshed: refreshedCount,
        opportunitiesSkipped: skippedCount,
      },
    });

    return {
      runId,
      opportunitiesFound: savedOpportunities.length,
      opportunitiesScored: 0,
      opportunitiesCreated: createdCount,
      opportunitiesRefreshed: refreshedCount,
      opportunitiesSkipped: skippedCount,
      opportunities: savedOpportunities,
    };
  } catch (error) {
    await supabase
      .from("discovery_runs")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);

    await logPipelineRun({
      workspaceId,
      pipelineType: "discovery",
      status: "failed",
      durationMs: Date.now() - startedAt,
      errorMessage: error instanceof Error ? error.message : "Unknown discovery error",
    });
    await recordDeadLetter({
      workspaceId,
      pipelineType: "discovery",
      entityType: "sam_discovery_run",
      entityId: runId || undefined,
      errorMessage: error instanceof Error ? error.message : "Unknown discovery error",
      payload: {
        runId,
      },
      retryCount: 2,
    });

    throw error;
  }
}

/**
 * Score an opportunity against the workspace's client profile.
 */
export async function scoreOpportunity(
  opportunityId: string,
  workspaceId: string
): Promise<OpportunityScore> {
  const supabase = await createClient();

  // Fetch opportunity
  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("*")
    .eq("id", opportunityId)
    .single();

  if (!opportunity) throw new Error(`Opportunity ${opportunityId} not found`);

  // Fetch client profile
  const { data: profile } = await supabase
    .from("client_profiles")
    .select("*")
    .eq("workspace_id", workspaceId)
    .single();

  // Step 1: Fetch agency intel via Sonar
  let agencyIntel = "";
  let agencyCitations: string[] = [];
  try {
    const sonarResult = await searchSonar(
      `${opportunity.agency} recent contract awards ${(opportunity.naics_codes || []).join(" ")} incumbent contractor site:usaspending.gov OR site:fpds.gov`
    );
    agencyIntel = sonarResult.answer;
    agencyCitations = sonarResult.citations;
  } catch {
    agencyIntel = "Agency intel unavailable";
  }

  // Step 2: Score via Agent API
  const scoreResponse = await callAgentAPI(
    {
      input: `Score this government contracting opportunity for a potential bidder.

OPPORTUNITY:
- Title: ${opportunity.title}
- Agency: ${opportunity.agency}
- NAICS codes: ${(opportunity.naics_codes || []).join(", ")}
- Set-aside: ${opportunity.set_aside_type || "unrestricted"}
- Estimated value: $${opportunity.estimated_value_min || "?"} - $${opportunity.estimated_value_max || "?"}
- Contract type: ${opportunity.contract_type || "N/A"}
- Deadline: ${opportunity.response_deadline || "N/A"}
- Description: ${opportunity.description || "N/A"}

CLIENT PROFILE:
${
  profile
    ? `- Company: ${profile.company_name || "N/A"}
- NAICS codes: ${(profile.naics_codes || []).join(", ")}
- Certifications: ${(profile.certifications || []).join(", ")}
- Revenue tier: ${profile.annual_revenue_tier || "N/A"}
- Employee tier: ${profile.employee_count_tier || "N/A"}
- Contract vehicles: ${(profile.past_contract_vehicles || []).join(", ")}
- Core capabilities: ${(profile.core_capabilities || []).join(", ")}
- Min contract value: $${profile.min_contract_value || 0}
- Max contract value: $${profile.max_contract_value || "unlimited"}`
    : "No client profile available — score conservatively"
}

AGENCY INTEL:
${agencyIntel}

Score each dimension 0-100:
Return JSON:
{
  "naicsMatchScore": number,
  "sizeFitScore": number,
  "capabilityMatchScore": number,
  "setAsideEligibilityScore": number,
  "competitionLevelScore": number,
  "timelineFitScore": number,
  "overallScore": number (weighted composite),
  "recommendation": "pursue" | "monitor" | "pass",
  "scoreRationale": "2-3 sentence explanation",
  "incumbentInfo": "known incumbent info or null",
  "competitiveLandscape": "brief competitive analysis"
}`,
      instructions:
        "Be realistic in scoring. Higher competition_level_score means FEWER competitors (more winnable). Return ONLY valid JSON.",
      model: "anthropic/claude-sonnet-4-6",
    },
    { workspaceId, operationType: "scoring" }
  );

  let scoreData: Record<string, unknown>;
  try {
    const cleaned = scoreResponse.outputText
      .replace(/```json?\n?/g, "")
      .replace(/```/g, "")
      .trim();
    scoreData = JSON.parse(cleaned);
  } catch {
    scoreData = {
      naicsMatchScore: 50,
      sizeFitScore: 50,
      capabilityMatchScore: 50,
      setAsideEligibilityScore: 50,
      competitionLevelScore: 50,
      timelineFitScore: 50,
      overallScore: 50,
      recommendation: "monitor",
      scoreRationale: "Unable to fully analyze — default scores applied",
    };
  }

  // Save to database
  const { data: saved } = await supabase
    .from("opportunity_scores")
    .upsert(
      {
        opportunity_id: opportunityId,
        workspace_id: workspaceId,
        naics_match_score: (scoreData.naicsMatchScore as number) || 0,
        size_fit_score: (scoreData.sizeFitScore as number) || 0,
        capability_match_score: (scoreData.capabilityMatchScore as number) || 0,
        set_aside_eligibility_score: (scoreData.setAsideEligibilityScore as number) || 0,
        competition_level_score: (scoreData.competitionLevelScore as number) || 0,
        timeline_fit_score: (scoreData.timelineFitScore as number) || 0,
        overall_score: (scoreData.overallScore as number) || 0,
        recommendation: (scoreData.recommendation as string) || "monitor",
        score_rationale: (scoreData.scoreRationale as string) || "",
        scoring_model: "claude-sonnet-4-6",
        agency_intel: agencyIntel,
        incumbent_info: (scoreData.incumbentInfo as string) || null,
        competitive_landscape: (scoreData.competitiveLandscape as string) || null,
        citations: agencyCitations,
        scored_at: new Date().toISOString(),
      },
      { onConflict: "opportunity_id,workspace_id" }
    )
    .select("id")
    .single();

  return {
    id: saved?.id || "",
    opportunityId,
    naicsMatchScore: (scoreData.naicsMatchScore as number) || 0,
    sizeFitScore: (scoreData.sizeFitScore as number) || 0,
    capabilityMatchScore: (scoreData.capabilityMatchScore as number) || 0,
    setAsideEligibilityScore: (scoreData.setAsideEligibilityScore as number) || 0,
    competitionLevelScore: (scoreData.competitionLevelScore as number) || 0,
    timelineFitScore: (scoreData.timelineFitScore as number) || 0,
    overallScore: (scoreData.overallScore as number) || 0,
    recommendation: (scoreData.recommendation as "pursue" | "monitor" | "pass") || "monitor",
    scoreRationale: (scoreData.scoreRationale as string) || "",
    agencyIntel,
    incumbentInfo: (scoreData.incumbentInfo as string) || undefined,
    competitiveLandscape: (scoreData.competitiveLandscape as string) || undefined,
    citations: agencyCitations,
  };
}

/**
 * Full discovery cycle: discover + score all new opportunities.
 */
export async function runFullDiscoveryCycle(
  workspaceId: string
): Promise<DiscoveryResult> {
  // Step 1: Discover
  const discovery = await discoverOpportunities(workspaceId);

  // Step 2: Run deterministic tier-1 scoring against centralized SAM opportunities.
  const scoringSummary = await scoreAllOpportunities(workspaceId);
  const scored = scoringSummary.scored;

  // Update run record with scoring count
  const supabase = await createClient();
  await supabase
    .from("discovery_runs")
    .update({ opportunities_scored: scored })
    .eq("id", discovery.runId);

  return {
    ...discovery,
    opportunitiesScored: scored,
  };
}
