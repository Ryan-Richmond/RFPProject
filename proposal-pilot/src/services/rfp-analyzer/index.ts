/**
 * RFP Analyzer Service
 *
 * Converts a solicitation into structured requirements and a compliance matrix.
 * Uses Perplexity Agent API for all AI operations.
 */

import { callAgentAPI, callAgentAPIWithSearch } from "@/lib/ai/perplexity";
import { parseDocument } from "@/lib/documents/parser";
import { createClient } from "@/lib/supabase/server";

// ---- Output Types ----

export interface RFPAnalysisResult {
  solicitation_id: string;
  classification: "federal" | "state_local";
  agency: string;
  due_date: string;
  solicitationNumber?: string;
  naicsCodes?: string[];
  setAsideType?: string;
  estimatedValue?: string;
  periodOfPerformance?: string;
  requirements: ExtractedRequirement[];
  evaluationCriteria: EvaluationCriterion[];
  compliance_matrix: ComplianceMatrixEntry[];
  ambiguities: Ambiguity[];
  readiness_summary: {
    green: number;
    yellow: number;
    red: number;
  };
}

export interface ExtractedRequirement {
  id: string;
  category:
    | "technical"
    | "management"
    | "past_performance"
    | "pricing"
    | "compliance"
    | "submission_format";
  text: string;
  section_ref: string;
  evaluation_weight: "high" | "medium" | "low";
  readiness_score: "green" | "yellow" | "red";
  matched_evidence_ids: string[];
}

export interface EvaluationCriterion {
  name: string;
  weight: number;
  description: string;
}

export interface ComplianceMatrixEntry {
  instruction_ref: string;
  instruction_text: string;
  evaluation_ref: string;
  evaluation_text: string;
  mapped_requirements: string[];
}

export interface Ambiguity {
  id: string;
  text: string;
  section_ref: string;
  suggested_question: string;
}

export interface WinProbabilityResult {
  winProbabilityScore: number;
  keyWinFactors: string[];
  keyRiskFactors: string[];
  recommendedBidDecision: "bid" | "no-bid" | "teaming-recommended";
}

// ---- Service Functions ----

/**
 * Analyze an uploaded RFP document.
 */
