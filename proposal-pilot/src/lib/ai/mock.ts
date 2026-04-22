import type { AgentAPIOptions, AgentAPIResponse } from "./perplexity";

const MOCK_CITATIONS = [
  "https://sam.gov/opp/mock-cyber-modernization",
  "https://www.usaspending.gov/award/mock-award",
];

function extractRequirementIds(input: string) {
  const ids = new Set<string>();
  for (const match of input.matchAll(/\bREQ-\d{3}\b/g)) {
    ids.add(match[0]);
  }
  return [...ids];
}

function getSectionTitle(input: string) {
  const match = input.match(/Generate the "([^"]+)" section/);
  return match?.[1] || "Proposal Section";
}

function buildAnalysisResponse() {
  return {
    classification: "federal",
    solicitationNumber: "W91QF6-26-R-0007",
    agency: "U.S. Army Training and Doctrine Command",
    dueDate: "2026-06-15T17:00:00Z",
    setAsideType: "SB",
    naicsCodes: ["541512", "541519"],
    estimatedValue: "$8M-$12M",
    periodOfPerformance: "Base year plus four option years",
    requirements: [
      {
        id: "REQ-001",
        category: "technical",
        text: "Provide a secure cloud modernization approach for mission application migration, integration, and sustainment.",
        section_ref: "Section C.3.1",
        evaluation_weight: "high",
      },
      {
        id: "REQ-002",
        category: "technical",
        text: "Maintain FedRAMP-aligned controls, vulnerability remediation, and continuous monitoring for production workloads.",
        section_ref: "Section C.3.4",
        evaluation_weight: "high",
      },
      {
        id: "REQ-003",
        category: "management",
        text: "Submit a staffing and governance plan with named roles, escalation paths, and sprint cadence.",
        section_ref: "Section L.5.2",
        evaluation_weight: "medium",
      },
      {
        id: "REQ-004",
        category: "past_performance",
        text: "Provide three relevant past performance references from the last five years.",
        section_ref: "Section L.6.1",
        evaluation_weight: "medium",
      },
      {
        id: "REQ-005",
        category: "submission_format",
        text: "Technical volume shall not exceed 50 pages and must use 11-point font with one-inch margins.",
        section_ref: "Section L.2.1",
        evaluation_weight: "low",
      },
      {
        id: "REQ-006",
        category: "compliance",
        text: "Offeror shall maintain active SAM registration and identify any required small-business certifications.",
        section_ref: "Section K.1",
        evaluation_weight: "medium",
      },
    ],
    evaluationCriteria: [
      {
        name: "Technical Approach",
        weight: 40,
        description: "Soundness, feasibility, security posture, and implementation maturity.",
      },
      {
        name: "Management Approach",
        weight: 25,
        description: "Staffing, governance, schedule control, and risk management.",
      },
      {
        name: "Past Performance",
        weight: 25,
        description: "Relevance, recency, quality, and demonstrated outcomes.",
      },
      {
        name: "Price",
        weight: 10,
        description: "Reasonableness and completeness of the price volume.",
      },
    ],
    complianceMatrix: [
      {
        instruction_ref: "Section L.5.1",
        instruction_text: "Describe the technical approach for cloud migration, cybersecurity, and sustainment.",
        evaluation_ref: "Section M.2 Factor 1",
        evaluation_text: "Technical Approach (40%)",
        mapped_requirements: ["REQ-001", "REQ-002"],
      },
      {
        instruction_ref: "Section L.5.2",
        instruction_text: "Provide management plan, staffing structure, governance, and risk controls.",
        evaluation_ref: "Section M.2 Factor 2",
        evaluation_text: "Management Approach (25%)",
        mapped_requirements: ["REQ-003"],
      },
      {
        instruction_ref: "Section L.6.1",
        instruction_text: "Submit three past performance references completed within five years.",
        evaluation_ref: "Section M.2 Factor 3",
        evaluation_text: "Past Performance (25%)",
        mapped_requirements: ["REQ-004"],
      },
      {
        instruction_ref: "Section L.2.1",
        instruction_text: "Follow page, font, margin, file naming, and attachment requirements.",
        evaluation_ref: "Section M.1",
        evaluation_text: "Acceptability Review",
        mapped_requirements: ["REQ-005", "REQ-006"],
      },
    ],
    ambiguities: [
      {
        id: "AMB-001",
        text: "The RFP references legacy interfaces but does not provide an authoritative inventory.",
        section_ref: "Section C.3.2",
        suggested_question:
          "Please provide the current interface inventory, data owners, and any known dependencies for legacy systems in scope.",
      },
    ],
  };
}

