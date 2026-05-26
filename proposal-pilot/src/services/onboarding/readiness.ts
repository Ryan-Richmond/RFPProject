import { createClient } from "@/lib/supabase/server";

export type OnboardingRung =
  | "public_baseline"
  | "minimum_evidence"
  | "rfp_specific_gaps"
  | "full_library";

export type OnboardingActionKind =
  | "run_public_research"
  | "upload_minimum_evidence"
  | "discover_opportunities"
  | "fill_rfp_gaps"
  | "continue_drafting"
  | "run_compliance";

export interface ReadinessItem {
  id: string;
  label: string;
  group: "minimum" | "high_impact" | "advanced";
  artifactTypes: string[];
  categories: string[];
  why: string;
  ready: boolean;
  matchedCount: number;
  neededForCurrentRfp?: boolean;
}

export interface OnboardingReadiness {
  readinessScore: number;
  currentRung: OnboardingRung;
  goodEnoughToStart: boolean;
  profile: {
    complete: boolean;
    score: number;
    hasCompanyName: boolean;
    hasBusinessDescription: boolean;
    hasCapabilities: boolean;
    hasNaics: boolean;
    hasCertifications: boolean;
  };
  publicBaseline: {
    status: "missing" | "running" | "complete" | "error";
    latestId: string | null;
    trustLevel: "public_unverified" | "sam_verified" | null;
  };
  evidence: {
    minimumReady: boolean;
    minimumReadyCount: number;
    minimumTotal: number;
    totalChunks: number;
    items: ReadinessItem[];
  };
  activeProposalGap: {
    proposalId: string;
    solicitationTitle: string;
    red: number;
    yellow: number;
    categories: string[];
  } | null;
  nextAction: {
    kind: OnboardingActionKind;
    label: string;
    description: string;
    href: string;
  };
}

export const READINESS_ITEMS: Omit<ReadinessItem, "ready" | "matchedCount" | "neededForCurrentRfp">[] = [
  {
    id: "capability_statement",
    label: "Capability statement",
    group: "minimum",
    artifactTypes: ["capability_statement", "corporate_overview"],
    categories: ["corporate_overview"],
    why: "Gives the system approved positioning, differentiators, and core capabilities.",
  },
  {
    id: "past_performance",
    label: "Past performance",
    group: "minimum",
    artifactTypes: ["past_performance"],
    categories: ["past_performance"],
    why: "Supplies the proof points evaluators expect and the drafter must cite.",
  },
  {
    id: "key_personnel_certs",
    label: "Key personnel and certifications",
    group: "minimum",
    artifactTypes: ["key_personnel", "certifications"],
    categories: ["key_personnel", "certifications"],
    why: "Supports staffing, eligibility, and compliance claims.",
  },
  {
    id: "technical_approach",
    label: "Technical approach library",
    group: "high_impact",
    artifactTypes: ["technical_approach"],
    categories: ["technical_approach"],
    why: "Speeds higher-quality technical volumes with less blank-page drafting.",
  },
  {
    id: "management_approach",
    label: "Management and staffing approach",
    group: "high_impact",
    artifactTypes: ["management", "staffing_approach"],
    categories: ["management"],
    why: "Improves governance, staffing, transition, risk, and quality sections.",
  },
  {
    id: "cybersecurity_posture",
    label: "Cybersecurity posture",
    group: "high_impact",
    artifactTypes: ["cybersecurity_posture"],
    categories: ["technical_approach", "certifications"],
    why: "Needed for many federal technical and compliance requirements.",
  },
  {
    id: "contract_vehicles",
    label: "Contract vehicles and socioeconomic proof",
    group: "advanced",
    artifactTypes: ["contract_vehicle", "socioeconomic_status"],
    categories: ["certifications"],
    why: "Improves eligibility, set-aside, and procurement-pathway reasoning.",
  },
  {
    id: "transition_risk_quality",
    label: "Transition, risk, and quality plans",
    group: "advanced",
    artifactTypes: ["transition_plan", "risk_playbook", "quality_management"],
    categories: ["management"],
    why: "Adds reusable, evaluator-friendly operational detail.",
  },
  {
    id: "innovation_cases",
    label: "Innovation and differentiator cases",
    group: "advanced",
    artifactTypes: ["innovation_case_study", "accelerator_catalog"],
    categories: ["technical_approach", "corporate_overview"],
    why: "Creates differentiation beyond minimum compliance.",
  },
];

