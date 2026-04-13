/**
 * Vertex AI client configuration
 *
 * Single client for both Claude (via Model Garden) and
 * Gemini Embeddings — consolidating API access through GCP.
 */

import { VertexAI } from "@google-cloud/vertexai";

let vertexAI: VertexAI | null = null;

function getVertexAI(): VertexAI {
  if (!vertexAI) {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

    if (!project) {
      throw new Error(
        "GOOGLE_CLOUD_PROJECT is required. See .env.local for setup instructions."
      );
    }

    vertexAI = new VertexAI({ project, location });
  }
  return vertexAI;
}

/**
 * Get Claude model for drafting, analysis, and compliance tasks.
 * Uses Anthropic models via Vertex AI Model Garden.
 */
export function getChatModel(model: "sonnet" | "opus" = "sonnet") {
  const ai = getVertexAI();
  const modelId =
    model === "opus"
      ? "claude-opus-4-6@20260401"
      : "claude-sonnet-4-6@20260401";

  return ai.getGenerativeModel({ model: modelId });
}

/**
 * Get embedding model for RAG / knowledge base indexing.
 * Uses Google's gemini-embedding-001 instead of OpenAI.
 */
export function getEmbeddingModel() {
  const ai = getVertexAI();
  return ai.getGenerativeModel({ model: "gemini-embedding-001" });
}