function buildDiscoveryResponse() {
  return [
    {
      solicitation_number: "W91QF6-26-R-0007",
      title: "Cybersecurity Modernization Support Services",
      agency: "U.S. Army Training and Doctrine Command",
      posted_date: "2026-04-15T12:00:00Z",
      response_deadline: "2026-06-15T17:00:00Z",
      naics_codes: ["541512", "541519"],
      set_aside_type: "SB",
      estimated_value_min: 8000000,
      estimated_value_max: 12000000,
      contract_type: "FFP",
      description:
        "Cloud migration, vulnerability remediation, dashboard modernization, and sustainment support for training mission systems.",
      source_url: "https://sam.gov/opp/mock-cyber-modernization",
    },
    {
      solicitation_number: "FA8773-26-R-0021",
      title: "DevSecOps Platform Engineering Blanket Purchase Agreement",
      agency: "U.S. Air Force",
      posted_date: "2026-04-10T12:00:00Z",
      response_deadline: "2026-05-30T17:00:00Z",
      naics_codes: ["541511", "541512"],
      set_aside_type: "SDVOSB",
      estimated_value_min: 5000000,
      estimated_value_max: 9000000,
      contract_type: "T&M",
      description:
        "Platform engineering, CI/CD hardening, secure backlog support, and application onboarding services.",
      source_url: "https://sam.gov/opp/mock-devsecops-bpa",
    },
    {
      solicitation_number: "47QTCA-26-Q-0094",
      title: "Data Governance and Analytics Modernization",
      agency: "General Services Administration",
      posted_date: "2026-04-08T12:00:00Z",
      response_deadline: "2026-05-22T17:00:00Z",
      naics_codes: ["541519"],
      set_aside_type: "unrestricted",
      estimated_value_min: 2000000,
      estimated_value_max: 4500000,
      contract_type: "IDIQ",
      description:
        "Metadata management, reporting automation, and secure data product delivery for acquisition analytics.",
      source_url: "https://sam.gov/opp/mock-data-governance",
    },
  ];
}

function buildSectionResponse(input: string) {
  const title = getSectionTitle(input);
  const requirementIds = extractRequirementIds(input);
  const mapped = requirementIds.length ? requirementIds : ["REQ-001", "REQ-003"];
  const confidence = title === "Past Performance" ? "medium" : "high";
  const placeholders =
    title === "Past Performance"
      ? ["Confirm customer CPARS ratings and provide current point-of-contact details."]
      : [];

  return {
    content: [
      `${title}`,
      "",
      `ProposalPilot will execute this work through a controlled, evidence-backed delivery model that connects secure modernization, sprint governance, and measurable mission outcomes. [Addresses: ${mapped.join(", ")}]`,
      "",
      "Our approach uses an integrated team of cloud engineers, cybersecurity analysts, and delivery leads to prioritize high-value workloads, validate security controls early, and keep stakeholders aligned through weekly decision reviews. [Evidence: mock_evidence_001]",
      "",
      "The team will maintain a living compliance register, remediation backlog, and risk burndown dashboard so the Government can inspect progress without waiting for monthly reporting cycles. [Evidence: mock_evidence_002]",
      placeholders.length
        ? `\n[PLACEHOLDER: ${placeholders[0]}]`
        : "This structure gives evaluators a direct line of sight from solicitation requirements to delivery controls, evidence, and outcomes.",
    ]
      .filter(Boolean)
      .join("\n"),
    requirement_mappings: mapped,
    placeholders,
    confidence,
  };
}

