/**
 * Requirement → Capability Matcher
 *
 * Phase 1 of the Requirements Traceability Matrix work. See
 * docs/decisions/0001-gemini-for-development-ai-routing.md for AI routing.
 *
 * Pipeline (per requirement):
 *   1. Embed the requirement text with the same model used for evidence
 *      chunks (gemini-embedding-001 @ 1024 dims).
 *   2. pgvector cosine top-K against evidence_chunks via the
 *      `match_capabilities_for_requirement` RPC.
 *   3. One LLM call rates each candidate as strong / partial / weak / none and
 *      writes a one-sentence justification.
 *   4. Persist rows in `requirement_capability_matches`. Update the
 *      `matched_evidence_ids` denormalized cache and `readiness_score` on the
 *      requirement row.
 *
 * Auto-confirm rule (per ADR 0001 follow-up):
 *   similarity >= 0.78 AND llm_confidence === "strong"  → status "confirmed"
 *   otherwise                                            → status "suggested"
 */

import { callAgentAPI, generateEmbeddings } from "@/lib/ai/gemini";
import { createClient } from "@/lib/supabase/server";

const TOP_K = 5;
const AUTO_CONFIRM_SIMILARITY = 0.78;

type LLMConfidence = "strong" | "partial" | "weak" | "none";
type MatchStatus = "suggested" | "confirmed" | "overridden" | "rejected";

interface CandidateChunk {
  id: string;
  content: string;
  category: string;
  similarity: number;
}

interface RatedCandidate extends CandidateChunk {
  llm_confidence: LLMConfidence;
  llm_justification: string;
}

export interface MatchSummary {
  requirements_processed: number;
  matches_written: number;
  auto_confirmed: number;
  readiness_counts: { green: number; yellow: number; red: number };
}

/**
 * Embed and match every requirement on a solicitation. Idempotent — wipes and
 * rewrites match rows for each requirement processed.
 */
export async function matchRequirementsToCapabilities(
  solicitationId: string,
  workspaceId: string
): Promise<MatchSummary> {
  const supabase = await createClient();

  const { data: requirements, error: reqError } = await supabase
    .from("extracted_requirements")
    .select("id, requirement_id, category, text")
    .eq("solicitation_id", solicitationId)
    .eq("workspace_id", workspaceId);

  if (reqError) throw new Error(`Failed to load requirements: ${reqError.message}`);
  if (!requirements || requirements.length === 0) {
    return {
      requirements_processed: 0,
      matches_written: 0,
      auto_confirmed: 0,
      readiness_counts: { green: 0, yellow: 0, red: 0 },
    };
  }

  // Batch-embed all requirement texts in a single API call.
  const texts = requirements.map((r) => r.text);
  const embeddings = await generateEmbeddings(texts);
  if (embeddings.length !== requirements.length) {
    throw new Error(
      `Embedding count mismatch: expected ${requirements.length}, got ${embeddings.length}`
    );
  }

  let totalMatches = 0;
  let totalAutoConfirmed = 0;
  const readinessCounts = { green: 0, yellow: 0, red: 0 };

  for (let i = 0; i < requirements.length; i++) {
    const req = requirements[i];
    const embedding = embeddings[i];

    await supabase
      .from("extracted_requirements")
      .update({ embedding: JSON.stringify(embedding) })
      .eq("id", req.id);

    // Top-K capability candidates via cosine similarity.
    const { data: candidates, error: rpcError } = await supabase.rpc(
      "match_capabilities_for_requirement",
      {
        query_embedding: JSON.stringify(embedding),
        match_workspace_id: workspaceId,
        match_count: TOP_K,
      }
    );

    if (rpcError) {
      console.error(`match RPC failed for requirement ${req.requirement_id}:`, rpcError);
      continue;
    }

    const rawCandidates = (candidates || []) as Array<{
      id: string;
      content: string;
      category: string;
      similarity: number;
    }>;

    // Wipe existing match rows so we can rewrite idempotently.
    await supabase
      .from("requirement_capability_matches")
      .delete()
      .eq("requirement_id", req.id);

    let readiness: "green" | "yellow" | "red";
    let confirmedEvidenceIds: string[] = [];

    if (rawCandidates.length === 0) {
      readiness = "red";
    } else {
      const rated = await rateCandidatesWithLLM(req.text, rawCandidates, workspaceId);
      const rows = rated.map((c) => {
        const isAutoConfirm =
          c.similarity >= AUTO_CONFIRM_SIMILARITY && c.llm_confidence === "strong";
        const status: MatchStatus = isAutoConfirm ? "confirmed" : "suggested";
        if (isAutoConfirm) totalAutoConfirmed++;
        return {
          workspace_id: workspaceId,
          requirement_id: req.id,
          evidence_chunk_id: c.id,
          similarity_score: c.similarity,
          llm_confidence: c.llm_confidence,
          llm_justification: c.llm_justification,
          status,
        };
      });

      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from("requirement_capability_matches")
          .insert(rows);
        if (insertError) {
          console.error(
            `Insert matches failed for requirement ${req.requirement_id}:`,
            insertError
          );
        } else {
          totalMatches += rows.length;
        }
      }

      confirmedEvidenceIds = rows
        .filter((r) => r.status === "confirmed")
        .map((r) => r.evidence_chunk_id);

      const strongCount = rated.filter((c) => c.llm_confidence === "strong").length;
      const partialCount = rated.filter((c) => c.llm_confidence === "partial").length;
      if (strongCount > 0) readiness = "green";
      else if (partialCount > 0) readiness = "yellow";
      else readiness = "red";
    }

    readinessCounts[readiness]++;

    await supabase
      .from("extracted_requirements")
      .update({
        matched_evidence_ids: confirmedEvidenceIds,
        readiness_score: readiness,
      })
      .eq("id", req.id);
  }

  return {
    requirements_processed: requirements.length,
    matches_written: totalMatches,
    auto_confirmed: totalAutoConfirmed,
    readiness_counts: readinessCounts,
  };
}

