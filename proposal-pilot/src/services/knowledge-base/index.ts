/**
 * Knowledge Base Indexer Service
 *
 * Turns raw company documents into retrievable proposal evidence.
 * Uses Perplexity Agent API for tagging and Embeddings API for vectors.
 */

import { callAgentAPI, generateEmbeddings, callAgentAPIWithSearch } from "@/lib/ai/perplexity";
import { createClient } from "@/lib/supabase/server";
import { parseDocument } from "@/lib/documents/parser";

// ---- Output Types ----

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

// ---- Chunking Utility ----

function chunkText(text: string, chunkSize: number = 500, overlap: number = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

// ---- Service Functions ----

/**
 * Process an uploaded company document into retrievable evidence chunks.
 */
export async function indexDocument(
  documentId: string,
  workspaceId: string
): Promise<KnowledgeBaseIndexResult> {
  const supabase = await createClient();

  // 1. Fetch document from Supabase Storage
  const { data: doc } = await supabase
    .from("source_documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (!doc) throw new Error(`Document ${documentId} not found`);

  // Mark as processing
  await supabase
    .from("source_documents")
    .update({ processing_status: "processing" })
    .eq("id", documentId);

  try {
    // 2. Download and parse document
    const { data: fileData } = await supabase.storage
      .from("documents")
      .download(doc.file_path);

    if (!fileData) throw new Error("Failed to download document from storage");

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const parsed = await parseDocument(buffer, doc.filename);

    // 3. Chunk into ~500 token segments with 50 token overlap
    const chunks = chunkText(parsed.text, 500, 50);

    // 4. Auto-tag each chunk with Perplexity Agent API
    const tagResponse = await callAgentAPI(
      {
        input: `Classify each of the following document chunks into exactly one category and extract metadata.

Categories: past_performance, technical_approach, key_personnel, corporate_overview, certifications, management

For each chunk, return JSON array with objects:
{
  "chunkIndex": number,
  "category": string,
  "naics_codes": string[],
  "agency": string | null,
  "contract_type": string | null,
  "keywords": string[],
  "date": string | null
}

Document chunks:
${chunks.map((c, i) => `[Chunk ${i}]: ${c.slice(0, 300)}`).join("\n\n")}`,
        instructions: "Return ONLY valid JSON array. No markdown, no explanation.",
        model: "anthropic/claude-sonnet-4-6",
      },
      { workspaceId, operationType: "analysis" }
    );

    let tagResults: Array<{
      chunkIndex: number;
      category: string;
      naics_codes?: string[];
      agency?: string;
      contract_type?: string;
      keywords?: string[];
      date?: string;
    }>;

    try {
      const cleaned = tagResponse.outputText.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      tagResults = JSON.parse(cleaned);
    } catch {
      // Fallback: assign all chunks as corporate_overview
      tagResults = chunks.map((_, i) => ({
        chunkIndex: i,
        category: "corporate_overview",
        keywords: [],
      }));
    }

    // 5. Generate embeddings for all chunks
    const embeddings = await generateEmbeddings(chunks);

    // 6. Store in Supabase
    const categories = {
      past_performance: 0,
      technical_approach: 0,
      key_personnel: 0,
      corporate_overview: 0,
      certifications: 0,
      management: 0,
    };

    const rows = chunks.map((chunk, i) => {
      const tag = tagResults.find((t) => t.chunkIndex === i) || tagResults[i] || { category: "corporate_overview" };
      const category = tag.category as keyof typeof categories;
      if (category in categories) categories[category]++;

      return {
        workspace_id: workspaceId,
        source_document_id: documentId,
        content: chunk,
        category: category in categories ? category : "corporate_overview",
        naics_codes: tag.naics_codes || [],
        agency: tag.agency || null,
        contract_type: tag.contract_type || null,
        keywords: tag.keywords || [],
        content_date: tag.date || null,
        embedding: JSON.stringify(embeddings[i]),
      };
    });

    const { error: insertError } = await supabase.from("evidence_chunks").insert(rows);
    if (insertError) throw insertError;

    // 7. Mark document as complete
    await supabase
      .from("source_documents")
      .update({
        processing_status: "complete",
        extracted_text: parsed.text,
        page_count: parsed.metadata.pageCount || null,
      })
      .eq("id", documentId);

    return {
      status: "complete",
      chunks_created: chunks.length,
      categories,
      duplicates_flagged: 0,
      source_document_id: documentId,
    };
  } catch (error) {
    await supabase
      .from("source_documents")
      .update({
        processing_status: "error",
        processing_error: error instanceof Error ? error.message : "Unknown error",
      })
      .eq("id", documentId);

    return {
      status: "error",
      chunks_created: 0,
      categories: {
        past_performance: 0,
        technical_approach: 0,
        key_personnel: 0,
        corporate_overview: 0,
        certifications: 0,
        management: 0,
      },
      duplicates_flagged: 0,
      source_document_id: documentId,
    };
  }
}

/**
 * Search the evidence base for chunks relevant to a given requirement.
 */
export async function searchEvidence(
  query: string,
  workspaceId: string,
  limit: number = 5
): Promise<EvidenceChunk[]> {
  const supabase = await createClient();

  // Generate query embedding
  const [queryEmbedding] = await generateEmbeddings([query]);

  // Run pgvector similarity search using RPC
  const { data, error } = await supabase.rpc("match_evidence_chunks", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_workspace_id: workspaceId,
    match_count: limit,
  });

  if (error) {
    // Fallback: text search if RPC not available
    const { data: fallbackData } = await supabase
      .from("evidence_chunks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("is_excluded", false)
      .textSearch("content", query.split(" ").slice(0, 5).join(" & "))
      .limit(limit);

    return (fallbackData || []).map((row) => ({
      id: row.id,
      source_document_id: row.source_document_id,
      content: row.content,
      category: row.category,
      metadata: {
        naics_codes: row.naics_codes,
        agency: row.agency,
        contract_type: row.contract_type,
        keywords: row.keywords,
        date: row.content_date,
      },
    }));
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    source_document_id: row.source_document_id as string,
    content: row.content as string,
    category: row.category as EvidenceChunk["category"],
    metadata: {
      naics_codes: row.naics_codes as string[] | undefined,
      agency: row.agency as string | undefined,
      contract_type: row.contract_type as string | undefined,
      keywords: row.keywords as string[] | undefined,
      date: row.content_date as string | undefined,
    },
  }));
}

