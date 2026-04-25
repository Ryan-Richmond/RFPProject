import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership) {
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
      .eq("workspace_id", membership.workspace_id)
      .order("overall_score", { ascending: false });

    if (scoredSamError) {
      throw scoredSamError;
    }

    if ((scoredSamOpps || []).length > 0) {
      const transformed = (scoredSamOpps || []).map((row) => {
        const opp = row.sam_opportunities;
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
          status: row.is_disqualified ? "disqualified" : "active",
          opportunity_scores: [
            {
              overall_score: row.overall_score,
              recommendation: row.recommendation,
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
      .eq("workspace_id", membership.workspace_id)
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
