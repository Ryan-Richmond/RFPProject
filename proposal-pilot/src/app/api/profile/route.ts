import { NextRequest, NextResponse } from "next/server";
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

    const { data: profile } = await supabase
      .from("client_profiles")
      .select("*")
      .eq("workspace_id", workspaceId)
      .single();

    return NextResponse.json(profile || { workspace_id: workspaceId });
  } catch (error) {
    console.error("Profile GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
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

    const profileData = {
      workspace_id: workspaceId,
      company_name: body.company_name || null,
      business_description: body.business_description || null,
      naics_codes: body.naics_codes || [],
      certifications: body.certifications || [],
      annual_revenue_tier: body.annual_revenue_tier || null,
      employee_count_tier: body.employee_count_tier || null,
      past_contract_vehicles: body.past_contract_vehicles || [],
      preferred_agencies: body.preferred_agencies || [],
      excluded_agencies: body.excluded_agencies || [],
      min_contract_value: body.min_contract_value || 0,
      max_contract_value: body.max_contract_value || null,
      core_capabilities: body.core_capabilities || [],
    };

    const { data: profile, error } = await supabase
      .from("client_profiles")
      .upsert(profileData, { onConflict: "workspace_id" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Profile POST error:", error);
    return NextResponse.json(
      { error: "Failed to save profile" },
      { status: 500 }
    );
  }
}
