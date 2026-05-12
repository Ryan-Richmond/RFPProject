import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";

export async function GET() {
  try {
    const { supabase, user, workspaceId } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const { data: scoredSamOpps, error: scoredSamError } = await supabase
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
          type_of_set_aside,
          naics_codes,
          naics_code,
          source_url,
          description_url,
          posted_date,
          raw_payload
        )
      `
      )
      .eq("workspace_id", workspaceId)
      .order("overall_score", { ascending: false });

    if (scoredSamError) {
      throw scoredSamError;
    }

    if ((scoredSamOpps || []).length > 0) {
      const { data: overrides } = await supabase
        .from("sam_opportunity_recommendation_overrides")
        .select("sam_opportunity_id,override_recommendation,override_reason,updated_at")
        .eq("workspace_id", workspaceId);

      const overrideMap = new Map(
        (overrides || []).map((override) => [override.sam_opportunity_id, override])
      );

      const transformed = (scoredSamOpps || []).map((row) => {
        const opp = row.sam_opportunities;
        const override = overrideMap.get(opp.id);
        const recommendation = override?.override_recommendation || row.recommendation;
        const rawDescription =
          typeof opp.raw_payload?.description === "string"
            ? opp.raw_payload.description
            : null;
        const descriptionPreview =
          rawDescription && !/^https?:\/\//i.test(rawDescription)
            ? rawDescription.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240)
            : null;
        return {
          id: opp.id,
          title: opp.title,
          agency: opp.full_parent_path_name || "Unknown Agency",
          solicitation_number: opp.solicitation_number,
          response_deadline: opp.response_deadline,
          posted_date: opp.posted_date,
          set_aside_type: opp.type_of_set_aside,
          naics_codes:
            Array.isArray(opp.naics_codes) && opp.naics_codes.length > 0
              ? opp.naics_codes
              : opp.naics_code
                ? [opp.naics_code]
                : [],
          source_url: opp.source_url || opp.description_url,
          description_preview: descriptionPreview,
          estimated_value_min: row.ai_estimated_contract_value_min ?? null,
          estimated_value_max: row.ai_estimated_contract_value_max ?? null,
          status: row.is_disqualified ? "disqualified" : "active",
          opportunity_scores: [
            {
              overall_score: row.overall_score,
              recommendation,
              base_recommendation: row.recommendation,
              override_recommendation: override?.override_recommendation || null,
              override_reason: override?.override_reason || null,
              override_updated_at: override?.updated_at || null,
              score_rationale: row.ai_score_rationale || row.disqualification_reason,
            },
          ],
        };
      });

      return NextResponse.json(transformed);
    }

    // Fallback to legacy workspace-scoped opportunities until SAM scoring is populated.
    const { data: opportunities, error } = await supabase
      .from("opportunities")
      .select(
        `
        *,
        opportunity_scores(*)
      `
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const sorted = (opportunities || []).sort((a, b) => {
      const scoreA = a.opportunity_scores?.[0]?.overall_score ?? -1;
      const scoreB = b.opportunity_scores?.[0]?.overall_score ?? -1;
      return scoreB - scoreA;
    });

    return NextResponse.json(sorted);
  } catch (error) {
    console.error("Opportunities API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch opportunities" },
      { status: 500 }
    );
  }
}
