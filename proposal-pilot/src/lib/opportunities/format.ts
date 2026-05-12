const AGENCY_ABBREVIATIONS: Record<string, string> = {
  "DEPT OF DEFENSE": "Department of Defense",
  "DEPT OF THE NAVY": "Navy",
  "DEPT OF THE ARMY": "Army",
  "DEPT OF THE AIR FORCE": "Air Force",
  "HOMELAND SECURITY, DEPARTMENT OF": "DHS",
  "US ARMY CORPS OF ENGINEERS": "USACE",
  "DEFENSE ADVANCED RESEARCH PROJECTS AGENCY": "DARPA",
  "DEFENSE LOGISTICS AGENCY": "DLA",
  "DEPARTMENT OF VETERANS AFFAIRS": "VA",
};

function normalizeSegment(segment: string): string {
  const trimmed = segment.trim();
  if (!trimmed) return trimmed;
  if (AGENCY_ABBREVIATIONS[trimmed]) return AGENCY_ABBREVIATIONS[trimmed];
  // Keep all-caps acronyms (NAVSUP, NAVFAC, etc.)
  if (/^[A-Z0-9 ]+$/.test(trimmed) && trimmed.length <= 8) return trimmed;
  // Mixed: title case the descriptive part, keep ALL-CAPS tokens
  return trimmed
    .split(/\s+/)
    .map((word) => {
      if (/^[A-Z0-9]{2,8}$/.test(word)) return word; // keep acronym
      if (["OF", "THE", "AND"].includes(word)) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export interface FormattedAgency {
  primary: string; // e.g. "Navy"
  subUnit?: string; // e.g. "NAVSUP WSS Mechanicsburg"
  segments: string[]; // full breadcrumb of normalized segments
}

export function formatAgency(path?: string | null): FormattedAgency {
  if (!path) return { primary: "Unknown Agency", segments: [] };

  const segments = path
    .split(".")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeSegment);

  if (segments.length === 0) {
    return { primary: path, segments: [path] };
  }

  // Drop duplicate-prefix segments (e.g. "NAVSUP" followed by "NAVSUP WEAPON SYSTEMS SUPPORT")
  const deduped: string[] = [];
  for (const seg of segments) {
    const last = deduped[deduped.length - 1];
    if (last && seg.toUpperCase().startsWith(last.toUpperCase() + " ")) {
      deduped[deduped.length - 1] = seg; // replace shorter prefix with longer descriptive
      continue;
    }
    if (last && last.toUpperCase().startsWith(seg.toUpperCase() + " ")) {
      continue; // skip shorter prefix that comes after
    }
    if (last && last.toUpperCase() === seg.toUpperCase()) {
      continue;
    }
    deduped.push(seg);
  }

  // Choose a meaningful "primary" — prefer the second segment if it's a service branch.
  const primary =
    deduped.length >= 2 && /Navy|Army|Air Force|Marine|Coast Guard/i.test(deduped[1])
      ? deduped[1]
      : deduped[0];
  const subUnit =
    deduped.length > 1 ? deduped[deduped.length - 1] : undefined;

  return {
    primary,
    subUnit: subUnit && subUnit !== primary ? subUnit : undefined,
    segments: deduped,
  };
}

export function formatCurrencyShort(value?: number | null): string {
  if (!value || value <= 0) return "N/A";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

export function formatValueRange(
  min?: number | null,
  max?: number | null
): string {
  if (!min && !max) return "N/A";
  if (min && max && min !== max) {
    return `${formatCurrencyShort(min)} – ${formatCurrencyShort(max)}`;
  }
  return formatCurrencyShort(min || max);
}

export function isUrl(value?: string | null): boolean {
  if (!value) return false;
  return /^https?:\/\//i.test(value.trim());
}

export interface ScoreTip {
  label: string;
  tip: string;
}

export function getScoreImprovementTip(
  dimension:
    | "naics"
    | "size"
    | "capability"
    | "set_aside"
    | "competition"
    | "timeline",
  score: number
): string | null {
  if (score >= 75) return null;
  switch (dimension) {
    case "naics":
      return score < 25
        ? "Your registered NAICS codes don't match this opportunity. Add the listed NAICS to your SAM.gov profile if your business genuinely performs that work."
        : "Partial NAICS overlap — consider adding adjacent codes to your profile if relevant.";
    case "size":
      return score < 50
        ? "Your business size may not fit this opportunity's size standard. Verify the SBA size threshold for the NAICS and confirm your latest receipts/employee count."
        : "Borderline size fit — confirm size status calculations before pursuing.";
    case "capability":
      return score < 50
        ? "Your profile lacks evidence of the work being requested. Upload past performance, technical descriptions, or case studies that demonstrate this capability in the Knowledge Base."
        : "Some capabilities are present but thin. Strengthen with specific project examples and metrics.";
    case "set_aside":
      return score < 50
        ? "You may not be eligible for the required set-aside. Verify your certifications (SBA, SDVOSB, WOSB, 8(a), HUBZone) are active and registered in SAM."
        : "Eligibility is partial — review the specific set-aside requirements.";
    case "competition":
      return "Expect strong incumbent or large-business competition. Identify a differentiator (price, niche capability, teaming) before investing in a bid.";
    case "timeline":
      return score < 50
        ? "Response window is tight. Decide quickly whether to no-bid, or rapidly assemble a teaming arrangement."
        : "Timeline is workable but plan resources carefully.";
    default:
      return null;
  }
}
