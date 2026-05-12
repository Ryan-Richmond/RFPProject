export interface NaicsCode {
  code: string;
  title: string;
  aliases?: string[];
}

// Curated list of NAICS codes that show up most often in federal contracting.
// Used for typeahead suggestions on the company profile.
export const COMMON_NAICS_CODES: NaicsCode[] = [
  // IT / Software / Cloud
  { code: "541511", title: "Custom Computer Programming Services", aliases: ["software development", "programming", "custom software", "app development"] },
  { code: "541512", title: "Computer Systems Design Services", aliases: ["systems integration", "it architecture", "solutions architect"] },
  { code: "541513", title: "Computer Facilities Management Services", aliases: ["managed it services", "it operations"] },
  { code: "541519", title: "Other Computer Related Services", aliases: ["it services", "tech support", "computer services"] },
  { code: "511210", title: "Software Publishers", aliases: ["saas", "software product", "commercial software"] },
  { code: "518210", title: "Data Processing, Hosting, and Related Services", aliases: ["cloud hosting", "data center", "managed hosting", "cloud computing"] },
  { code: "517311", title: "Wired Telecommunications Carriers", aliases: ["telecom", "broadband"] },
  { code: "517410", title: "Satellite Telecommunications", aliases: ["satcom"] },
  { code: "519130", title: "Internet Publishing, Broadcasting, and Web Search Portals", aliases: ["web publishing", "search"] },

  // Engineering / R&D
  { code: "541330", title: "Engineering Services", aliases: ["civil engineering", "mechanical engineering", "electrical engineering"] },
  { code: "541370", title: "Surveying and Mapping (except Geophysical) Services", aliases: ["gis", "mapping", "surveying"] },
  { code: "541380", title: "Testing Laboratories", aliases: ["lab testing", "materials testing"] },
  { code: "541713", title: "Research and Development in Nanotechnology", aliases: ["nano r&d"] },
  { code: "541714", title: "R&D in Biotechnology (except Nanobiotechnology)", aliases: ["biotech r&d"] },
  { code: "541715", title: "R&D in the Physical, Engineering, and Life Sciences", aliases: ["r&d", "research and development", "applied research", "basic research"] },
  { code: "541720", title: "R&D in the Social Sciences and Humanities", aliases: ["social science research"] },

  // Management / Professional Consulting
  { code: "541611", title: "Administrative Management and General Management Consulting", aliases: ["management consulting", "strategy consulting"] },
  { code: "541612", title: "Human Resources Consulting Services", aliases: ["hr consulting", "workforce consulting"] },
  { code: "541613", title: "Marketing Consulting Services", aliases: ["marketing consulting", "go-to-market"] },
  { code: "541614", title: "Process, Physical Distribution, and Logistics Consulting", aliases: ["logistics consulting", "supply chain consulting"] },
  { code: "541618", title: "Other Management Consulting Services", aliases: ["management consulting", "operations consulting"] },
  { code: "541620", title: "Environmental Consulting Services", aliases: ["environmental consulting", "nepa"] },
  { code: "541690", title: "Other Scientific and Technical Consulting Services", aliases: ["scientific consulting", "technical consulting"] },
  { code: "541910", title: "Marketing Research and Public Opinion Polling", aliases: ["market research", "polling", "survey research"] },
  { code: "541990", title: "All Other Professional, Scientific, and Technical Services", aliases: ["professional services", "specialized services"] },

  // Cybersecurity / Specialized Tech (mapped to 541512 and 541519 — alias-only)
  // The codes above pick these up via alias matching:
  // "cybersecurity", "penetration testing", "soc", "incident response" → 541512 / 541519

  // Communications / Marketing / Media
  { code: "541430", title: "Graphic Design Services", aliases: ["graphic design", "branding"] },
  { code: "541490", title: "Other Specialized Design Services", aliases: ["industrial design", "interior design"] },
  { code: "541810", title: "Advertising Agencies", aliases: ["advertising"] },
  { code: "541820", title: "Public Relations Agencies", aliases: ["pr", "public relations", "comms"] },
  { code: "541830", title: "Media Buying Agencies", aliases: ["media buying"] },
  { code: "541850", title: "Outdoor Advertising", aliases: ["billboards"] },
  { code: "541860", title: "Direct Mail Advertising", aliases: ["direct mail"] },
  { code: "541870", title: "Advertising Material Distribution Services", aliases: ["ad distribution"] },

  // Legal / Accounting / Finance
  { code: "541110", title: "Offices of Lawyers", aliases: ["legal services", "law firm"] },
  { code: "541211", title: "Offices of Certified Public Accountants", aliases: ["accounting", "cpa"] },
  { code: "541214", title: "Payroll Services", aliases: ["payroll"] },
  { code: "541219", title: "Other Accounting Services", aliases: ["bookkeeping"] },

  // Construction / Facilities
  { code: "236210", title: "Industrial Building Construction", aliases: ["industrial construction"] },
  { code: "236220", title: "Commercial and Institutional Building Construction", aliases: ["commercial construction", "government construction"] },
  { code: "237110", title: "Water and Sewer Line and Related Structures Construction", aliases: ["utility construction"] },
  { code: "237310", title: "Highway, Street, and Bridge Construction", aliases: ["road construction", "bridge construction"] },
  { code: "238210", title: "Electrical Contractors and Other Wiring Installation Contractors", aliases: ["electrical contractor"] },
  { code: "238220", title: "Plumbing, Heating, and Air-Conditioning Contractors", aliases: ["hvac", "plumbing", "mechanical contractor"] },
  { code: "238990", title: "All Other Specialty Trade Contractors", aliases: ["specialty trade"] },
  { code: "561210", title: "Facilities Support Services", aliases: ["facilities management", "base operations support"] },
  { code: "561720", title: "Janitorial Services", aliases: ["janitorial", "cleaning"] },
  { code: "561730", title: "Landscaping Services", aliases: ["landscaping", "groundskeeping"] },

  // Admin / Staffing / Logistics
  { code: "561110", title: "Office Administrative Services", aliases: ["admin services"] },
  { code: "561310", title: "Employment Placement Agencies", aliases: ["staffing", "recruiting"] },
  { code: "561320", title: "Temporary Help Services", aliases: ["temp staffing"] },
  { code: "561410", title: "Document Preparation Services", aliases: ["document preparation"] },
  { code: "561421", title: "Telephone Answering Services", aliases: ["call center"] },
  { code: "561422", title: "Telemarketing Bureaus", aliases: ["telemarketing"] },
  { code: "561431", title: "Private Mail Centers", aliases: ["mail services"] },
  { code: "561439", title: "Other Business Service Centers", aliases: ["business services"] },
  { code: "561499", title: "All Other Business Support Services", aliases: ["business support"] },
  { code: "561611", title: "Investigation Services", aliases: ["investigations", "background checks"] },
  { code: "561612", title: "Security Guards and Patrol Services", aliases: ["security guard", "armed security"] },
  { code: "561621", title: "Security Systems Services (except Locksmiths)", aliases: ["security systems", "physical security"] },
  { code: "561710", title: "Exterminating and Pest Control Services", aliases: ["pest control"] },
  { code: "562910", title: "Remediation Services", aliases: ["environmental remediation", "hazmat"] },

  // Manufacturing / Industrial
  { code: "332710", title: "Machine Shops", aliases: ["machining", "cnc"] },
  { code: "332919", title: "Other Metal Valve and Pipe Fitting Manufacturing", aliases: ["valves", "pipe fittings"] },
  { code: "333318", title: "Other Commercial and Service Industry Machinery Manufacturing", aliases: ["industrial machinery"] },
  { code: "334111", title: "Electronic Computer Manufacturing", aliases: ["computer manufacturing"] },
  { code: "334220", title: "Radio and Television Broadcasting and Wireless Communications Equipment Manufacturing", aliases: ["radio equipment", "wireless equipment"] },
  { code: "334290", title: "Other Communications Equipment Manufacturing", aliases: ["communications equipment"] },
  { code: "334511", title: "Search, Detection, Navigation, Guidance, Aeronautical Instrument Manufacturing", aliases: ["navigation", "guidance systems"] },
  { code: "335931", title: "Current-Carrying Wiring Device Manufacturing", aliases: ["wiring devices"] },
  { code: "336411", title: "Aircraft Manufacturing", aliases: ["aircraft"] },
  { code: "336992", title: "Military Armored Vehicle, Tank, and Tank Component Manufacturing", aliases: ["military vehicles"] },
  { code: "339112", title: "Surgical and Medical Instrument Manufacturing", aliases: ["medical devices"] },

  // Wholesale / Distribution
  { code: "423430", title: "Computer and Computer Peripheral Equipment and Software Merchant Wholesalers", aliases: ["it reseller", "var", "hardware reseller"] },
  { code: "423450", title: "Medical, Dental, and Hospital Equipment and Supplies Merchant Wholesalers", aliases: ["medical supplies"] },

  // Transportation / Logistics
  { code: "488510", title: "Freight Transportation Arrangement", aliases: ["freight forwarding", "logistics"] },
  { code: "493110", title: "General Warehousing and Storage", aliases: ["warehousing", "storage"] },

  // Education / Training
  { code: "611310", title: "Colleges, Universities, and Professional Schools", aliases: ["higher education"] },
  { code: "611410", title: "Business and Secretarial Schools", aliases: ["business schools"] },
  { code: "611420", title: "Computer Training", aliases: ["it training", "computer training"] },
  { code: "611430", title: "Professional and Management Development Training", aliases: ["leadership training", "professional training"] },
  { code: "611519", title: "Other Technical and Trade Schools", aliases: ["technical training"] },
  { code: "611699", title: "All Other Miscellaneous Schools and Instruction", aliases: ["instruction"] },
  { code: "611710", title: "Educational Support Services", aliases: ["education support", "instructional design"] },

  // Healthcare
  { code: "621111", title: "Offices of Physicians (except Mental Health Specialists)", aliases: ["physicians"] },
  { code: "621210", title: "Offices of Dentists", aliases: ["dental"] },
  { code: "621399", title: "Offices of All Other Miscellaneous Health Practitioners", aliases: ["health practitioners"] },
  { code: "621511", title: "Medical Laboratories", aliases: ["medical labs"] },
  { code: "621512", title: "Diagnostic Imaging Centers", aliases: ["imaging"] },
  { code: "621610", title: "Home Health Care Services", aliases: ["home health"] },
  { code: "623110", title: "Nursing Care Facilities (Skilled Nursing Facilities)", aliases: ["nursing care"] },
  { code: "624190", title: "Other Individual and Family Services", aliases: ["family services"] },

  // Arts / Media
  { code: "541921", title: "Photography Studios, Portrait", aliases: ["photography"] },
  { code: "541922", title: "Commercial Photography", aliases: ["commercial photography"] },
  { code: "711510", title: "Independent Artists, Writers, and Performers", aliases: ["writers", "performers"] },
  { code: "512110", title: "Motion Picture and Video Production", aliases: ["video production", "film"] },
  { code: "541930", title: "Translation and Interpretation Services", aliases: ["translation", "interpretation", "linguistics"] },

  // Repair / Maintenance
  { code: "811210", title: "Electronic and Precision Equipment Repair and Maintenance", aliases: ["electronics repair", "equipment maintenance"] },
  { code: "811310", title: "Commercial and Industrial Machinery and Equipment Repair", aliases: ["industrial repair"] },
];