function buildComplianceResponse(input: string) {
  const requirementIds = extractRequirementIds(input);
  const ids = requirementIds.length
    ? requirementIds
    : ["REQ-001", "REQ-002", "REQ-003", "REQ-004", "REQ-005", "REQ-006"];

  return {
    requirement_status: ids.map((id, index) => ({
      id,
      status:
        id === "REQ-004"
          ? "partially_addressed"
          : id === "REQ-005"
          ? "weak"
          : "addressed",
      draft_location:
        index < 2
          ? "Technical Approach"
          : index === 2
          ? "Management Approach"
          : "Past Performance",
      issue:
        id === "REQ-004"
          ? "Past performance narrative is present but needs final customer contact details."
          : id === "REQ-005"
          ? "Mock check cannot verify final page count, margins, or font."
          : undefined,
      suggestion:
        id === "REQ-004"
          ? "Add confirmed reference names, emails, and contract numbers before submission."
          : id === "REQ-005"
          ? "Run the exported Word document through a final format review."
          : undefined,
    })),
    format_issues: [
      {
        issue: "Mock mode cannot validate final exported page count.",
        severity: "medium",
      },
    ],
  };
}

function buildScoreResponse() {
  return {
    naicsMatchScore: 92,
    sizeFitScore: 84,
    capabilityMatchScore: 88,
    setAsideEligibilityScore: 75,
    competitionLevelScore: 68,
    timelineFitScore: 81,
    overallScore: 83,
    recommendation: "pursue",
    scoreRationale:
      "The opportunity aligns strongly with the workspace profile, cloud modernization evidence, and secure delivery capabilities. Competition risk remains moderate because incumbent information is incomplete in mock mode.",
    incumbentInfo: "Mock incumbent: Sentinel Mission Systems, task order ending FY2026.",
    competitiveLandscape:
      "Likely competitors include mid-market federal IT integrators with Army cyber and cloud sustainment past performance.",
  };
}

function buildWinProbabilityResponse() {
  return {
    winProbabilityScore: 72,
    keyWinFactors: [
      "Strong alignment to cloud modernization and cybersecurity requirements.",
      "Relevant small-business positioning for the mock set-aside.",
      "Reusable evidence supports technical and management sections.",
    ],
    keyRiskFactors: [
      "Past performance references need final validation.",
      "Incumbent strategy and agency budget context require live research before bid review.",
    ],
    recommendedBidDecision: "bid",
  };
}

export function isAIMockMode() {
  return process.env.AI_MODE === "mock" || process.env.NEXT_PUBLIC_AI_MODE === "mock";
}

export function getMockAgentResponse(
  options: AgentAPIOptions,
  operationContext?: { workspaceId?: string; operationType?: string }
): AgentAPIResponse {
  const operationType = operationContext?.operationType || "analysis";
  const input = options.input;
  let payload: unknown;

  if (input.includes("Search for active government RFP opportunities")) {
    payload = buildDiscoveryResponse();
  } else if (input.includes("Score this government contracting opportunity")) {
    payload = buildScoreResponse();
  } else if (input.includes("estimate the win probability")) {
    payload = buildWinProbabilityResponse();
  } else if (input.includes("Check this proposal draft against")) {
    payload = buildComplianceResponse(input);
  } else if (input.includes("Generate the \"")) {
    payload = buildSectionResponse(input);
  } else if (input.includes("Analyze this government RFP document")) {
    payload = buildAnalysisResponse();
  } else if (input.includes("Classify each of the following document chunks")) {
    payload = [
      {
        chunkIndex: 0,
        category: "corporate_overview",
        naics_codes: ["541512", "541519"],
        agency: "Multiple federal customers",
        contract_type: "FFP",
        keywords: ["cloud", "cybersecurity", "delivery"],
        date: "2025",
      },
    ];
  } else {
    payload = {
      answer:
        "Mock mode response: live Perplexity calls are disabled, but this workflow path is operational.",
      operationType,
    };
  }

  return {
    outputText: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
    citations: MOCK_CITATIONS,
    responseId: `mock_${operationType}_${Date.now()}`,
  };
}

export function getMockSonarResponse(query: string) {
  return {
    answer: `Mock agency research for: ${query}. Recent awards suggest moderate incumbent advantage, strong demand for secure modernization, and recurring evaluation emphasis on measurable delivery controls.`,
    citations: MOCK_CITATIONS,
  };
}

export function generateMockEmbedding(text: string, dimensions = 1024): number[] {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return Array.from({ length: dimensions }, (_, index) => {
    hash ^= index + 0x9e3779b9;
    hash = Math.imul(hash, 16777619);
    return Number((((hash >>> 0) % 2000) / 1000 - 1).toFixed(3));
  });
}