/**
 * Enrich a document with public context about referenced contracts and agencies.
 */
export async function enrichDocumentWithContext(
  docId: string,
  workspaceId: string
): Promise<void> {
  const supabase = await createClient();

  // Get existing chunks for this document
  const { data: chunks } = await supabase
    .from("evidence_chunks")
    .select("content, agency, keywords")
    .eq("source_document_id", docId)
    .eq("workspace_id", workspaceId)
    .limit(10);

  if (!chunks || chunks.length === 0) return;

  // Extract unique agencies and keywords for research
  const agencies = [...new Set(chunks.map((c) => c.agency).filter(Boolean))];
  const keywords = [...new Set(chunks.flatMap((c) => c.keywords || []))].slice(0, 10);

  if (agencies.length === 0 && keywords.length === 0) return;

  // Research public information about referenced entities
  const searchQuery = [
    agencies.length > 0 ? `agencies: ${agencies.join(", ")}` : "",
    keywords.length > 0 ? `topics: ${keywords.join(", ")}` : "",
    "recent contract awards government procurement",
  ]
    .filter(Boolean)
    .join(" ");

  const enrichment = await callAgentAPIWithSearch(
    {
      input: `Find public information about these government contracting entities and topics: ${searchQuery}. Focus on recent contract awards, agency priorities, and procurement trends.`,
      instructions: "Return factual information with citations. Focus on data useful for proposal writing.",
      domainAllowlist: ["sam.gov", "usaspending.gov", "fpds.gov"],
    },
    { workspaceId, operationType: "analysis" }
  );

  if (!enrichment.outputText) return;

  // Store enrichment as additional chunks
  const enrichmentChunks = chunkText(enrichment.outputText, 500, 50);
  const embeddings = await generateEmbeddings(enrichmentChunks);

  const rows = enrichmentChunks.map((chunk, i) => ({
    workspace_id: workspaceId,
    source_document_id: docId,
    content: `[ENRICHED CONTEXT] ${chunk}`,
    category: "corporate_overview" as const,
    naics_codes: [],
    keywords: ["enriched", "public_data"],
    embedding: JSON.stringify(embeddings[i]),
  }));

  await supabase.from("evidence_chunks").insert(rows);
}
