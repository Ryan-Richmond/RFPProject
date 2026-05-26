/**
 * Knowledge Base Indexer Service
 *
 * Turns raw company documents into retrievable proposal evidence.
 * Uses Perplexity Agent API for tagging and Embeddings API for vectors.
 */

import { callAgentAPI, generateEmbeddings, callAgentAPIWithSearch } from "@/lib/ai/gemini";
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
  source_document_name?: string | null;
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

type EvidenceCategory = EvidenceChunk["category"];

interface LegacyProposalArtifact {
  artifact_type: string;
  artifact_title?: string;
  category: EvidenceCategory;
  confidence?: "high" | "medium" | "low";
  content: string;
  keywords?: string[];
  naics_codes?: string[];
  agency?: string | null;
  contract_type?: string | null;
  date?: string | null;
}

const VALID_CATEGORIES = new Set<EvidenceCategory>([
  "past_performance",
  "technical_approach",
  "key_personnel",
  "corporate_overview",
  "certifications",
  "management",
]);

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

function safeJsonExtract(text: string): unknown {
  const cleaned = text.replace(/```json?/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function defaultArtifactType(category: EvidenceCategory) {
  switch (category) {
    case "corporate_overview":
      return "capability_statement";
    case "certifications":
      return "certifications";
    case "key_personnel":
      return "key_personnel";
    case "past_performance":
      return "past_performance";
    case "technical_approach":
      return "technical_approach";
    default:
      return "management";
  }
}

async function extractLegacyProposalArtifacts(
  text: string,
  workspaceId: string
): Promise<LegacyProposalArtifact[]> {
  const response = await callAgentAPI(
    {
      input: `Extract reusable proposal evidence sections from this legacy proposal.

Return a JSON array. Each item must be:
{
  "artifact_type": "capability_statement" | "past_performance" | "key_personnel" | "certifications" | "management" | "technical_approach" | "cybersecurity_posture" | "quality_management" | "staffing_approach",
  "artifact_title": "short descriptive title",
  "category": "past_performance" | "technical_approach" | "key_personnel" | "corporate_overview" | "certifications" | "management",
  "confidence": "high" | "medium" | "low",
  "content": "self-contained reusable evidence excerpt",
  "keywords": ["..."],
  "naics_codes": ["541512"],
  "agency": "agency if named, else null",
  "contract_type": "contract type if named, else null",
  "date": "year/date if named, else null"
}

Extract 5-12 high-value artifacts. Prefer complete, proposal-ready evidence over tiny snippets.

LEGACY PROPOSAL TEXT:
${text.slice(0, 30000)}`,
      instructions:
        "Return JSON only. Never invent contract values, certifications, agencies, or personnel not present in the source text.",
      model: "anthropic/claude-sonnet-4-6",
    },
    { workspaceId, operationType: "legacy_proposal_extraction" }
  );

  const parsed = safeJsonExtract(response.outputText);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item): LegacyProposalArtifact | null => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const content = typeof row.content === "string" ? row.content.trim() : "";
      const rawCategory = String(row.category || "").trim() as EvidenceCategory;
      const category = VALID_CATEGORIES.has(rawCategory) ? rawCategory : "corporate_overview";
      if (content.length < 80) return null;
      const confidence = row.confidence === "high" || row.confidence === "low" ? row.confidence : "medium";
      return {
        artifact_type:
          typeof row.artifact_type === "string" && row.artifact_type.trim()
            ? row.artifact_type.trim()
            : defaultArtifactType(category),
        artifact_title:
          typeof row.artifact_title === "string" ? row.artifact_title.trim() : undefined,
        category,
        confidence,
        content,
        keywords: Array.isArray(row.keywords) ? row.keywords.map(String).slice(0, 12) : [],
        naics_codes: Array.isArray(row.naics_codes)
          ? row.naics_codes.map(String).map((code) => code.replace(/\D/g, "").slice(0, 6)).filter(Boolean)
          : [],
        agency: typeof row.agency === "string" ? row.agency : null,
        contract_type: typeof row.contract_type === "string" ? row.contract_type : null,
        date: typeof row.date === "string" ? row.date : null,
      };
    })
    .filter(Boolean) as LegacyProposalArtifact[];
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

    // 3. Chunk into reusable evidence. Legacy proposals get a second pass that
    // extracts high-value artifacts from one uploaded proposal.
    const legacyArtifacts =
      doc.ingestion_mode === "legacy_proposal"
        ? await extractLegacyProposalArtifacts(parsed.text, workspaceId)
        : [];
    const chunks = legacyArtifacts.length
      ? legacyArtifacts.map((artifact) => artifact.content)
      : chunkText(parsed.text, 500, 50);

    // 4. Auto-tag each chunk with Perplexity Agent API unless the legacy
    // extraction already supplied artifact metadata.
    let tagResults: Array<{
      chunkIndex: number;
      category: string;
      naics_codes?: string[];
      agency?: string;
      contract_type?: string;
      keywords?: string[];
      date?: string;
      artifact_type?: string;
      artifact_title?: string;
      artifact_confidence?: "high" | "medium" | "low";
    }>;

    if (legacyArtifacts.length > 0) {
      tagResults = legacyArtifacts.map((artifact, index) => ({
        chunkIndex: index,
        category: artifact.category,
        naics_codes: artifact.naics_codes || [],
        agency: artifact.agency || undefined,
        contract_type: artifact.contract_type || undefined,
        keywords: artifact.keywords || [],
        date: artifact.date || undefined,
        artifact_type: artifact.artifact_type,
        artifact_title: artifact.artifact_title,
        artifact_confidence: artifact.confidence || "medium",
      }));
    } else {
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
      const category = (tag.category in categories ? tag.category : "corporate_overview") as keyof typeof categories;
      if (category in categories) categories[category]++;

      return {
        workspace_id: workspaceId,
        source_document_id: documentId,
        content: chunk,
        category,
        naics_codes: tag.naics_codes || [],
        agency: tag.agency || null,
        contract_type: tag.contract_type || null,
        keywords: tag.keywords || [],
        content_date: tag.date || null,
        embedding: JSON.stringify(embeddings[i]),
        artifact_type: tag.artifact_type || defaultArtifactType(category),
        artifact_title: tag.artifact_title || null,
        artifact_confidence: tag.artifact_confidence || "medium",
        trust_level: "user_verified",
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
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : typeof error === "string"
        ? error
        : JSON.stringify(error);

    console.error("indexDocument failed:", errorMessage, error);

    await supabase
      .from("source_documents")
      .update({
        processing_status: "error",
        processing_error: errorMessage.slice(0, 1000),
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

  const rawRows: Array<Record<string, unknown>> = error
    ? await (async () => {
        const { data: fallbackData } = await supabase
          .from("evidence_chunks")
          .select("*")
          .eq("workspace_id", workspaceId)
          .eq("is_excluded", false)
          .neq("trust_level", "public_unverified")
          .textSearch("content", query.split(" ").slice(0, 5).join(" & "))
          .limit(limit);
        return fallbackData || [];
      })()
    : (data || []);

  const docIds = Array.from(
    new Set(
      rawRows
        .map((row) => row.source_document_id as string | null | undefined)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );

  const docNameById = new Map<string, string>();
  if (docIds.length > 0) {
    const { data: docs } = await supabase
      .from("source_documents")
      .select("id, filename")
      .in("id", docIds);
    for (const doc of docs || []) {
      if (doc?.id && doc?.filename) {
        docNameById.set(doc.id as string, doc.filename as string);
      }
    }
  }

  return rawRows.map((row) => ({
    id: row.id as string,
    source_document_id: row.source_document_id as string,
    source_document_name:
      docNameById.get(row.source_document_id as string) || null,
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