export async function analyzeRFP(
  solicitationId: string,
  workspaceId: string
): Promise<RFPAnalysisResult> {
  const supabase = await createClient();

  // Fetch solicitation and its source document
  const { data: solicitation } = await supabase
    .from("solicitations")
    .select("*, source_documents(*)")
    .eq("id", solicitationId)
    .single();

  if (!solicitation) throw new Error(`Solicitation ${solicitationId} not found`);

  // Get the document text (from source_documents.extracted_text or parse it)
  let rfpText = solicitation.source_documents?.extracted_text || "";

  if (!rfpText && solicitation.source_document_id) {
    const { data: doc } = await supabase
      .from("source_documents")
      .select("*")
      .eq("id", solicitation.source_document_id)
      .single();

    rfpText = doc?.extracted_text || "";

    if (!rfpText && doc?.file_path) {
      const { data: fileData } = await supabase.storage
        .from("documents")
        .download(doc.file_path);

      if (fileData) {
        const buffer = Buffer.from(await fileData.arrayBuffer());
        const parsedDocument = await parseDocument(buffer, doc.filename);
        rfpText = parsedDocument.text;

        await supabase
          .from("source_documents")
          .update({
            extracted_text: parsedDocument.text,
            page_count: parsedDocument.metadata.pageCount || null,
            processing_status: "complete",
            processing_error: null,
          })
          .eq("id", doc.id);
      }
    }
  }

  if (!rfpText) {
    throw new Error("No extracted text available for this RFP. Please re-upload the document.");
  }

  // Call Perplexity Agent API for comprehensive RFP analysis
  const analysisResponse = await callAgentAPI(
    {
      input: `Analyze this government RFP document and extract structured data.

RFP TEXT:
${rfpText.slice(0, 100000)}

Return a JSON object with these fields:
{
  "classification": "federal" or "state_local",
  "solicitationNumber": string,
  "agency": string,
  "dueDate": ISO date string,
  "setAsideType": "8(a)" | "SDVOSB" | "WOSB" | "HUBZone" | "SB" | "unrestricted" | null,
  "naicsCodes": string[],
  "estimatedValue": string or null,
  "periodOfPerformance": string or null,
  "requirements": [
    {
      "id": "REQ-001",
      "category": "technical" | "management" | "past_performance" | "pricing" | "compliance" | "submission_format",
      "text": string,
      "section_ref": string,
      "evaluation_weight": "high" | "medium" | "low"
    }
  ],
  "evaluationCriteria": [
    { "name": string, "weight": number (0-100), "description": string }
  ],
  "complianceMatrix": [
    {
      "instruction_ref": string,
      "instruction_text": string,
      "evaluation_ref": string,
      "evaluation_text": string,
      "mapped_requirements": string[]
    }
  ],
  "ambiguities": [
    { "id": "AMB-001", "text": string, "section_ref": string, "suggested_question": string }
  ]
}`,
      instructions:
        "You are an expert government contracting analyst. Extract ALL requirements, even implicit ones. For federal RFPs, look for FAR references, Section L/M structure, DFARS clauses. For state/local, identify jurisdiction, procurement code references, scoring rubric. Return ONLY valid JSON.",
      model: "anthropic/claude-sonnet-4-6",
    },
    { workspaceId, operationType: "analysis" }
  );

  // Parse the analysis result
  let parsed: Record<string, unknown>;
  try {
    const cleaned = analysisResponse.outputText.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Failed to parse RFP analysis response as JSON");
  }

  const requirements: ExtractedRequirement[] = ((parsed.requirements as Array<Record<string, unknown>>) || []).map(
    (r, i) => ({
      id: (r.id as string) || `REQ-${String(i + 1).padStart(3, "0")}`,
      category: (r.category as ExtractedRequirement["category"]) || "technical",
      text: (r.text as string) || "",
      section_ref: (r.section_ref as string) || "",
      evaluation_weight: (r.evaluation_weight as "high" | "medium" | "low") || "medium",
      readiness_score: "yellow" as const,
      matched_evidence_ids: [],
    })
  );

  const evaluationCriteria: EvaluationCriterion[] = ((parsed.evaluationCriteria as Array<Record<string, unknown>>) || []).map(
    (e) => ({
      name: (e.name as string) || "",
      weight: (e.weight as number) || 0,
      description: (e.description as string) || "",
    })
  );

  const complianceMatrix: ComplianceMatrixEntry[] = ((parsed.complianceMatrix as Array<Record<string, unknown>>) || []).map(
    (c) => ({
      instruction_ref: (c.instruction_ref as string) || "",
      instruction_text: (c.instruction_text as string) || "",
      evaluation_ref: (c.evaluation_ref as string) || "",
      evaluation_text: (c.evaluation_text as string) || "",
      mapped_requirements: (c.mapped_requirements as string[]) || [],
    })
  );

  const ambiguities: Ambiguity[] = ((parsed.ambiguities as Array<Record<string, unknown>>) || []).map((a) => ({
    id: (a.id as string) || "",
    text: (a.text as string) || "",
    section_ref: (a.section_ref as string) || "",
    suggested_question: (a.suggested_question as string) || "",
  }));

  const readiness_summary = {
    green: requirements.filter((r) => r.readiness_score === "green").length,
    yellow: requirements.filter((r) => r.readiness_score === "yellow").length,
    red: requirements.filter((r) => r.readiness_score === "red").length,
  };

  const result: RFPAnalysisResult = {
    solicitation_id: solicitationId,
    classification: (parsed.classification as "federal" | "state_local") || "federal",
    agency: (parsed.agency as string) || solicitation.agency || "Unknown",
    due_date: (parsed.dueDate as string) || "",
    solicitationNumber: (parsed.solicitationNumber as string) || solicitation.solicitation_number,
    naicsCodes: (parsed.naicsCodes as string[]) || [],
    setAsideType: parsed.setAsideType as string | undefined,
    estimatedValue: parsed.estimatedValue as string | undefined,
    periodOfPerformance: parsed.periodOfPerformance as string | undefined,
    requirements,
    evaluationCriteria,
    compliance_matrix: complianceMatrix,
    ambiguities,
    readiness_summary,
  };

  // Save to Supabase
  await supabase
    .from("solicitations")
    .update({
      status: "analyzed",
      classification: result.classification,
      agency: result.agency,
      solicitation_number: result.solicitationNumber,
      due_date: result.due_date || null,
      analysis_result: result as unknown as Record<string, unknown>,
    })
    .eq("id", solicitationId);

  // Save extracted requirements
  await supabase
    .from("extracted_requirements")
    .delete()
    .eq("solicitation_id", solicitationId);

  if (requirements.length > 0) {
    await supabase.from("extracted_requirements").insert(
      requirements.map((req) => ({
        solicitation_id: solicitationId,
        workspace_id: workspaceId,
        requirement_id: req.id,
        category: req.category,
        text: req.text,
        section_ref: req.section_ref,
        evaluation_weight: req.evaluation_weight,
        readiness_score: req.readiness_score,
        matched_evidence_ids: [],
      }))
    );
  }

  // Save compliance matrix entries
  await supabase
    .from("compliance_matrix_entries")
    .delete()
    .eq("solicitation_id", solicitationId);

  if (complianceMatrix.length > 0) {
    await supabase.from("compliance_matrix_entries").insert(
      complianceMatrix.map((entry) => ({
        solicitation_id: solicitationId,
        workspace_id: workspaceId,
        instruction_ref: entry.instruction_ref,
        instruction_text: entry.instruction_text,
        evaluation_ref: entry.evaluation_ref,
        evaluation_text: entry.evaluation_text,
        mapped_requirements: entry.mapped_requirements,
      }))
    );
  }

  return result;
}

