export const DEMO_COMPANY_DOCUMENT = `ProposalPilot Demo Capability Statement

Northstar Digital Services is a small federal technology integrator specializing in secure cloud modernization, DevSecOps enablement, and mission application sustainment. The company supports NAICS 541512 and 541519 work for defense and civilian customers.

Corporate Overview
Northstar delivers modernization programs through integrated product teams that combine cloud architects, cybersecurity engineers, delivery leads, business analysts, and quality specialists. The team uses sprint planning, control gates, and executive dashboards to keep delivery measurable and transparent.

Technical Approach
Northstar migrates legacy applications using discovery, dependency mapping, landing-zone validation, automated testing, and phased cutover. Security controls are built into the backlog, including vulnerability remediation, least-privilege access, audit logging, secure configuration baselines, and continuous monitoring.

Management Approach
Each engagement uses a named program manager, technical lead, security lead, and customer success lead. Governance includes weekly sprint reviews, monthly risk reviews, an integrated master schedule, and an issue escalation path for scope, cost, staffing, and security decisions.

Past Performance
In 2025, Northstar supported a mock Army training systems modernization task order valued at $6.8M. The team migrated three applications to a secure cloud environment, reduced critical vulnerabilities by 41 percent, and delivered a portfolio dashboard used by program leadership.

In 2024, Northstar supported a mock civilian data governance contract valued at $3.2M. The team built reusable data pipelines, improved reporting cycle time from ten days to two days, and documented controls for audit readiness.

Certifications and Compliance
Northstar maintains active SAM registration, small business status, ISO 9001-aligned quality procedures, and documented cybersecurity policies mapped to NIST 800-53 and FedRAMP moderate control families.`;

export const DEMO_RFP_DOCUMENT = `Mock RFP: Cybersecurity Modernization Support Services
Solicitation Number: W91QF6-26-R-0007
Agency: U.S. Army Training and Doctrine Command
Due Date: 2026-06-15 17:00:00Z
Set-Aside: Small Business
NAICS: 541512, 541519

Section C - Performance Work Statement
The contractor shall provide secure cloud modernization support for mission training applications. Work includes application discovery, migration planning, landing-zone validation, integration, continuous monitoring, vulnerability remediation, dashboard modernization, and sustainment support.

The contractor shall maintain FedRAMP-aligned controls, provide monthly vulnerability metrics, document risk acceptance recommendations, and coordinate remediation activities with Government stakeholders.

Section L - Instructions
The offeror shall submit a technical volume, management volume, past performance volume, and price volume. The technical volume shall not exceed 50 pages and shall use 11-point font with one-inch margins. The offeror shall identify any assumptions, risks, and dependencies.

The management volume shall include staffing structure, named roles, escalation procedures, governance cadence, sprint ceremonies, quality controls, and risk management approach.

The past performance volume shall provide three relevant references from the last five years, including contract number, customer, period of performance, value, relevance, and point of contact.

Section M - Evaluation Criteria
Factor 1: Technical Approach, 40 percent. The Government will evaluate feasibility, security maturity, technical soundness, and alignment to mission needs.
Factor 2: Management Approach, 25 percent. The Government will evaluate staffing, governance, risk control, schedule credibility, and quality management.
Factor 3: Past Performance, 25 percent. The Government will evaluate recency, relevance, and quality.
Factor 4: Price, 10 percent. The Government will evaluate reasonableness and completeness.`;

export const DEMO_REQUIREMENTS = [
  {
    id: "REQ-001",
    category: "technical",
    text: "Provide a secure cloud modernization approach for mission application migration, integration, and sustainment.",
    section_ref: "Section C.3.1",
    evaluation_weight: "high",
    readiness_score: "green",
  },
  {
    id: "REQ-002",
    category: "technical",
    text: "Maintain FedRAMP-aligned controls, vulnerability remediation, and continuous monitoring for production workloads.",
    section_ref: "Section C.3.4",
    evaluation_weight: "high",
    readiness_score: "green",
  },
  {
    id: "REQ-003",
    category: "management",
    text: "Submit a staffing and governance plan with named roles, escalation paths, and sprint cadence.",
    section_ref: "Section L.5.2",
    evaluation_weight: "medium",
    readiness_score: "green",
  },
  {
    id: "REQ-004",
    category: "past_performance",
    text: "Provide three relevant past performance references from the last five years.",
    section_ref: "Section L.6.1",
    evaluation_weight: "medium",
    readiness_score: "yellow",
  },
  {
    id: "REQ-005",
    category: "submission_format",
    text: "Technical volume shall not exceed 50 pages and must use 11-point font with one-inch margins.",
    section_ref: "Section L.2.1",
    evaluation_weight: "low",
    readiness_score: "yellow",
  },
  {
    id: "REQ-006",
    category: "compliance",
    text: "Offeror shall maintain active SAM registration and identify any required small-business certifications.",
    section_ref: "Section K.1",
    evaluation_weight: "medium",
    readiness_score: "green",
  },
] as const;

