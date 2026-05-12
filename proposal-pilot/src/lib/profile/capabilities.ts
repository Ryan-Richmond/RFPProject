export interface CapabilityGroup {
  group: string;
  items: string[];
}

// Common capabilities used in federal RFPs. Grouped so the typeahead UI
// can show related families when the user clicks the "Browse" affordance.
export const COMMON_CAPABILITIES: CapabilityGroup[] = [
  {
    group: "Software & Web",
    items: [
      "Custom Software Development",
      "Web Application Development",
      "Mobile Application Development",
      "API Development & Integration",
      "Front-End Engineering",
      "Back-End Engineering",
      "Full-Stack Engineering",
      "Microservices Architecture",
      "Legacy System Modernization",
      "UI/UX Design",
      "Accessibility (Section 508 / WCAG)",
    ],
  },
  {
    group: "Cloud & Infrastructure",
    items: [
      "Cloud Migration",
      "AWS GovCloud",
      "Microsoft Azure Government",
      "Google Cloud Platform",
      "Infrastructure as Code (Terraform)",
      "Kubernetes / Container Orchestration",
      "Site Reliability Engineering (SRE)",
      "Network Engineering",
      "Database Administration",
      "Data Center Operations",
    ],
  },
  {
    group: "AI & Data",
    items: [
      "AI / Machine Learning",
      "Generative AI Solutions",
      "Natural Language Processing",
      "Computer Vision",
      "Data Engineering",
      "Data Analytics & BI",
      "Big Data / ETL Pipelines",
      "MLOps",
      "Data Governance",
      "Geospatial Analytics / GIS",
    ],
  },
  {
    group: "Cybersecurity",
    items: [
      "Cybersecurity",
      "Penetration Testing",
      "Incident Response",
      "Security Operations Center (SOC)",
      "Zero Trust Architecture",
      "FedRAMP Compliance",
      "FISMA / NIST 800-53",
      "CMMC Compliance",
      "Identity & Access Management",
      "Vulnerability Management",
    ],
  },
  {
    group: "DevSecOps & Quality",
    items: [
      "DevSecOps",
      "CI/CD Pipelines",
      "Agile / Scrum",
      "Test Automation",
      "Performance Testing",
      "Quality Assurance",
      "Configuration Management",
    ],
  },
  {
    group: "Program & Acquisition",
    items: [
      "Program Management",
      "Project Management (PMP)",
      "Acquisition Support",
      "Earned Value Management (EVM)",
      "Business Process Reengineering",
      "Strategic Planning",
      "Change Management",
      "Policy Analysis",
    ],
  },
  {
    group: "Engineering & Science",
    items: [
      "Systems Engineering",
      "Civil Engineering",
      "Mechanical Engineering",
      "Electrical Engineering",
      "Research & Development",
      "Modeling & Simulation",
      "Test & Evaluation",
      "Environmental Engineering",
    ],
  },
  {
    group: "Operations & Services",
    items: [
      "IT Help Desk / Service Desk",
      "Managed IT Services",
      "Logistics & Supply Chain",
      "Facilities Management",
      "Training & Workforce Development",
      "Records Management",
      "Translation & Interpretation",
      "Communications & Outreach",
    ],
  },
];

const FLAT_CAPABILITIES: string[] = COMMON_CAPABILITIES.flatMap((g) => g.items);

export function getAllCapabilities(): string[] {
  return FLAT_CAPABILITIES;
}

export interface CapabilitySearchResult {
  label: string;
  group: string;
  matchScore: number;
}

export function searchCapabilities(
  query: string,
  excluded: string[] = [],
  limit = 8
): CapabilitySearchResult[] {
  const q = query.trim().toLowerCase();
  const excludedSet = new Set(excluded.map((s) => s.toLowerCase()));
  const results: CapabilitySearchResult[] = [];

  for (const group of COMMON_CAPABILITIES) {
    for (const item of group.items) {
      if (excludedSet.has(item.toLowerCase())) continue;

      const itemLower = item.toLowerCase();
      let score = 0;

      if (!q) {
        score = 10; // browse mode
      } else if (itemLower === q) {
        score = 100;
      } else if (itemLower.startsWith(q)) {
        score = 80;
      } else if (itemLower.includes(q)) {
        score = 50;
      } else {
        // Token overlap fallback (e.g. "ml" matches "AI / Machine Learning")
        const tokens = q.split(/[\s/]+/).filter(Boolean);
        const hits = tokens.filter((t) => itemLower.includes(t)).length;
        if (hits > 0) score = 30 + hits * 5;
      }

      if (score > 0) {
        results.push({ label: item, group: group.group, matchScore: score });
      }
    }
  }

  results.sort((a, b) => b.matchScore - a.matchScore);
  return results.slice(0, limit);
}