function profileScore(profile: Record<string, unknown> | null) {
  const hasCompanyName = Boolean((profile?.company_name as string | undefined)?.trim());
  const hasBusinessDescription =
    ((profile?.business_description as string | undefined)?.trim().length || 0) >= 60;
  const hasCapabilities = ((profile?.core_capabilities as unknown[] | undefined)?.length || 0) >= 3;
  const hasNaics = ((profile?.naics_codes as unknown[] | undefined)?.length || 0) > 0;
  const hasCertifications = ((profile?.certifications as unknown[] | undefined)?.length || 0) > 0;
  const checks = [
    hasCompanyName,
    hasBusinessDescription,
    hasCapabilities,
    hasNaics,
    hasCertifications,
  ];

  return {
    complete: checks.every(Boolean),
    score: Math.round((checks.filter(Boolean).length / checks.length) * 100),
    hasCompanyName,
    hasBusinessDescription,
    hasCapabilities,
    hasNaics,
    hasCertifications,
  };
}

function requirementCategoriesToArtifactTypes(categories: string[]) {
  const out = new Set<string>();
  for (const category of categories) {
    if (category === "past_performance") out.add("past_performance");
    if (category === "management") out.add("management");
    if (category === "technical") out.add("technical_approach");
    if (category === "compliance") {
      out.add("certifications");
      out.add("cybersecurity_posture");
    }
  }
  return out;
}

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
      .select("id,category,artifact_type,trust_level")
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

  const profileReadiness = profileScore(profile || null);
  const latestResearch = researchRows?.[0] || null;

  const artifactCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  for (const chunk of chunks || []) {
    if (chunk.artifact_type) {
      artifactCounts.set(chunk.artifact_type, (artifactCounts.get(chunk.artifact_type) || 0) + 1);
    }
    if (chunk.category) {
      categoryCounts.set(chunk.category, (categoryCounts.get(chunk.category) || 0) + 1);
    }
  }

  const solicitationIds = (proposals || [])
    .map((proposal) => proposal.solicitation_id)
    .filter(Boolean);
  const { data: requirements } = solicitationIds.length
    ? await supabase
        .from("extracted_requirements")
        .select("solicitation_id,category,readiness_score")
        .eq("workspace_id", workspaceId)
        .in("solicitation_id", solicitationIds)
    : { data: [] as Array<{ solicitation_id: string; category: string; readiness_score: string | null }> };

  const requirementsBySolicitation = (requirements || []).reduce<
    Record<string, Array<{ category: string; readiness_score: string | null }>>
  >((acc, requirement) => {
    acc[requirement.solicitation_id] = acc[requirement.solicitation_id] || [];
    acc[requirement.solicitation_id].push(requirement);
    return acc;
  }, {});

  const activeProposalGap =
    (proposals || [])
      .map((proposal) => {
        const proposalRequirements = requirementsBySolicitation[proposal.solicitation_id] || [];
        const red = proposalRequirements.filter((r) => r.readiness_score === "red").length;
        const yellow = proposalRequirements.filter((r) => r.readiness_score === "yellow").length;
        if (red + yellow === 0) return null;
        const solicitation = Array.isArray(proposal.solicitations)
          ? proposal.solicitations[0]
          : proposal.solicitations;
        return {
          proposalId: proposal.id,
          solicitationTitle: solicitation?.title || "Active RFP",
          red,
          yellow,
          categories: Array.from(
            new Set(
              proposalRequirements
                .filter((r) => r.readiness_score === "red" || r.readiness_score === "yellow")
                .map((r) => r.category)
                .filter(Boolean)
            )
          ),
        };
      })
      .find(Boolean) || null;

  const neededArtifactTypes = requirementCategoriesToArtifactTypes(activeProposalGap?.categories || []);
  const items: ReadinessItem[] = READINESS_ITEMS.map((item) => {
    const artifactMatches = item.artifactTypes.reduce(
      (sum, artifactType) => sum + (artifactCounts.get(artifactType) || 0),
      0
    );
    const categoryMatches = item.categories.reduce(
      (sum, category) => sum + (categoryCounts.get(category) || 0),
      0
    );
    const matchedCount = artifactMatches + categoryMatches;
    return {
      ...item,
      matchedCount,
      ready: matchedCount > 0,
      neededForCurrentRfp: item.artifactTypes.some((artifactType) =>
        neededArtifactTypes.has(artifactType)
      ),
    };
  });

  const minimumItems = items.filter((item) => item.group === "minimum");
  const minimumReadyCount = minimumItems.filter((item) => item.ready).length;
  const minimumReady = minimumReadyCount === minimumItems.length;
  const hasAnalyzedRfpGap = Boolean(activeProposalGap);
  const hasAnyEvidence = (chunks || []).length > 0;

  let currentRung: OnboardingRung = "public_baseline";
  if (profileReadiness.complete && !minimumReady) {
    currentRung = "minimum_evidence";
  } else if (profileReadiness.complete && minimumReady && hasAnalyzedRfpGap) {
    currentRung = "rfp_specific_gaps";
  } else if (profileReadiness.complete && minimumReady) {
    currentRung = "full_library";
  }

  let nextAction: OnboardingReadiness["nextAction"];
  if (!profileReadiness.complete) {
    nextAction = {
      kind: "run_public_research",
      label: "Run public baseline",
      description: "Start with cited public data, then approve what belongs in your profile.",
      href: "/profile#public-baseline",
    };
  } else if (!minimumReady) {
    nextAction = {
      kind: "upload_minimum_evidence",
      label: "Upload minimum evidence",
      description: "Add a capability statement, past performance, and personnel/certification proof.",
      href: "/knowledge-base",
    };
  } else if (activeProposalGap) {
    nextAction = {
      kind: "fill_rfp_gaps",
      label: `Fill gaps for ${activeProposalGap.solicitationTitle}`,
      description: `${activeProposalGap.red} red and ${activeProposalGap.yellow} yellow requirements need stronger evidence.`,
      href: `/proposals/${activeProposalGap.proposalId}`,
    };
  } else if (!hasAnyEvidence) {
    nextAction = {
      kind: "upload_minimum_evidence",
      label: "Upload company evidence",
      description: "Add the source material drafts will be allowed to cite.",
      href: "/knowledge-base",
    };
  } else {
    nextAction = {
      kind: "discover_opportunities",
      label: "Discover opportunities",
      description: "Find opportunities that match your verified profile and evidence base.",
      href: "/opportunities",
    };
  }

  const profileContribution = profileReadiness.score * 0.35;
  const baselineContribution = latestResearch?.status === "complete" ? 15 : 0;
  const minimumContribution = (minimumReadyCount / minimumItems.length) * 35;
  const gapContribution = activeProposalGap ? 0 : 15;
  const readinessScore = Math.round(
    Math.min(100, profileContribution + baselineContribution + minimumContribution + gapContribution)
  );

  return {
    readinessScore,
    currentRung,
    goodEnoughToStart: profileReadiness.complete && minimumReady,
    profile: profileReadiness,
    publicBaseline: {
      status: latestResearch?.status || "missing",
      latestId: latestResearch?.id || null,
      trustLevel: latestResearch?.trust_level || null,
    },
    evidence: {
      minimumReady,
      minimumReadyCount,
      minimumTotal: minimumItems.length,
      totalChunks: (chunks || []).length,
      items,
    },
    activeProposalGap,
    nextAction,
  };
}