export const DEMO_COMPLIANCE_MATRIX = [
  {
    instruction_ref: "Section L.5.1",
    instruction_text:
      "Describe the technical approach for cloud migration, cybersecurity, and sustainment.",
    evaluation_ref: "Section M.2 Factor 1",
    evaluation_text: "Technical Approach (40%)",
    mapped_requirements: ["REQ-001", "REQ-002"],
  },
  {
    instruction_ref: "Section L.5.2",
    instruction_text:
      "Provide management plan, staffing structure, governance, and risk controls.",
    evaluation_ref: "Section M.2 Factor 2",
    evaluation_text: "Management Approach (25%)",
    mapped_requirements: ["REQ-003"],
  },
  {
    instruction_ref: "Section L.6.1",
    instruction_text:
      "Submit three past performance references completed within five years.",
    evaluation_ref: "Section M.2 Factor 3",
    evaluation_text: "Past Performance (25%)",
    mapped_requirements: ["REQ-004"],
  },
  {
    instruction_ref: "Section L.2.1",
    instruction_text:
      "Follow page, font, margin, file naming, and attachment requirements.",
    evaluation_ref: "Section M.1",
    evaluation_text: "Acceptability Review",
    mapped_requirements: ["REQ-005", "REQ-006"],
  },
] as const;

export const DEMO_PROPOSAL_SECTIONS = [
  {
    title: "Executive Summary",
    content:
      "Northstar Digital Services will deliver secure cloud modernization through an evidence-backed operating model that ties each requirement to delivery controls, staffing accountability, and measurable outcomes. [Addresses: REQ-001, REQ-002, REQ-003] The proposed approach reduces migration risk by validating dependencies early, integrating cybersecurity into sprint execution, and maintaining transparent executive reporting. [Evidence: mock_evidence_001]",
    requirement_mappings: ["REQ-001", "REQ-002", "REQ-003"],
    placeholders: [],
    confidence: "high",
  },
  {
    title: "Technical Approach",
    content:
      "The technical approach begins with application discovery, dependency mapping, and landing-zone validation before migration waves are approved. [Addresses: REQ-001] Security engineering is embedded in each sprint through vulnerability triage, configuration baselines, continuous monitoring, and documented risk recommendations. [Addresses: REQ-002] [Evidence: mock_evidence_002]",
    requirement_mappings: ["REQ-001", "REQ-002"],
    placeholders: [],
    confidence: "high",
  },
  {
    title: "Management Approach",
    content:
      "Northstar will assign a program manager, technical lead, security lead, and customer success lead to maintain clear accountability. Weekly sprint reviews, monthly risk reviews, and an integrated master schedule give the Government direct visibility into status, blockers, and decisions. [Addresses: REQ-003] [Evidence: mock_evidence_003]",
    requirement_mappings: ["REQ-003"],
    placeholders: [],
    confidence: "high",
  },
  {
    title: "Past Performance",
    content:
      "Northstar's mock Army training systems modernization task order demonstrates relevant experience migrating mission applications, reducing critical vulnerabilities, and delivering leadership dashboards. [Addresses: REQ-004] [Evidence: mock_evidence_004]\n\n[PLACEHOLDER: Confirm CPARS ratings, customer point-of-contact details, and permission to cite each reference.]",
    requirement_mappings: ["REQ-004"],
    placeholders: [
      "Confirm CPARS ratings, customer point-of-contact details, and permission to cite each reference.",
    ],
    confidence: "medium",
  },
] as const;
