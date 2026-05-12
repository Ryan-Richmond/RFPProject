import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { callAgentAPI } from "@/lib/ai/perplexity";
import { COMMON_NAICS_CODES } from "@/lib/profile/naics-codes";

type SuggestKind = "naics" | "capabilities";

interface SuggestionResponse {
  suggestions: Array<{
    value: string;
    label?: string;
    rationale?: string;
  }>;
}

function safeJsonExtract(text: string): unknown {
  if (!text) return null;
  const cleaned = text.replace(/```json?/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/[[{][\s\S]*[\]}]/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
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
    const kind = body.kind as SuggestKind;
    const freeText = (body.text as string | undefined)?.trim() || "";
    const existing = Array.isArray(body.existing) ? (body.existing as string[]) : [];

    if (kind !== "naics" && kind !== "capabilities") {
      return NextResponse.json(
        { error: "kind must be 'naics' or 'capabilities'" },
        { status: 400 }
      );
    }

    // Gather context from saved profile + evidence chunks.
    const [{ data: profile }, { data: chunks }] = await Promise.all([
      supabase
        .from("client_profiles")
        .select("business_description,core_capabilities,naics_codes")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      supabase
        .from("evidence_chunks")
        .select("content,keywords,category")
        .eq("workspace_id", workspaceId)
        .eq("is_excluded", false)
        .limit(40),
    ]);

    const businessDescription = profile?.business_description || "";
    const evidenceSnippets = (chunks || [])
      .map((c) => c.content || "")
      .filter(Boolean)
      .slice(0, 20)
      .map((s) => s.slice(0, 400))
      .join("\n---\n");

    const evidenceKeywords = Array.from(
      new Set(
        (chunks || [])
          .flatMap((c) => (Array.isArray(c.keywords) ? c.keywords : []))
          .filter(Boolean)
      )
    ).slice(0, 40);

    if (kind === "capabilities") {
      const prompt = `You are helping a federal contractor populate their company profile.
Generate a list of specific service capabilities they likely offer, based on the following context.

BUSINESS DESCRIPTION:
${businessDescription || "(not provided)"}

USER-PROVIDED HINT:
${freeText || "(none)"}

EXTRACTED KEYWORDS FROM UPLOADED DOCS:
${evidenceKeywords.join(", ") || "(none)"}

EVIDENCE EXCERPTS FROM UPLOADED COMPANY DOCS:
${evidenceSnippets.slice(0, 4000) || "(none)"}

EXISTING CAPABILITIES (do not repeat):
${existing.join(", ") || "(none)"}

Return strict JSON:
{
  "suggestions": [
    { "value": "Capability Name", "rationale": "1-sentence why it fits this company" }
  ]
}

Generate 6-10 suggestions. Use established government-contracting capability terminology
(e.g. "DevSecOps", "Cloud Migration", "Penetration Testing", "Program Management", "Acquisition Support").
Each capability should be 1-5 words. Do not include capabilities already in the existing list.`;

      const aiResponse = await callAgentAPI(
        {
          input: prompt,
          instructions: "Output JSON only. Use specific, established industry terms.",
          model: "anthropic/claude-sonnet-4-6",
        },
        { workspaceId, operationType: "profile_suggest_capabilities" }
      );

      const parsed = safeJsonExtract(aiResponse.outputText) as Partial<SuggestionResponse> | null;
      const suggestions = Array.isArray(parsed?.suggestions)
        ? parsed!.suggestions
            .filter((s) => s && typeof s.value === "string")
            .map((s) => ({
              value: s.value.trim(),
              rationale: typeof s.rationale === "string" ? s.rationale : undefined,
            }))
            .filter((s) => s.value && !existing.includes(s.value))
        : [];

      return NextResponse.json({ suggestions });
    }

    // NAICS suggestions — restrict the AI to a known list of common federal codes
    // so it can't fabricate code numbers.
    const codeMenu = COMMON_NAICS_CODES.map(
      (n) => `${n.code} — ${n.title}`
    ).join("\n");

    const prompt = `You are helping a federal contractor pick the correct NAICS codes.
Based on the company context below, choose the most relevant NAICS codes ONLY from the menu provided.
Do NOT invent codes that are not in the menu.

BUSINESS DESCRIPTION:
${businessDescription || "(not provided)"}

USER-PROVIDED HINT:
${freeText || "(none)"}

EXTRACTED KEYWORDS FROM UPLOADED DOCS:
${evidenceKeywords.join(", ") || "(none)"}

EVIDENCE EXCERPTS FROM UPLOADED COMPANY DOCS:
${evidenceSnippets.slice(0, 3000) || "(none)"}

EXISTING NAICS CODES (do not repeat):
${existing.join(", ") || "(none)"}

NAICS MENU (only choose from these):
${codeMenu}

Return strict JSON:
{
  "suggestions": [
    { "value": "541512", "label": "Computer Systems Design Services", "rationale": "Why this code fits" }
  ]
}

Return 3-6 suggestions, ranked from best fit to weakest. Do not include codes already in the existing list.`;

    const aiResponse = await callAgentAPI(
      {
        input: prompt,
        instructions: "Output JSON only. Pick codes strictly from the provided menu.",
        model: "anthropic/claude-sonnet-4-6",
      },
      { workspaceId, operationType: "profile_suggest_naics" }
    );

    const parsed = safeJsonExtract(aiResponse.outputText) as Partial<SuggestionResponse> | null;
    const validCodes = new Set(COMMON_NAICS_CODES.map((n) => n.code));
    const suggestions = Array.isArray(parsed?.suggestions)
      ? parsed!.suggestions
          .filter((s) => s && typeof s.value === "string")
          .map((s) => {
            const code = s.value.replace(/\D/g, "").slice(0, 6);
            const known = COMMON_NAICS_CODES.find((n) => n.code === code);
            return {
              value: code,
              label: known?.title || s.label,
              rationale: typeof s.rationale === "string" ? s.rationale : undefined,
            };
          })
          .filter((s) => s.value && validCodes.has(s.value) && !existing.includes(s.value))
      : [];

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Profile suggest error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Suggestion failed" },
      { status: 500 }
    );
  }
}
