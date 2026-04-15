import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";

type ReadinessScore = "green" | "yellow" | "red";

async function ensureProposalDraft(
  solicitationId: string,
  workspaceId: string
) {
  const { supabase } = await getWorkspaceContext();

  const { data: existing } = await supabase
    .from("proposal_drafts")
    .select("*")
    .eq("solicitation_id", solicitationId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const { data: created, error } = await supabase
    .from("proposal_drafts")
    .insert({
      solicitation_id: solicitationId,
      workspace_id: workspaceId,
      status: "generating",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return created;
}

export async function GET() {
  try {
    const { supabase, user, workspaceId } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const { data: proposals, error } = await supabase
      .from("proposal_drafts")
      .select(
        `
        *,
        solicitations(*),
        proposal_sections(id),
        compliance_findings(id, status)
      `
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const solicitationIds = (proposals || []).map((proposal) => proposal.solicitation_id);
    const { data: requirements } = solicitationIds.length
      ? await supabase
          .from("extracted_requirements")
          .select("solicitation_id, readiness_score")
          .in("solicitation_id", solicitationIds)
      : { data: [] as Array<{ solicitation_id: string; readiness_score: string | null }> };

    const readinessBySolicitation = (requirements || []).reduce<
      Record<string, { green: number; yellow: number; red: number }>
    >((acc, requirement) => {
      if (!acc[requirement.solicitation_id]) {
        acc[requirement.solicitation_id] = { green: 0, yellow: 0, red: 0 };
      }

      const score = (requirement.readiness_score || "yellow") as ReadinessScore;
      if (score === "green" || score === "yellow" || score === "red") {
        acc[requirement.solicitation_id][score] += 1;
      }

      return acc;
    }, {});

    return NextResponse.json(
      (proposals || []).map((proposal) => ({
        ...proposal,
        requirements_count:
          readinessBySolicitation[proposal.solicitation_id]?.green ||
          readinessBySolicitation[proposal.solicitation_id]?.yellow ||
          readinessBySolicitation[proposal.solicitation_id]?.red
            ? Object.values(
                readinessBySolicitation[proposal.solicitation_id]
              ).reduce((sum, value) => sum + value, 0)
            : 0,
        readiness:
          readinessBySolicitation[proposal.solicitation_id] || {
            green: 0,
            yellow: 0,
            red: 0,
          },
      }))
    );
  } catch (error) {
    console.error("Proposals GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch proposals" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, workspaceId } = await getWorkspaceContext();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const body = await request.json();
    const solicitationId = body.solicitationId as string | undefined;

    if (!solicitationId) {
      return NextResponse.json(
        { error: "solicitationId is required" },
        { status: 400 }
      );
    }

    const { data: solicitation } = await supabase
      .from("solicitations")
      .select("id")
      .eq("id", solicitationId)
      .eq("workspace_id", workspaceId)
      .single();

    if (!solicitation) {
      return NextResponse.json(
        { error: "Solicitation not found" },
        { status: 404 }
      );
    }

    const proposal = await ensureProposalDraft(solicitationId, workspaceId);
    return NextResponse.json({ proposal }, { status: 201 });
  } catch (error) {
    console.error("Proposals POST error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create proposal",
      },
      { status: 500 }
    );
  }
}
