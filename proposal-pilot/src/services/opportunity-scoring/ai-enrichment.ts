import { callAgentAPI } from "@/lib/ai/perplexity";
import { createClient } from "@/lib/supabase/server";
import { logPipelineRun } from "@/services/opportunity-monitoring";
import { recordDeadLetter, withRetry } from "@/services/opportunity-monitoring/hardening";

interface EnrichmentConfig {
  topK?: number;
  minDeterministicScore?: number;
}

function clampScore(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function estimateProfileCompleteness(profile: {
  business_description: string | null;
  core_capabilities: string[] | null;
  certifications: string[] | null;
  naics_codes: string[] | null;
}): number {
  let total = 0;

  if ((profile.business_description || "").trim().length > 40) total += 25;
  if ((profile.core_capabilities || []).length >= 3) total += 25;
  if ((profile.certifications || []).length > 0) total += 25;
  if ((profile.naics_codes || []).length > 0) total += 25;

  return total;
}

function estimateBidReadinessScore(
  deadline: string | null,
  profileCompleteness: number,
  complexityScore: number
): number {
  if (!deadline) {
    return clampScore(55 + profileCompleteness * 0.3 - complexityScore * 0.2);
  }

  const due = new Date(deadline);
  if (Number.isNaN(due.getTime())) {
    return clampScore(50 + profileCompleteness * 0.25 - complexityScore * 0.2);
  }

  const diffDays = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  let timelineFactor = 0;

  if (diffDays < 0) timelineFactor = -70;
  else if (diffDays <= 3) timelineFactor = -45;
  else if (diffDays <= 7) timelineFactor = -25;
  else if (diffDays <= 14) timelineFactor = -10;
  else if (diffDays <= 30) timelineFactor = 5;
  else timelineFactor = 12;

  return clampScore(58 + timelineFactor + profileCompleteness * 0.3 - complexityScore * 0.25);
}

function safeJsonParse(text: string): Record<string, unknown> {
  try {
    const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}

function tokenizeCapabilities(values: string[]): string[] {
  const tokens = new Set<string>();

  for (const value of values) {
    const normalized = value.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
    for (const token of normalized.split(/\s+/)) {
      if (token.length >= 4) tokens.add(token);
    }
  }

  return [...tokens];
}

function rankEvidenceMatches(
  evidenceChunks: Array<{
    id: string;
    content: string;
    keywords: string[] | null;
    category: string;
    agency: string | null;
  }>,
  requiredCapabilities: string[]
) {
  const capabilityTokens = tokenizeCapabilities(requiredCapabilities);

  const scored = evidenceChunks
    .map((chunk) => {
      const haystack = [chunk.content, ...(chunk.keywords || []), chunk.category, chunk.agency || ""]
        .join(" ")
        .toLowerCase();

      const overlap = capabilityTokens.reduce(
        (sum, token) => (haystack.includes(token) ? sum + 1 : sum),
        0
      );

      return {
        chunkId: chunk.id,
        category: chunk.category,
        agency: chunk.agency,
        overlap,
        excerpt: chunk.content.slice(0, 280),
      };
    })
    .filter((item) => item.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 5);

  return scored;
}

export async function enrichTopOpportunitiesWithAI(
  workspaceId: string,
  config: EnrichmentConfig = {}
): Promise<{
  processed: number;
  enriched: number;
  failed: number;
}> {
  const startedAt = Date.now();
  const topK = config.topK ?? 50;
  const minScore = config.minDeterministicScore ?? 50;

  const supabase = await createClient();

  const [{ data: profile, error: profileError }, { data: rankedRows, error: rankedError }, { data: evidenceChunks, error: evidenceError }] =
    await Promise.all([
      supabase
        .from("client_profiles")
        .select("workspace_id,company_name,business_description,core_capabilities,naics_codes,certifications")
        .eq("workspace_id", workspaceId)
        .single(),
      supabase
        .from("sam_opportunity_scores")
        .select(
          `
          sam_opportunity_id,
          overall_score,
          recommendation,
          is_disqualified,
          sam_opportunities!inner(id,title,full_parent_path_name,naics_code,naics_codes,type_of_set_aside,response_deadline,classification_code,raw_payload)
        `
        )
        .eq("workspace_id", workspaceId)
        .eq("is_disqualified", false)
        .gte("overall_score", minScore)
        .order("overall_score", { ascending: false })
        .limit(topK),
      supabase
        .from("evidence_chunks")
        .select("id,content,keywords,category,agency")
        .eq("workspace_id", workspaceId)
        .eq("is_excluded", false)
        .limit(300),
    ]);

  if (profileError || !profile) {
    throw new Error(`Unable to load client profile for workspace ${workspaceId}`);
  }

  if (rankedError) throw new Error(rankedError.message);
  if (evidenceError) throw new Error(evidenceError.message);

  const rows = rankedRows || [];
  let enriched = 0;
  let failed = 0;

  for (const row of rows) {
    const rawOpp = row.sam_opportunities;
    const opportunity = (Array.isArray(rawOpp) ? rawOpp[0] : rawOpp) as {
      id: string;
      title: string;
      full_parent_path_name: string | null;
      naics_code: string | null;
      naics_codes: string[] | null;
      type_of_set_aside: string | null;
      response_deadline: string | null;
      classification_code: string | null;
      raw_payload: Record<string, unknown>;
    };

    if (!opportunity) continue;

    try {
      const profileCompleteness = estimateProfileCompleteness(profile);
      const requirementsResponse = await withRetry(
        () =>
          callAgentAPI(
            {
              input: `Extract the key bid requirements from this opportunity and evaluate capability fit.

OPPORTUNITY
- Title: ${opportunity.title}
- Agency: ${opportunity.full_parent_path_name || "Unknown"}
- NAICS: ${[opportunity.naics_code, ...(opportunity.naics_codes || [])].filter(Boolean).join(", ")}
- Set-aside: ${opportunity.type_of_set_aside || "None"}
- Deadline: ${opportunity.response_deadline || "Unknown"}
- Classification code: ${opportunity.classification_code || "Unknown"}
- Description: ${(opportunity.raw_payload?.description as string) || "Not provided"}

CLIENT PROFILE
- Company: ${profile.company_name || "Unknown"}
- Business description: ${profile.business_description || "Not provided"}
- Core capabilities: ${(profile.core_capabilities || []).join(", ")}
- Certifications: ${(profile.certifications || []).join(", ")}
- NAICS: ${(profile.naics_codes || []).join(", ")}

Return strict JSON:
{
  "requiredCapabilities": string[],
  "requirements": [{"requirement": string, "importance": "high|medium|low"}],
  "capabilityMatchScore": number,
  "sizeFitScore": number,
  "competitionLevelScore": number,
  "bidReadinessScore": number,
  "deliveryComplexityScore": number,
  "overallScore": number,
  "recommendation": "pursue|monitor|pass",
  "estimatedContractValueMin": number | null,
  "estimatedContractValueMax": number | null,
  "confidence": "high|medium|low",
  "rationale": string
}`,
              instructions: "Be concise and realistic. Output JSON only.",
              model: "anthropic/claude-sonnet-4-6",
            },
            { workspaceId, operationType: "ai_enrichment" }
          ),
        { retries: 2, delayMs: 500 }
      );

      const parsed = safeJsonParse(requirementsResponse.outputText);
      const requiredCapabilities = Array.isArray(parsed.requiredCapabilities)
        ? (parsed.requiredCapabilities as string[])
        : [];
      const complexityScore = clampScore(Number(parsed.deliveryComplexityScore || 0));
      const readinessHeuristic = estimateBidReadinessScore(
        opportunity.response_deadline,
        profileCompleteness,
        complexityScore
      );
      const aiBidReadiness = clampScore(Number(parsed.bidReadinessScore || readinessHeuristic));
      const bidReadinessScore = clampScore((aiBidReadiness + readinessHeuristic) / 2);
      const riskFlag =
        bidReadinessScore < 45
          ? "High readiness risk"
          : bidReadinessScore < 65
            ? "Moderate readiness risk"
            : "Low readiness risk";

      const evidenceMatches = rankEvidenceMatches(
        (evidenceChunks || []).map((chunk) => ({
          id: chunk.id,
          content: chunk.content,
          keywords: chunk.keywords,
          category: chunk.category,
          agency: chunk.agency,
        })),
        requiredCapabilities
      );

      await supabase.from("sam_opportunity_requirement_profiles").upsert(
        {
          workspace_id: workspaceId,
          sam_opportunity_id: opportunity.id,
          extracted_requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
          required_capabilities: requiredCapabilities,
          extraction_confidence:
            parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
              ? parsed.confidence
              : null,
          extraction_rationale: (parsed.rationale as string) || null,
          evidence_matches: evidenceMatches,
          citations: requirementsResponse.citations,
          extracted_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,sam_opportunity_id" }
      );

      await supabase
        .from("sam_opportunity_scores")
        .update({
          ai_capability_match_score: Number(parsed.capabilityMatchScore || 0),
          ai_size_fit_score: Number(parsed.sizeFitScore || 0),
          ai_competition_level_score: Number(parsed.competitionLevelScore || 0),
          ai_bid_readiness_score: bidReadinessScore,
          ai_delivery_complexity_score: complexityScore,
          ai_overall_score: Number(parsed.overallScore || row.overall_score || 0),
          ai_recommendation:
            parsed.recommendation === "pursue" ||
            parsed.recommendation === "monitor" ||
            parsed.recommendation === "pass"
              ? parsed.recommendation
              : row.recommendation,
          ai_score_rationale: `${(parsed.rationale as string) || ""}${
            parsed.rationale ? " " : ""
          }[${riskFlag}]`,
          ai_confidence:
            parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
              ? parsed.confidence
              : "medium",
          ai_estimated_contract_value_min: Number(parsed.estimatedContractValueMin || 0) || null,
          ai_estimated_contract_value_max: Number(parsed.estimatedContractValueMax || 0) || null,
          ai_citations: requirementsResponse.citations,
          ai_scored_at: new Date().toISOString(),
        })
        .eq("workspace_id", workspaceId)
        .eq("sam_opportunity_id", opportunity.id);

      enriched += 1;
    } catch (error) {
      failed += 1;
      console.error(`AI enrichment failed for opportunity ${opportunity.id}`, error);
      await recordDeadLetter({
        workspaceId,
        pipelineType: "ai_enrichment",
        entityType: "sam_opportunity",
        entityId: opportunity.id,
        errorMessage: error instanceof Error ? error.message : "Unknown enrichment error",
        payload: {
          title: opportunity.title,
          overallScore: row.overall_score,
        },
        retryCount: 2,
      });
    }
  }

  await logPipelineRun({
    workspaceId,
    pipelineType: "ai_enrichment",
    status: failed > 0 ? "completed" : "completed",
    durationMs: Date.now() - startedAt,
    rowsRead: rows.length,
    rowsWritten: enriched,
    metadata: {
      minScore,
      topK,
      failed,
      enriched,
    },
  });

  return {
    processed: rows.length,
    enriched,
    failed,
  };
}
