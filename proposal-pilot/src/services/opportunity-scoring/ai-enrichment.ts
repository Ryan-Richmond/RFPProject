import { callAgentAPI } from "@/lib/ai/perplexity";
import { createClient } from "@/lib/supabase/server";
import { logPipelineRun } from "@/services/opportunity-monitoring";

interface EnrichmentConfig {
  topK?: number;
  minDeterministicScore?: number;
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
    const opportunity = row.sam_opportunities as {
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

    try {
      const requirementsResponse = await callAgentAPI(
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
  "overallScore": number,
  "recommendation": "pursue|monitor|pass",
  "confidence": "high|medium|low",
  "rationale": string
}`,
          instructions: "Be concise and realistic. Output JSON only.",
          model: "anthropic/claude-sonnet-4-6",
        },
        { workspaceId, operationType: "ai_enrichment" }
      );

      const parsed = safeJsonParse(requirementsResponse.outputText);
      const requiredCapabilities = Array.isArray(parsed.requiredCapabilities)
        ? (parsed.requiredCapabilities as string[])
        : [];

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
          ai_overall_score: Number(parsed.overallScore || row.overall_score || 0),
          ai_recommendation:
            parsed.recommendation === "pursue" ||
            parsed.recommendation === "monitor" ||
            parsed.recommendation === "pass"
              ? parsed.recommendation
              : row.recommendation,
          ai_score_rationale: (parsed.rationale as string) || null,
          ai_citations: requirementsResponse.citations,
          ai_scored_at: new Date().toISOString(),
        })
        .eq("workspace_id", workspaceId)
        .eq("sam_opportunity_id", opportunity.id);

      enriched += 1;
    } catch (error) {
      failed += 1;
      console.error(`AI enrichment failed for opportunity ${opportunity.id}`, error);
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
    },
  });

  return {
    processed: rows.length,
    enriched,
    failed,
  };
}
