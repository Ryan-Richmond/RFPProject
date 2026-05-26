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
  freshnessMonths: number;
  ready: boolean;
  stale: boolean;
  matchedCount: number;
  freshCount: number;
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

export interface ReadinessProfileInput {
  company_name?: string | null;
  business_description?: string | null;
  core_capabilities?: unknown[] | null;
  naics_codes?: unknown[] | null;
  certifications?: unknown[] | null;
}

export interface ReadinessResearchInput {
  id: string;
  status: "running" | "complete" | "error";
  trust_level: "public_unverified" | "sam_verified";
}

export interface ReadinessChunkInput {
  id?: string;
  category?: string | null;
  artifact_type?: string | null;
  trust_level?: "user_verified" | "sam_verified" | "public_unverified" | string | null;
  created_at?: string | null;
}

export interface ReadinessProposalInput {
  id: string;
  solicitation_id: string;
  solicitationTitle: string;
}

export interface ReadinessRequirementInput {
  solicitation_id: string;
  category?: string | null;
  readiness_score?: string | null;
}

export const READINESS_ITEMS: Omit<
  ReadinessItem,
  "ready" | "stale" | "matchedCount" | "freshCount" | "neededForCurrentRfp"
>[] = [
  {
    id: "capability_statement",
    label: "Capability statement",
    group: "minimum",
    artifactTypes: ["capability_statement", "corporate_overview"],
    categories: ["corporate_overview"],
    freshnessMonths: 6,
    why: "Gives the system approved positioning, differentiators, and core capabilities.",
  },
  {
    id: "past_performance",
    label: "Past performance",
    group: "minimum",
    artifactTypes: ["past_performance"],
    categories: ["past_performance"],
    freshnessMonths: 12,
    why: "Supplies the proof points evaluators expect and the drafter must cite.",
  },
  {
    id: "key_personnel_certs",
    label: "Key personnel and certifications",
    group: "minimum",
    artifactTypes: ["key_personnel", "certifications"],
    categories: ["key_personnel", "certifications"],
    freshnessMonths: 6,
    why: "Supports staffing, eligibility, and compliance claims.",
  },
  {
    id: "technical_approach",
    label: "Technical approach library",
    group: "high_impact",
    artifactTypes: ["technical_approach"],
    categories: ["technical_approach"],
    freshnessMonths: 12,
    why: "Speeds higher-quality technical volumes with less blank-page drafting.",
  },
  {
    id: "management_approach",
    label: "Management and staffing approach",
    group: "high_impact",
    artifactTypes: ["management", "staffing_approach"],
    categories: ["management"],
    freshnessMonths: 12,
    why: "Improves governance, staffing, transition, risk, and quality sections.",
  },
  {
    id: "cybersecurity_posture",
    label: "Cybersecurity posture",
    group: "high_impact",
    artifactTypes: ["cybersecurity_posture"],
    categories: ["technical_approach", "certifications"],
    freshnessMonths: 12,
    why: "Needed for many federal technical and compliance requirements.",
  },
  {
    id: "contract_vehicles",
    label: "Contract vehicles and socioeconomic proof",
    group: "advanced",
    artifactTypes: ["contract_vehicle", "socioeconomic_status"],
    categories: ["certifications"],
    freshnessMonths: 12,
    why: "Improves eligibility, set-aside, and procurement-pathway reasoning.",
  },
  {
    id: "transition_risk_quality",
    label: "Transition, risk, and quality plans",
    group: "advanced",
    artifactTypes: ["transition_plan", "risk_playbook", "quality_management"],
    categories: ["management"],
    freshnessMonths: 24,
    why: "Adds reusable, evaluator-friendly operational detail.",
  },
  {
    id: "innovation_cases",
    label: "Innovation and differentiator cases",
    group: "advanced",
    artifactTypes: ["innovation_case_study", "accelerator_catalog"],
    categories: ["technical_approach", "corporate_overview"],
    freshnessMonths: 24,
    why: "Creates differentiation beyond minimum compliance.",
  },
];

