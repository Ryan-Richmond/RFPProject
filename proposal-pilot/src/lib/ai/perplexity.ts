/**
 * Perplexity Sonar API client
 *
 * Used for optional agency research and intelligence enrichment.
 * Non-blocking — if this fails, the core workflow proceeds without it.
 */

const PERPLEXITY_BASE_URL = "https://api.perplexity.ai";

interface SonarSearchResult {
  answer: string;
  citations: string[];
}

/**
 * Search for agency intelligence using Perplexity Sonar Pro.
 * Returns grounded search results with citations.
 */
export async function searchAgencyIntel(
  query: string
): Promise<SonarSearchResult | null> {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    console.warn(
      "PERPLEXITY_API_KEY not set — skipping agency intelligence enrichment."
    );
    return null;
  }

  try {
    const response = await fetch(`${PERPLEXITY_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content:
              "You are a government contracting research assistant. Provide factual, cited information about agencies, incumbents, and recent awards.",
          },
          {
            role: "user",
            content: query,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("Perplexity API error:", response.status);
      return null;
    }

    const data = await response.json();
    return {
      answer: data.choices?.[0]?.message?.content || "",
      citations: data.citations || [],
    };
  } catch (error) {
    console.error("Perplexity search failed:", error);
    return null;
  }
}
