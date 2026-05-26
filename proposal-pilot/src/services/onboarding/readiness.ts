import { createClient } from "@/lib/supabase/server";
import {
  computeOnboardingReadinessSnapshot,
  type OnboardingReadiness,
  type OnboardingRung,
  type OnboardingActionKind,
  type ReadinessItem,
} from "./readiness-core";

export type { OnboardingReadiness, OnboardingRung, OnboardingActionKind, ReadinessItem };
export { READINESS_ITEMS, computeOnboardingReadinessSnapshot } from "./readiness-core";

export async function getOnboardingReadiness(workspaceId: string): Promise<OnboardingReadiness> {
  const supabase = await createClient();

  const [
    { data: profile },
    { data: researchRows },
    { data: chunks },
    { data: proposals },
  ] = await Promise.all([
    supabase
      .from("client_profiles")
      .select("company_name,business_description,core_capabilities,naics_codes,certifications")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase
      .from("public_company_research")
      .select("id,status,trust_level,created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("evidence_chunks")
      .select("id,category,artifact_type,trust_level,created_at")
      .eq("workspace_id", workspaceId)
      .eq("is_excluded", false)
      .neq("trust_level", "public_unverified"),
    supabase
      .from("proposal_drafts")
      .select(
        `
        id,
        solicitation_id,
        solicitations(id,title)
      `
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const proposalInputs = (proposals || []).map((proposal) => {
    const solicitation = Array.isArray(proposal.solicitations)
      ? proposal.solicitations[0]
      : proposal.solicitations;
    return {
      id: proposal.id,
      solicitation_id: proposal.solicitation_id,
      solicitationTitle: solicitation?.title || "Active RFP",
    };
  });

  const solicitationIds = proposalInputs
    .map((proposal) => proposal.solicitation_id)
    .filter(Boolean);
  const { data: requirements } = solicitationIds.length
    ? await supabase
        .from("extracted_requirements")
        .select("solicitation_id,category,readiness_score")
        .eq("workspace_id", workspaceId)
        .in("solicitation_id", solicitationIds)
    : { data: [] };

  return computeOnboardingReadinessSnapshot({
    profile: profile || null,
    latestResearch: researchRows?.[0] || null,
    chunks: chunks || [],
    proposals: proposalInputs,
    requirements: requirements || [],
  });
}
