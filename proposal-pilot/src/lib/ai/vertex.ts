/**
 * Vertex AI — DEPRECATED
 *
 * All AI operations now route through Perplexity's APIs.
 * Import from '@/lib/ai/perplexity' instead.
 *
 * This file exists only to surface loud errors if any code still references it.
 */

const DEPRECATION_MESSAGE =
  "Vertex AI has been replaced by Perplexity Agent API. " +
  "Import from '@/lib/ai/perplexity' instead. " +
  "See CLAUDE.md for the new AI architecture.";

export function getChatModel(): never {
  throw new Error(DEPRECATION_MESSAGE);
}

export function getEmbeddingModel(): never {
  throw new Error(DEPRECATION_MESSAGE);
}