/**
 * One LLM call rates the K candidates for a single requirement. Returns one
 * row per candidate with confidence + a one-sentence justification.
 *
 * Production target: `anthropic/claude-sonnet-4-6` via Perplexity Agent API.
 * Today the gemini.ts wrapper ignores the `model` param and routes to
 * gemini-flash-latest.
 */
async function rateCandidatesWithLLM(
  requirementText: string,
  candidates: CandidateChunk[],
  workspaceId: string
): Promise<RatedCandidate[]> {
  const numbered = candidates
    .map(
      (c, i) =>
        `Candidate ${i + 1} [category: ${c.category}, cosine: ${c.similarity.toFixed(3)}]:\n${c.content.slice(0, 1200)}`
    )
    .join("\n\n---\n\n");

  const prompt = `An RFP requirement and ${candidates.length} candidate capability evidence chunks from a company's knowledge base are below. For each candidate, decide how well it would support a proposal response to this requirement.

REQUIREMENT:
${requirementText}

${numbered}

For each candidate (1..${candidates.length}), return a JSON object with:
- "confidence": one of "strong" (directly responsive, specific, recent), "partial" (related but indirect or generic), "weak" (tangentially relevant), "none" (off-topic)
- "justification": a single sentence (max 30 words) explaining the rating from a proposal-reviewer's perspective

Return ONLY a JSON array of length ${candidates.length} in candidate order. No prose.`;

  const response = await callAgentAPI(
    {
      input: prompt,
      instructions:
        "You are a senior proposal-capture analyst. Be strict — most matches are 'partial' or 'weak'. Reserve 'strong' for evidence that would survive a reviewer's red-team. Return ONLY valid JSON.",
      model: "anthropic/claude-sonnet-4-6",
    },
    { workspaceId, operationType: "analysis" }
  );

  let parsed: Array<{ confidence?: string; justification?: string }> = [];
  try {
    const cleaned = response.outputText
      .replace(/```json?\n?/g, "")
      .replace(/```/g, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = [];
  }

  return candidates.map((c, i) => {
    const rating = parsed[i] || {};
    const confidence = normalizeConfidence(rating.confidence);
    const justification =
      typeof rating.justification === "string" && rating.justification.length > 0
        ? rating.justification.slice(0, 500)
        : "No justification returned by model.";
    return {
      ...c,
      llm_confidence: confidence,
      llm_justification: justification,
    };
  });
}

function normalizeConfidence(value: unknown): LLMConfidence {
  if (value === "strong" || value === "partial" || value === "weak" || value === "none") {
    return value;
  }
  return "weak";
}
