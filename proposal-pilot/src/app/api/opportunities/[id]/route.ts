import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getOpportunityScoreTimeline,
  getRecommendationOverride,
  resolveRecommendationWithOverride,
} from "@/services/opportunity-scoring/explainability";

async function getWorkspaceIdForUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, workspaceId: null };
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  return {
    supabase,
    user,
    workspaceId: membership?.workspace_id || null,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, user, workspaceId } = await getWorkspaceIdForUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const { data: samScored, error: samError } = await supabase
      .from("sam_opportunity_scores")
      .select(
        `
        *,
        sam_opportunities!inner(
          id,
          title,
          solicitation_number,
          full_parent_path_name,
          response_deadline,
          posted_date,
          type_of_set_aside,
          naics_codes,
          naics_code,
          classification_code,
          source_url,
          description_url,
          raw_payload
        )
      `
      )
      .eq("workspace_id", workspaceId)
      .eq("sam_opportunity_id", id)
      .maybeSingle();

    if (samError) throw samError;

    const samOpp = Array.isArray(samScored?.sam_opportunities)
      ? samScored.sam_opportunities[0]
      : samScored?.sam_opportunities;
    if (samOpp) {
      const opp = samOpp;
      const [override, timeline] = await Promise.all([
        getRecommendationOverride(workspaceId, id),
        getOpportunityScoreTimeline(workspaceId, id, 10),
      ]);
      const effectiveRecommendation = resolveRecommendationWithOverride(
        samScored.recommendation,
        override
      );
      return NextResponse.json({
        id: opp.id,
        title: opp.title,
        agency: opp.full_parent_path_name || "Unknown Agency",
        solicitation_number: opp.solicitation_number,
        response_deadline: opp.response_deadline,
        posted_date: opp.posted_date,
        set_aside_type: opp.type_of_set_aside,
        contract_type: null,
        naics_codes:
          Array.isArray(opp.naics_codes) && opp.naics_codes.length > 0
            ? opp.naics_codes
            : opp.naics_code
              ? [opp.naics_code]
              : [],
        description:
          (typeof opp.raw_payload?.description === "string" && opp.raw_payload.description) ||
          null,
        source_url: opp.source_url || opp.description_url,
        status: samScored.is_disqualified ? "disqualified" : "active",
        opportunity_scores: [
          {
            overall_score: samScored.overall_score,
            naics_match_score: samScored.naics_match_score,
            size_fit_score: samScored.ai_size_fit_score || 0,
            capability_match_score: samScored.psc_domain_score,
            set_aside_eligibility_score: samScored.set_aside_eligibility_score,
            competition_level_score: samScored.ai_competition_level_score || 0,
            timeline_fit_score: samScored.timeline_viability_score,
            recommendation: effectiveRecommendation,
            base_recommendation: samScored.recommendation,
            override_recommendation: override?.override_recommendation || null,
            override_reason: override?.override_reason || null,
            override_updated_at: override?.updated_at || null,
            score_rationale: samScored.ai_score_rationale || samScored.disqualification_reason,
            agency_intel: samScored.agency_intel,
            incumbent_info: samScored.incumbent_info,
            competitive_landscape: samScored.competitive_landscape,
            citations: samScored.ai_citations,
            bid_readiness_score: samScored.ai_bid_readiness_score,
            delivery_complexity_score: samScored.ai_delivery_complexity_score,
            confidence: samScored.ai_confidence,
            estimated_contract_value_min: samScored.ai_estimated_contract_value_min,
            estimated_contract_value_max: samScored.ai_estimated_contract_value_max,
            score_timeline: timeline,
          },
        ],
      });
    }

    const { data: opportunity, error } = await supabase
      .from("opportunities")
      .select(
        `
        *,
        opportunity_scores(*)
      `
      )
      .eq("id", id)
      .single();

    if (error || !opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(opportunity);
  } catch (error) {
    console.error("Opportunity detail API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch opportunity" },
      { status: 500 }
    );
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, user, workspaceId } = await getWorkspaceIdForUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    let opportunity:
      | {
          workspace_id: string;
          solicitation_number: string | null;
          title: string;
          agency: string;
          response_deadline: string | null;
        }
      | null = null;

    const { data: samScored } = await supabase
      .from("sam_opportunity_scores")
      .select(
        `
        workspace_id,
        sam_opportunities!inner(
          solicitation_number,
          title,
          full_parent_path_name,
          response_deadline
        )
      `
      )
      .eq("workspace_id", workspaceId)
      .eq("sam_opportunity_id", id)
      .maybeSingle();

    const samOppPost = Array.isArray(samScored?.sam_opportunities)
      ? samScored.sam_opportunities[0]
      : samScored?.sam_opportunities;
    if (samOppPost) {
      opportunity = {
        workspace_id: workspaceId,
        solicitation_number: samOppPost.solicitation_number,
        title: samOppPost.title,
        agency: samOppPost.full_parent_path_name || "Unknown Agency",
        response_deadline: samOppPost.response_deadline,
      };
    }

    if (!opportunity) {
      const { data: legacyOpportunity } = await supabase
        .from("opportunities")
        .select("workspace_id, solicitation_number, title, agency, response_deadline")
        .eq("id", id)
        .single();

      opportunity = legacyOpportunity;
    }

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    const existingSolicitationQuery = opportunity.solicitation_number
      ? supabase
          .from("solicitations")
          .select("id")
          .eq("workspace_id", opportunity.workspace_id)
          .eq("solicitation_number", opportunity.solicitation_number)
          .maybeSingle()
      : supabase
          .from("solicitations")
          .select("id")
          .eq("workspace_id", opportunity.workspace_id)
          .eq("title", opportunity.title)
          .maybeSingle();

    const { data: existingSolicitation } = await existingSolicitationQuery;
    let solicitationId = existingSolicitation?.id || null;

    if (!solicitationId) {
      const { data: solicitation, error } = await supabase
        .from("solicitations")
        .insert({
          workspace_id: opportunity.workspace_id,
          solicitation_number: opportunity.solicitation_number,
          title: opportunity.title,
          agency: opportunity.agency,
          classification: "federal",
          due_date: opportunity.response_deadline,
          status: "analyzing",
        })
        .select("id")
        .single();

      if (error) throw error;
      solicitationId = solicitation?.id || null;
    }

    const { data: existingProposal } = await supabase
      .from("proposal_drafts")
      .select("id")
      .eq("workspace_id", opportunity.workspace_id)
      .eq("solicitation_id", solicitationId)
      .maybeSingle();

    let proposalId = existingProposal?.id || null;

    if (!proposalId) {
      const { data: proposal, error } = await supabase
        .from("proposal_drafts")
        .insert({
          workspace_id: opportunity.workspace_id,
          solicitation_id: solicitationId,
          status: "generating",
        })
        .select("id")
        .single();

      if (error) throw error;
      proposalId = proposal?.id || null;
    }

    return NextResponse.json({
      message: "Opportunity promoted to proposal workflow",
      solicitationId,
      proposalId,
    });
  } catch (error) {
    console.error("Opportunity analyze API error:", error);
    return NextResponse.json(
      { error: "Failed to promote opportunity" },
      { status: 500 }
    );
  }
}