export interface NaicsSearchResult extends NaicsCode {
  matchScore: number;
}

export function searchNaicsCodes(query: string, limit = 8): NaicsSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: NaicsSearchResult[] = [];
  for (const item of COMMON_NAICS_CODES) {
    let score = 0;

    if (item.code === q) score = 100;
    else if (item.code.startsWith(q)) score = 90 - (item.code.length - q.length);
    else if (item.code.includes(q) && /^\d+$/.test(q)) score = 70;

    const titleLower = item.title.toLowerCase();
    if (titleLower === q) score = Math.max(score, 95);
    else if (titleLower.startsWith(q)) score = Math.max(score, 80);
    else if (titleLower.includes(q)) score = Math.max(score, 60);

    for (const alias of item.aliases || []) {
      const aliasLower = alias.toLowerCase();
      if (aliasLower === q) score = Math.max(score, 85);
      else if (aliasLower.startsWith(q)) score = Math.max(score, 75);
      else if (aliasLower.includes(q)) score = Math.max(score, 55);
    }

    if (score > 0) {
      results.push({ ...item, matchScore: score });
    }
  }

  results.sort((a, b) => b.matchScore - a.matchScore);
  return results.slice(0, limit);
}

export function findNaicsByCode(code: string): NaicsCode | undefined {
  return COMMON_NAICS_CODES.find((item) => item.code === code);
}
