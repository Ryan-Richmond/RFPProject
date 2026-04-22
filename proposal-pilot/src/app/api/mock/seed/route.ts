import { NextResponse } from "next/server";
import { generateMockEmbedding, isAIMockMode } from "@/lib/ai/mock";
import {
  DEMO_COMPANY_DOCUMENT,
  DEMO_COMPLIANCE_MATRIX,
  DEMO_PROPOSAL_SECTIONS,
  DEMO_REQUIREMENTS,
  DEMO_RFP_DOCUMENT,
} from "@/lib/mock/demo-data";
import { getWorkspaceContext } from "@/lib/workspace";

const DEMO_COMPANY_FILENAME = "Demo Capability Statement.txt";
const DEMO_RFP_FILENAME = "Demo Cybersecurity Modernization RFP.txt";

function splitDemoChunks(text: string) {
  return text
    .split(/\n\n+/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 80);
}

function getCategory(chunk: string) {
  const lower = chunk.toLowerCase();
  if (lower.includes("past performance")) return "past_performance";
  if (lower.includes("technical approach")) return "technical_approach";
  if (lower.includes("management approach")) return "management";
  if (lower.includes("certifications")) return "certifications";
  return "corporate_overview";
}

export async function POST() {
  try {
    if (!isAIMockMode()) {
      return NextResponse.json(
        { error: "Mock seed is only available when AI_MODE=mock." },
        { status: 403 }
      );
    }

    const { supabase, user, workspaceId } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    await supabase.from("client_profiles").upsert(
      {
        workspace_id: workspaceId,
        company_name: "Northstar Digital Services",
        business_description:
          "Small federal technology integrator focused on secure cloud modernization, DevSecOps, and mission sustainment.",
        naics_codes: ["541512", "541519"],
        certifications: ["Small Business", "ISO 9001"],
        annual_revenue_tier: "10m_50m",
        employee_count_tier: "small",
        past_contract_vehicles: ["GSA MAS", "Army ITES-3S"],
        preferred_agencies: ["U.S. Army", "GSA", "U.S. Air Force"],
        excluded_agencies: [],
        min_contract_value: 500000,
        max_contract_value: 15000000,
        core_capabilities: [
          "Cloud modernization",
          "Cybersecurity engineering",
          "DevSecOps",
          "Data dashboards",
        ],
      },
      { onConflict: "workspace_id" }
    );

    let { data: companyDoc } = await supabase
      .from("source_documents")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("filename", DEMO_COMPANY_FILENAME)
      .maybeSingle();

    if (!companyDoc) {
      const { data } = await supabase
        .from("source_documents")
        .insert({
          workspace_id: workspaceId,
          document_type: "company",
          filename: DEMO_COMPANY_FILENAME,
          file_path: `${workspaceId}/company/mock-demo-capability-statement.txt`,
          file_size: DEMO_COMPANY_DOCUMENT.length,
          mime_type: "text/plain",
          processing_status: "complete",
          extracted_text: DEMO_COMPANY_DOCUMENT,
          page_count: 3,
        })
        .select("*")
        .single();
      companyDoc = data;
    }

    if (companyDoc) {
      const { count } = await supabase
        .from("evidence_chunks")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("source_document_id", companyDoc.id);

      if (!count) {
        const chunks = splitDemoChunks(DEMO_COMPANY_DOCUMENT);
        await supabase.from("evidence_chunks").insert(
          chunks.map((chunk, index) => ({
            workspace_id: workspaceId,
            source_document_id: companyDoc.id,
            content: chunk,
            category: getCategory(chunk),
            naics_codes: ["541512", "541519"],
            agency: index % 2 === 0 ? "U.S. Army" : "General Services Administration",
            contract_type: index % 2 === 0 ? "FFP" : "T&M",
            keywords: ["mock", "cloud", "cybersecurity", "proposal"],
            content_date: index % 2 === 0 ? "2025" : "2024",
            embedding: JSON.stringify(generateMockEmbedding(chunk)),
          }))
        );
      }
    }

    let { data: rfpDoc } = await supabase
      .from("source_documents")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("filename", DEMO_RFP_FILENAME)
      .maybeSingle();

    if (!rfpDoc) {
      const { data } = await supabase
        .from("source_documents")
        .insert({
          workspace_id: workspaceId,
          document_type: "rfp",
          filename: DEMO_RFP_FILENAME,
          file_path: `${workspaceId}/rfp/mock-demo-rfp.txt`,
          file_size: DEMO_RFP_DOCUMENT.length,
          mime_type: "text/plain",
          processing_status: "complete",
          extracted_text: DEMO_RFP_DOCUMENT,
          page_count: 8,
        })
        .select("*")
        .single();
      rfpDoc = data;
    }

    let { data: solicitation } = await supabase
      .from("solicitations")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("solicitation_number", "W91QF6-26-R-0007")
      .maybeSingle();

    const analysisResult = {
      solicitation_id: solicitation?.id || "mock",
      classification: "federal",
      agency: "U.S. Army Training and Doctrine Command",
      due_date: "2026-06-15T17:00:00Z",
      solicitationNumber: "W91QF6-26-R-0007",
      naicsCodes: ["541512", "541519"],
      setAsideType: "SB",
      estimatedValue: "$8M-$12M",
      periodOfPerformance: "Base year plus four option years",
      requirements: DEMO_REQUIREMENTS,
      evaluationCriteria: [
        { name: "Technical Approach", weight: 40, description: "Technical maturity" },
        { name: "Management Approach", weight: 25, description: "Delivery control" },
        { name: "Past Performance", weight: 25, description: "Relevant outcomes" },
        { name: "Price", weight: 10, description: "Reasonableness" },
      ],
      compliance_matrix: DEMO_COMPLIANCE_MATRIX,
      ambiguities: [
        {
          id: "AMB-001",
          text: "Legacy interface inventory is referenced but not provided.",
          section_ref: "Section C.3.2",
          suggested_question:
            "Please provide the authoritative legacy interface inventory for systems in scope.",
        },
      ],
      readiness_summary: { green: 4, yellow: 2, red: 0 },
    };

    if (!solicitation) {
      const { data } = await supabase
        .from("solicitations")
        .insert({
          workspace_id: workspaceId,
          source_document_id: rfpDoc?.id || null,
          solicitation_number: "W91QF6-26-R-0007",
          title: "Cybersecurity Modernization Support Services",
          agency: "U.S. Army Training and Doctrine Command",
          classification: "federal",
          due_date: "2026-06-15T17:00:00Z",
          status: "analyzed",
          analysis_result: analysisResult,
          win_probability: 72,
          key_win_factors: [
            "Strong technical evidence",
            "Clear management governance",
            "Aligned NAICS profile",
          ],
          key_risk_factors: ["Past performance contacts need validation"],
          bid_decision_recommendation: "bid",
        })
        .select("*")
        .single();
      solicitation = data;
    }

    if (solicitation) {
      await supabase
        .from("extracted_requirements")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("solicitation_id", solicitation.id);

      await supabase.from("extracted_requirements").insert(
        DEMO_REQUIREMENTS.map((requirement) => ({
          solicitation_id: solicitation.id,
          workspace_id: workspaceId,
          requirement_id: requirement.id,
          category: requirement.category,
          text: requirement.text,
          section_ref: requirement.section_ref,
          evaluation_weight: requirement.evaluation_weight,
          readiness_score: requirement.readiness_score,
          matched_evidence_ids: [],
        }))
      );

      await supabase
        .from("compliance_matrix_entries")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("solicitation_id", solicitation.id);

      await supabase.from("compliance_matrix_entries").insert(
        DEMO_COMPLIANCE_MATRIX.map((entry) => ({
          solicitation_id: solicitation.id,
          workspace_id: workspaceId,
          ...entry,
        }))
      );
    }

    let { data: proposal } = solicitation
      ? await supabase
          .from("proposal_drafts")
          .select("*")
          .eq("workspace_id", workspaceId)
          .eq("solicitation_id", solicitation.id)
          .maybeSingle()
      : { data: null };

    if (solicitation && !proposal) {
      const { data } = await supabase
        .from("proposal_drafts")
        .insert({
          solicitation_id: solicitation.id,
          workspace_id: workspaceId,
          version: 1,
          status: "draft",
          total_word_count: DEMO_PROPOSAL_SECTIONS.reduce(
            (sum, section) => sum + section.content.split(/\s+/).length,
            0
          ),
        })
        .select("*")
        .single();
      proposal = data;
    }

    if (proposal) {
      const { count } = await supabase
        .from("proposal_sections")
        .select("id", { count: "exact", head: true })
        .eq("proposal_draft_id", proposal.id);

      if (!count) {
        for (let index = 0; index < DEMO_PROPOSAL_SECTIONS.length; index++) {
          const section = DEMO_PROPOSAL_SECTIONS[index];
          const { data: savedSection } = await supabase
            .from("proposal_sections")
            .insert({
              proposal_draft_id: proposal.id,
              workspace_id: workspaceId,
              title: section.title,
              content: section.content,
              section_order: index + 1,
              requirement_mappings: section.requirement_mappings,
              placeholders: section.placeholders,
              confidence: section.confidence,
              word_count: section.content.split(/\s+/).length,
            })
            .select("id")
            .single();

          if (savedSection) {
            await supabase.from("proposal_section_revisions").insert({
              proposal_draft_id: proposal.id,
              proposal_section_id: savedSection.id,
              workspace_id: workspaceId,
              actor_type: "ai",
              change_type: "generated",
              section_title: section.title,
              content: section.content,
              review_status: "pending",
              metadata: { mock_seed: true, section_order: index + 1 },
            });
          }
        }
      }
    }

    await supabase.from("agent_operations").insert([
      {
        workspace_id: workspaceId,
        operation_type: "analysis",
        status: "completed",
        input_summary: "[MOCK] Demo RFP analysis",
        output_summary: "Extracted six mock requirements and four compliance matrix rows.",
        citations_count: 2,
        model_used: "mock",
        duration_ms: 180,
        completed_at: new Date().toISOString(),
      },
      {
        workspace_id: workspaceId,
        operation_type: "drafting",
        status: "completed",
        input_summary: "[MOCK] Demo draft generation",
        output_summary: "Generated four draft sections with evidence markers.",
        citations_count: 4,
        model_used: "mock",
        duration_ms: 220,
        completed_at: new Date().toISOString(),
      },
    ]);

    return NextResponse.json({
      status: "seeded",
      companyDocumentId: companyDoc?.id,
      rfpDocumentId: rfpDoc?.id,
      solicitationId: solicitation?.id,
      proposalId: proposal?.id,
    });
  } catch (error) {
    console.error("Mock seed error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to seed mock data" },
      { status: 500 }
    );
  }
}
