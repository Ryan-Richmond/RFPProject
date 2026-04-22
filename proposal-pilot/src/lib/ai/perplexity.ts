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
import {
  generateMockEmbedding,
  getMockAgentResponse,
  getMockSonarResponse,
  isAIMockMode,
} from "./mock";

const PERPLEXITY_BASE_URL = "https://api.perplexity.ai";
const PERPLEXITY_CONTEXT_EMBEDDING_MODEL = "pplx-embed-context-v1-0.6b";
const PERPLEXITY_CONTEXT_EMBEDDING_DIMENSIONS = 1024;
const MAX_CONTEXT_EMBEDDING_BATCH_WORDS = 20000;

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
    | {
        type: "web_search";
        filters?: {
          search_domain_filter?: string[];
          search_after_date_filter?: string;
        };
      }
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

interface AgentAPIData {
  id?: string;
  output_text?: string;
  citations?: Array<string | { url?: string }>;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  output?: Array<{
    content?: Array<{
      text?: string;
      annotations?: Array<{
        url?: string;
      }>;
    }>;
  }>;
}

interface ContextualizedEmbeddingsResponse {
  data?: Array<{
    data?: Array<{
      embedding?: string;
    }>;
  }>;
}

function formatSearchDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function extractOutputText(data: AgentAPIData): string {
  if (typeof data.output_text === "string" && data.output_text.length > 0) {
    return data.output_text;
  }

  const outputText = (data.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .filter(Boolean)
    .join("\n");

  if (outputText.length > 0) {
    return outputText;
  }

  return data.choices?.[0]?.message?.content || "";
}

function extractCitations(data: AgentAPIData): string[] {
  const citations = new Set<string>();

  for (const citation of data.citations || []) {
    if (typeof citation === "string") {
      citations.add(citation);
      continue;
    }

    if (citation?.url) {
      citations.add(citation.url);
    }
  }

  for (const outputItem of data.output || []) {
    for (const contentItem of outputItem.content || []) {
      for (const annotation of contentItem.annotations || []) {
        if (annotation.url) {
          citations.add(annotation.url);
        }
      }
    }
  }

  return [...citations];
}

function splitIntoContextualizedEmbeddingBatches(texts: string[]): string[][] {
  const batches: string[][] = [];
  let currentBatch: string[] = [];
  let currentWordCount = 0;

  for (const text of texts) {
    const normalizedText = text.trim();

    if (!normalizedText) {
      continue;
    }

    const wordCount = normalizedText.split(/\s+/).length;
    const wouldOverflow =
      currentBatch.length > 0 &&
      currentWordCount + wordCount > MAX_CONTEXT_EMBEDDING_BATCH_WORDS;

    if (wouldOverflow) {
      batches.push(currentBatch);
      currentBatch = [];
      currentWordCount = 0;
    }

    currentBatch.push(normalizedText);
    currentWordCount += wordCount;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

function decodeBase64Int8Embedding(embedding: string): number[] {
  const bytes = Buffer.from(embedding, "base64");
  return Array.from(bytes, (value) => (value > 127 ? value - 256 : value));
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
  const model = options.model || "anthropic/claude-sonnet-4-6";
  const startTime = Date.now();

  const opId = await logAgentOperation({
    workspaceId: operationContext?.workspaceId,
    operationType: operationContext?.operationType || "analysis",
    inputSummary: options.input,
    modelUsed: model,
  });

  if (isAIMockMode()) {
    const result = getMockAgentResponse(options, operationContext);
    await completeAgentOperation(opId, {
      outputSummary: `[MOCK] ${result.outputText}`,
      citationsCount: result.citations.length,
      durationMs: Date.now() - startTime,
    });
    return result;
  }

  const apiKey = getApiKey();

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

    const data = (await response.json()) as AgentAPIData;

    const result: AgentAPIResponse = {
      outputText: extractOutputText(data),
      citations: extractCitations(data),
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
  const filters: NonNullable<Extract<NonNullable<AgentAPIOptions["tools"]>[number], { type: "web_search" }>["filters"]> = {};

  if (options.domainAllowlist?.length) {
    filters.search_domain_filter = options.domainAllowlist;
  }

  if (options.recencyDays && options.recencyDays > 0) {
    const publishedAfter = new Date();
    publishedAfter.setDate(publishedAfter.getDate() - options.recencyDays);
    filters.search_after_date_filter = formatSearchDate(publishedAfter);
  }

  const tools: AgentAPIOptions["tools"] = [
    {
      type: "web_search",
      ...(Object.keys(filters).length > 0 ? { filters } : {}),
    },
  ];

  return callAgentAPI(
    {
      input: options.input,
      instructions: options.instructions || undefined,
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
  if (isAIMockMode()) {
    return getMockSonarResponse(query);
  }

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
  if (texts.length === 0) {
    return [];
  }

  if (isAIMockMode()) {
    return texts.map((text) =>
      generateMockEmbedding(text, PERPLEXITY_CONTEXT_EMBEDDING_DIMENSIONS)
    );
  }

  const apiKey = getApiKey();
  const batches = splitIntoContextualizedEmbeddingBatches(texts);
  const embeddings: number[][] = [];

  for (const batch of batches) {
    const response = await fetch(
      `${PERPLEXITY_BASE_URL}/v1/contextualizedembeddings`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: PERPLEXITY_CONTEXT_EMBEDDING_MODEL,
          dimensions: PERPLEXITY_CONTEXT_EMBEDDING_DIMENSIONS,
          encoding_format: "base64_int8",
          input: [batch],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Perplexity Embeddings API error ${response.status}: ${errorText}`
      );
    }

    const data = (await response.json()) as ContextualizedEmbeddingsResponse;
    const batchEmbeddings =
      data.data?.[0]?.data?.map((item) => {
        if (!item.embedding) {
          throw new Error(
            "Perplexity Embeddings API returned an unexpected response shape."
          );
        }

        return decodeBase64Int8Embedding(item.embedding);
      }) || [];

    if (batchEmbeddings.length !== batch.length) {
      throw new Error(
        "Perplexity Embeddings API returned an unexpected number of embeddings."
      );
    }

    embeddings.push(...batchEmbeddings);
  }

  return embeddings;
}
