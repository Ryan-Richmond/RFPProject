import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

// POST: Promote opportunity to full proposal workflow
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch opportunity
    const { data: opportunity } = await supabase
      .from("opportunities")
      .select("*")
      .eq("id", id)
      .single();

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    // Create a solicitation record from this opportunity
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

    return NextResponse.json({
      message: "Opportunity promoted to proposal workflow",
      solicitationId: solicitation?.id,
    });
  } catch (error) {
    console.error("Opportunity analyze API error:", error);
    return NextResponse.json(
      { error: "Failed to promote opportunity" },
      { status: 500 }
    );
  }
}
