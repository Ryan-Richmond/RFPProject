import { GoogleGenAI } from "@google/genai";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  generateMockEmbedding,
  getMockAgentResponse,
  getMockSonarResponse,
  isAIMockMode,
} from "./mock";

export const GEMINI_MODEL = "gemini-flash-latest";
export const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
export const GEMINI_EMBEDDING_DIMENSIONS = 1024;

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is required. All AI operations are currently routing through Gemini for testing."
    );
  }
  return key;
}

function getGeminiClient() {
  return new GoogleGenAI({ apiKey: getApiKey() });
}

// ---- Types (matching perplexity.ts) ----

export interface AgentAPIOptions {
  input: string;
  instructions?: string;
  model?: string; // We will override this to GEMINI_MODEL
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
    // Non-blocking
  }
}

// ---- Core Agent API ----

export async function callAgentAPI(
  options: AgentAPIOptions,
  operationContext?: { workspaceId?: string; operationType?: string }
): Promise<AgentAPIResponse> {
  const model = GEMINI_MODEL;
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

  try {
    const ai = getGeminiClient();
    const systemInstruction = options.instructions;
    
    // Convert structured output request to Gemini format
    let responseSchema;
    if (options.structuredOutput?.schema) {
      // Basic JSON schema mapping. Gemini SDK accepts object structures for responseSchema
      // We pass the raw schema object here assuming it conforms
      responseSchema = options.structuredOutput.schema;
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: options.input,
      config: {
        systemInstruction,
        responseMimeType: options.structuredOutput ? "application/json" : "text/plain",
        responseSchema,
      },
    });

    const result: AgentAPIResponse = {
      outputText: response.text || "",
      citations: [], // Gemini doesn't return perplexity-style citations natively without search tool
      responseId: `gemini-${Date.now()}`,
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
  const model = GEMINI_MODEL;
  const startTime = Date.now();

  const opId = await logAgentOperation({
    workspaceId: operationContext?.workspaceId,
    operationType: operationContext?.operationType || "search",
    inputSummary: options.input,
    modelUsed: model,
  });

  if (isAIMockMode()) {
    const mockOpt: AgentAPIOptions = {
      input: options.input,
      instructions: options.instructions,
      model: options.model,
      tools: [{ type: "web_search" }],
    };
    const result = getMockAgentResponse(mockOpt, operationContext);
    await completeAgentOperation(opId, {
      outputSummary: `[MOCK] ${result.outputText}`,
      citationsCount: result.citations.length,
      durationMs: Date.now() - startTime,
    });
    return result;
  }

  try {
    const ai = getGeminiClient();

    let combinedInput = options.input;
    if (options.domainAllowlist?.length) {
      combinedInput += `\n\nPlease prioritize or restrict answers to the following domains: ${options.domainAllowlist.join(", ")}`;
    }
    if (options.recencyDays && options.recencyDays > 0) {
      combinedInput += `\n\nPlease prioritize recent information from the past ${options.recencyDays} days.`;
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: combinedInput,
      config: {
        systemInstruction: options.instructions,
        tools: [{ googleSearch: {} }] // Enable Google Search grounding
      },
    });

    // Extract citations from grounding metadata if available
    const citations: string[] = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    for (const chunk of groundingChunks) {
      if (chunk.web?.uri) {
        citations.push(chunk.web.uri);
      }
    }

    const result: AgentAPIResponse = {
      outputText: response.text || "",
      citations,
      responseId: `gemini-search-${Date.now()}`,
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

// ---- Sonar API — Fast Web-Grounded Q&A ----

export async function searchSonar(
  query: string
): Promise<{ answer: string; citations: string[] }> {
  if (isAIMockMode()) {
    return getMockSonarResponse(query);
  }

  const ai = getGeminiClient();

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: query,
    config: {
      systemInstruction: "You are a government contracting research assistant. Provide factual, cited information about agencies, incumbents, and recent awards.",
      tools: [{ googleSearch: {} }]
    },
  });

  const citations: string[] = [];
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  for (const chunk of groundingChunks) {
    if (chunk.web?.uri) {
      citations.push(chunk.web.uri);
    }
  }

  return {
    answer: response.text || "",
    citations,
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
    // We pass 1024 to match the expected PPLX dimension size in DB
    return texts.map((text) =>
      generateMockEmbedding(text, 1024)
    );
  }

  const ai = getGeminiClient();
  const embeddings: number[][] = [];

  // Gemini embedding API accepts an array of strings.
  // outputDimensionality matches the evidence_chunks.embedding vector(1024) column.
  const response = await ai.models.embedContent({
    model: GEMINI_EMBEDDING_MODEL,
    contents: texts,
    config: { outputDimensionality: GEMINI_EMBEDDING_DIMENSIONS },
  });

  if (response.embeddings) {
    for (const emb of response.embeddings) {
      if (emb.values) {
        embeddings.push(emb.values);
      }
    }
  }

  return embeddings;
}