/**
 * Estimate win probability for a solicitation using agency research.
 */
export async function estimateWinProbability(
  solicitationId: string,
  workspaceId: string
): Promise<WinProbabilityResult> {
  const supabase = await createClient();

  const { data: solicitation } = await supabase
    .from("solicitations")
    .select("*")
    .eq("id", solicitationId)
    .single();

  if (!solicitation) throw new Error(`Solicitation ${solicitationId} not found`);

  const analysis = solicitation.analysis_result as Record<string, unknown> | null;

  // Step 1: Research agency award history
  const agencyResearch = await callAgentAPIWithSearch(
    {
      input: `Research recent contract awards by ${solicitation.agency} for similar solicitations. Look for:
1. Who are the incumbent contractors?
2. What is the typical award value range?
3. How many bidders typically compete?
4. What are the agency's recent procurement priorities?

Solicitation: ${solicitation.title}
NAICS codes: ${(analysis?.naicsCodes as string[])?.join(", ") || "N/A"}
Set-aside: ${(analysis?.setAsideType as string) || "N/A"}`,
      instructions: "Focus on factual contract award data. Cite sources.",
      domainAllowlist: ["sam.gov", "usaspending.gov", "fpds.gov"],
    },
    { workspaceId, operationType: "scoring" }
  );

  // Step 2: Get client profile for comparison
  const { data: profile } = await supabase
    .from("client_profiles")
    .select("*")
    .eq("workspace_id", workspaceId)
    .single();

  // Step 3: Estimate win probability
  const winEstimate = await callAgentAPI(
    {
      input: `Based on the following information, estimate the win probability for this bid.

SOLICITATION:
- Title: ${solicitation.title}
- Agency: ${solicitation.agency}
- NAICS: ${(analysis?.naicsCodes as string[])?.join(", ") || "N/A"}
- Set-aside: ${(analysis?.setAsideType as string) || "N/A"}
- Estimated value: ${(analysis?.estimatedValue as string) || "N/A"}

AGENCY RESEARCH:
${agencyResearch.outputText}

CLIENT PROFILE:
${profile ? JSON.stringify(profile) : "No profile available"}

Return JSON:
{
  "winProbabilityScore": number (0-100),
  "keyWinFactors": string[],
  "keyRiskFactors": string[],
  "recommendedBidDecision": "bid" | "no-bid" | "teaming-recommended"
}`,
      instructions: "Be realistic and data-driven. Return ONLY valid JSON.",
      model: "anthropic/claude-sonnet-4-6",
    },
    { workspaceId, operationType: "scoring" }
  );

  let result: WinProbabilityResult;
  try {
    const cleaned = winEstimate.outputText.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    result = JSON.parse(cleaned);
  } catch {
    result = {
      winProbabilityScore: 50,
      keyWinFactors: ["Unable to fully analyze — insufficient data"],
      keyRiskFactors: ["Win probability estimate may be unreliable"],
      recommendedBidDecision: "bid",
    };
  }

  // Save to solicitation
  await supabase
    .from("solicitations")
    .update({
      win_probability: result.winProbabilityScore,
      key_win_factors: result.keyWinFactors,
      key_risk_factors: result.keyRiskFactors,
      bid_decision_recommendation: result.recommendedBidDecision,
      analysis_result: {
        ...(analysis || {}),
        win_probability: result.winProbabilityScore,
        key_win_factors: result.keyWinFactors,
        key_risk_factors: result.keyRiskFactors,
        bid_decision_recommendation: result.recommendedBidDecision,
      },
    })
    .eq("id", solicitationId);

  return result;
}
