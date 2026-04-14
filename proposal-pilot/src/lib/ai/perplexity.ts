/**
 * Perplexity AI Client — ONLY AI provider for ProposalPilot
 *
 * All AI operations route through Perplexity's APIs:
 * - Agent API: POST https://api.perplexity.ai/v1/agent — analysis, drafting, compliance
 * - Sonar API: POST https://api.perplexity.ai/chat/completions — web-grounded Q&A
 * - Embeddings API: POST https://api.perplexity.ai/embeddings — knowledge base vectors
 *
 * Single env var: PERPLEXITY_API_KEY
 */

import { createClient as createServerClient } from "@/lib/supabase/server";

const PERPLEXITY_BASE_URL = "https://api.perplexity.ai";

function getApiKey(): string {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) {
    throw new Error(
      "PERPLEXITY_API_KEY is required. All AI operations route through Perplexity."
    );
  }
  return key;
}

// ---- Types ----

export interface AgentAPIOptions {
  input: string;
  instructions?: string;
  model?: string;
  tools?: Array<
    | { type: "web_search" }
    | { type: "fetch_url" }
    | { type: "function"; function: object }
  >;
  preset?: "pro-search" | "deep-research" | "advanced-deep-research";
  previousResponseId?: string;
  structuredOutput?: { schema: object };
}

export interface AgentAPIResponse {
  outputText: string;
  citations: string[];
  responseId: string;
}

export interface AgentSearchOptions {
  input: string;
  instructions?: string;
  model?: string;
  domainAllowlist?: string[];
  recencyDays?: number;
}

// ---- Agent Operation Logging ----

async function logAgentOperation(params: {
  workspaceId?: string;
  operationType: string;
  inputSummary: string;
  modelUsed: string;
}): Promise<string | null> {
  try {
    const supabase = await createServerClient();
    const { data } = await supabase
      .from("agent_operations")
      .insert({
        workspace_id: params.workspaceId || null,
        operation_type: params.operationType,
        status: "running",
        input_summary: params.inputSummary.slice(0, 500),
        model_used: params.modelUsed,
      })
      .select("id")
      .single();
    return data?.id || null;
  } catch {
    return null;
  }
}

async function completeAgentOperation(
  operationId: string | null,
  result: { outputSummary: string; citationsCount: number; durationMs: number; status?: string }
): Promise<void> {
  if (!operationId) return;
  try {
    const supabase = await createServerClient();
    await supabase
      .from("agent_operations")
      .update({
        status: result.status || "completed",
        output_summary: result.outputSummary.slice(0, 500),
        citations_count: result.citationsCount,
        duration_ms: result.durationMs,
        completed_at: new Date().toISOString(),
      })
      .eq("id", operationId);
  } catch {
    // Non-blocking — don't fail the operation
  }
}

// ---- Core Agent API ----

export async function callAgentAPI(
  options: AgentAPIOptions,
  operationContext?: { workspaceId?: string; operationType?: string }
): Promise<AgentAPIResponse> {
  const apiKey = getApiKey();
  const model = options.model || "anthropic/claude-sonnet-4-6";
  const startTime = Date.now();

  const opId = await logAgentOperation({
    workspaceId: operationContext?.workspaceId,
    operationType: operationContext?.operationType || "analysis",
    inputSummary: options.input,
    modelUsed: model,
  });

  try {
    const body: Record<string, unknown> = {
      model,
      input: options.input,
    };

    if (options.instructions) body.instructions = options.instructions;
    if (options.tools) body.tools = options.tools;
    if (options.preset) body.preset = options.preset;
    if (options.previousResponseId) body.previous_response_id = options.previousResponseId;
    if (options.structuredOutput) body.text = { format: { type: "json_schema", ...options.structuredOutput } };

    const response = await fetch(`${PERPLEXITY_BASE_URL}/v1/agent`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity Agent API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    const result: AgentAPIResponse = {
      outputText: data.output?.[0]?.content?.[0]?.text || data.output_text || data.choices?.[0]?.message?.content || "",
      citations: data.citations || [],
      responseId: data.id || "",
    };

    await completeAgentOperation(opId, {
      outputSummary: result.outputText,
      citationsCount: result.citations.length,
      durationMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    await completeAgentOperation(opId, {
      outputSummary: error instanceof Error ? error.message : "Unknown error",
      citationsCount: 0,
      durationMs: Date.now() - startTime,
      status: "failed",
    });
    throw error;
  }
}

// ---- Agent API with Web Search ----

export async function callAgentAPIWithSearch(
  options: AgentSearchOptions,
  operationContext?: { workspaceId?: string; operationType?: string }
): Promise<AgentAPIResponse> {
  const tools: AgentAPIOptions["tools"] = [{ type: "web_search" }];
  let instructions = options.instructions || "";

  if (options.domainAllowlist?.length) {
    instructions += `\n\nFocus search on these domains: ${options.domainAllowlist.join(", ")}`;
  }
  if (options.recencyDays) {
    instructions += `\n\nFocus on results from the last ${options.recencyDays} days.`;
  }

  return callAgentAPI(
    {
      input: options.input,
      instructions: instructions || undefined,
      model: options.model || "sonar-pro",
      tools,
    },
    operationContext
  );
}

// ---- Sonar API — Fast Web-Grounded Q&A ----

export async function searchSonar(
  query: string
): Promise<{ answer: string; citations: string[] }> {
  const apiKey = getApiKey();

  const response = await fetch(`${PERPLEXITY_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        {
          role: "system",
          content:
            "You are a government contracting research assistant. Provide factual, cited information about agencies, incumbents, and recent awards.",
        },
        {
          role: "user",
          content: query,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity Sonar API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return {
    answer: data.choices?.[0]?.message?.content || "",
    citations: data.citations || [],
  };
}

// ---- Embeddings API — Knowledge Base Vector Storage ----

export async function generateEmbedding(text: string): Promise<number[]> {
  const embeddings = await generateEmbeddings([text]);
  return embeddings[0];
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = getApiKey();

  const response = await fetch(`${PERPLEXITY_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-embedding",
      input: texts,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity Embeddings API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.data.map((item: { embedding: number[] }) => item.embedding);
}
