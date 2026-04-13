/**
 * Knowledge Base Indexer Service
 *
 * Turns raw company documents into retrievable proposal evidence.
 * See AGENTS.md — Skill 1 for full specification.
 */

// ---- Output Types (from AGENTS.md structured JSON) ----

export interface KnowledgeBaseIndexResult {
  status: "complete" | "partial" | "error";
  chunks_created: number;
  categories: {
    past_performance: number;
    technical_approach: number;
    key_personnel: number;
    corporate_overview: number;
    certifications: number;
    management: number;
  };
  duplicates_flagged: number;
  source_document_id: string;
}

export interface EvidenceChunk {
  id: string;
  source_document_id: string;
  content: string;
  category:
    | "past_performance"
    | "technical_approach"
    | "key_personnel"
    | "corporate_overview"
    | "certifications"
    | "management";
  metadata: {
    naics_codes?: string[];
    agency?: string;
    contract_type?: string;
    keywords?: string[];
    date?: string;
  };
  embedding?: number[];
}

// ---- Service Functions (stubs for Epic 2) ----

/**
 * Process an uploaded company document into retrievable evidence chunks.
 */
export async function indexDocument(
  documentId: string,
  workspaceId: string
): Promise<KnowledgeBaseIndexResult> {
  // TODO: Epic 2 implementation
  // 1. Fetch document from Supabase Storage
  // 2. Parse with pdf-parse / mammoth.js
  // 3. Segment into chunks
  // 4. Auto-tag with Claude Sonnet (via Vertex AI)
  // 5. Generate embeddings with gemini-embedding-001
  // 6. Store in Supabase pgvector
  // 7. Flag duplicates

  throw new Error("Knowledge Base Indexer not yet implemented — Epic 2");
}

/**
 * Search the evidence base for chunks relevant to a given requirement.
 */
export async function searchEvidence(
  query: string,
  workspaceId: string,
  limit: number = 5
): Promise<EvidenceChunk[]> {
  // TODO: Epic 2 implementation
  // 1. Generate query embedding with gemini-embedding-001
  // 2. Run pgvector similarity search
  // 3. Return top-k chunks with metadata

  throw new Error("Evidence search not yet implemented — Epic 2");
}