function profileScore(profile: ReadinessProfileInput | null) {
  const hasCompanyName = Boolean(profile?.company_name?.trim());
  const hasBusinessDescription =
    (profile?.business_description?.trim().length || 0) >= 60;
  const hasCapabilities = (profile?.core_capabilities?.length || 0) >= 3;
  const hasNaics = (profile?.naics_codes?.length || 0) > 0;
  const hasCertifications = (profile?.certifications?.length || 0) > 0;
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

function isFresh(createdAt: string | null | undefined, freshnessMonths: number, now: Date) {
  if (!createdAt) return true;
  const value = new Date(createdAt).getTime();
  if (Number.isNaN(value)) return true;
  const maxAgeMs = freshnessMonths * 30 * 24 * 60 * 60 * 1000;
  return now.getTime() - value <= maxAgeMs;
}

export function computeOnboardingReadinessSnapshot(input: {
  profile: ReadinessProfileInput | null;
  latestResearch: ReadinessResearchInput | null;
  chunks: ReadinessChunkInput[];
  proposals: ReadinessProposalInput[];
  requirements: ReadinessRequirementInput[];
  now?: Date;
}): OnboardingReadiness {
  const now = input.now || new Date();
  const profileReadiness = profileScore(input.profile);
  const verifiedChunks = input.chunks.filter(
    (chunk) => chunk.trust_level !== "public_unverified"
  );

  const requirementsBySolicitation = input.requirements.reduce<
    Record<string, ReadinessRequirementInput[]>
  >((acc, requirement) => {
    acc[requirement.solicitation_id] = acc[requirement.solicitation_id] || [];
    acc[requirement.solicitation_id].push(requirement);
    return acc;
  }, {});

  const activeProposalGap =
    input.proposals
      .map((proposal) => {
        const proposalRequirements = requirementsBySolicitation[proposal.solicitation_id] || [];
        const red = proposalRequirements.filter((r) => r.readiness_score === "red").length;
        const yellow = proposalRequirements.filter((r) => r.readiness_score === "yellow").length;
        if (red + yellow === 0) return null;
        return {
          proposalId: proposal.id,
          solicitationTitle: proposal.solicitationTitle || "Active RFP",
          red,
          yellow,
          categories: Array.from(
            new Set(
              proposalRequirements
                .filter((r) => r.readiness_score === "red" || r.readiness_score === "yellow")
                .map((r) => r.category)
                .filter((category): category is string => Boolean(category))
            )
          ),
        };
      })
      .find(Boolean) || null;

  const neededArtifactTypes = requirementCategoriesToArtifactTypes(activeProposalGap?.categories || []);
  const items: ReadinessItem[] = READINESS_ITEMS.map((item) => {
    const matched = verifiedChunks.filter((chunk) => {
      const artifactMatch = chunk.artifact_type
        ? item.artifactTypes.includes(chunk.artifact_type)
        : false;
      const categoryMatch = chunk.category ? item.categories.includes(chunk.category) : false;
      return artifactMatch || categoryMatch;
    });
    const freshCount = matched.filter((chunk) =>
      isFresh(chunk.created_at, item.freshnessMonths, now)
    ).length;
    return {
      ...item,
      matchedCount: matched.length,
      freshCount,
      ready: freshCount > 0,
      stale: matched.length > 0 && freshCount === 0,
      neededForCurrentRfp: item.artifactTypes.some((artifactType) =>
        neededArtifactTypes.has(artifactType)
      ),
    };
  });

  const minimumItems = items.filter((item) => item.group === "minimum");
  const minimumReadyCount = minimumItems.filter((item) => item.ready).length;
  const minimumReady = minimumReadyCount === minimumItems.length;
  const hasAnalyzedRfpGap = Boolean(activeProposalGap);
  const hasAnyEvidence = verifiedChunks.length > 0;

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
  const baselineContribution = input.latestResearch?.status === "complete" ? 15 : 0;
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
      status: input.latestResearch?.status || "missing",
      latestId: input.latestResearch?.id || null,
      trustLevel: input.latestResearch?.trust_level || null,
    },
    evidence: {
      minimumReady,
      minimumReadyCount,
      minimumTotal: minimumItems.length,
      totalChunks: verifiedChunks.length,
      items,
    },
    activeProposalGap,
    nextAction,
  };
}
