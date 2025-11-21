// src/services/researchService.ts
import fetch from "node-fetch";
import { TAVILY_API_KEY, SERPER_API_KEY, OPENROUTER_KEY, OPENROUTER_MODEL_ID } from "../config";
import { ResearchSource } from "../types/project";
import { callOpenRouterChat } from "./aiService";

export async function runWebSearch(query: string): Promise<{
  sources: ResearchSource[];
  provider: string;
}> {
  if (TAVILY_API_KEY && TAVILY_API_KEY.trim() !== "") {
    try {
      const tavilyResp = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query,
          search_depth: "basic",
          max_results: 5
        })
      });

      if (tavilyResp.ok) {
        const data: any = await tavilyResp.json();
        const results = Array.isArray(data.results) ? data.results : [];
        const sources: ResearchSource[] = results.slice(0, 5).map((r: any) => ({
          title: r.title || "(no title)",
          url: r.url || "",
          snippet: r.content || ""
        }));
        return { sources, provider: "tavily" };
      } else {
        const txt = await tavilyResp.text();
        console.error("Tavily error:", tavilyResp.status, txt);
      }
    } catch (err) {
      console.error("Tavily exception:", err);
    }
  }

  if (SERPER_API_KEY && SERPER_API_KEY.trim() !== "") {
    try {
      const serperResp = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": SERPER_API_KEY
        },
        body: JSON.stringify({
          q: query,
          num: 5
        })
      });

      if (serperResp.ok) {
        const data: any = await serperResp.json();
        const organic = Array.isArray(data.organic) ? data.organic : [];
        const sources: ResearchSource[] = organic.slice(0, 5).map((r: any) => ({
          title: r.title || "(no title)",
          url: r.link || "",
          snippet: r.snippet || ""
        }));
        return { sources, provider: "serper" };
      } else {
        const txt = await serperResp.text();
        console.error("Serper error:", serperResp.status, txt);
      }
    } catch (err) {
      console.error("Serper exception:", err);
    }
  }

  return { sources: [], provider: "none" };
}

export async function summarizeSearchResults(
  query: string,
  sources: ResearchSource[]
): Promise<string> {
  if (!OPENROUTER_KEY || !OPENROUTER_MODEL_ID || sources.length === 0) {
    return sources.length === 0
      ? "No sources could be retrieved. Check your TAVILY_API_KEY / SERPER_API_KEY or try a different query."
      : `Found ${sources.length} sources related to “${query}”. Review them below for details.`;
  }

  const contextText = sources
    .map(
      (s, idx) =>
        `[${idx + 1}] ${s.title}\nURL: ${s.url}\nSnippet: ${s.snippet}`
    )
    .join("\n\n")
    .slice(0, 8000);

  const prompt = `
You are a research assistant.

The user asked:
"${query}"

You are given some web search results. Summarize the main relevant points in 3–6 sentences, neutrally, and mention that these are approximate / not definitive.

Web results:
${contextText}
`;

  try {
    const aiSummary = await callOpenRouterChat(
      [
        {
          role: "system",
          content: "You summarize web search results neutrally and concisely."
        },
        { role: "user", content: prompt }
      ],
      0.3
    );
    return aiSummary || "";
  } catch (e) {
    console.error("OpenRouter summarize exception:", e);
    return `Found ${sources.length} sources related to “${query}”. Review them below for details.`;
  }
}

export async function factCheckClaim(
  claim: string,
  context: string | undefined
): Promise<{
  result: string;
  explanation: string;
  provider: string;
  sources: ResearchSource[];
}> {
  try {
    const { sources, provider } = await runWebSearch(claim.trim());

    // If no AI key or no sources → we can't really judge truth
    if (!OPENROUTER_KEY || !OPENROUTER_MODEL_ID || sources.length === 0) {
      return {
        result: "unknown",
        explanation:
          "Unable to confidently fact-check this claim (missing AI key/model or search results). Review the listed sources directly.",
        provider,
        sources
      };
    }

    const contextText = sources
      .map(
        (s, idx) =>
          `[${idx + 1}] ${s.title}\nURL: ${s.url}\nSnippet: ${s.snippet}`
      )
      .join("\n\n")
      .slice(0, 8000);

    const prompt = `
You are a cautious fact-checking assistant.

You are given:
- A claim
- Some context from the user's manuscript (optional)
- Web excerpts from search results

Your job:
1. Evaluate whether the claim is supported, contradicted, mixed, or not clearly answerable based on the web excerpts.
2. Choose a single label from: TRUE, FALSE, MIXED, UNKNOWN.
3. Provide a concise explanation (3–6 sentences), explicitly noting uncertainty if evidence is limited.
4. Do NOT assume anything beyond what the excerpts support.

Respond in this exact format:

Result: <TRUE|FALSE|MIXED|UNKNOWN>
Explanation: <your explanation here>

Claim:
"${claim.trim()}"

User manuscript context (may be partial and biased, use carefully):
${(context || "").slice(0, 2000)}

Web search excerpts:
${contextText}
`;

    let raw: string;
    try {
      raw = await callOpenRouterChat(
        [
          {
            role: "system",
            content:
              "You are a cautious fact-checker. You never overstate certainty."
          },
          { role: "user", content: prompt }
        ],
        0.1
      );
    } catch (e) {
      // 👇 This is where your RateLimitError (429) lands
      console.error("OpenRouter fact-check error:", e);
      return {
        result: "unknown",
        explanation:
          "Fact-check could not be completed because the AI provider was rate-limited or unavailable. Please try again later.",
        provider: provider || "error",
        sources
      };
    }

    let result = "unknown";
    let explanation = raw;

    const lines = raw.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const m = line.match(/^Result:\s*(.+)$/i);
      if (m) {
        const val = m[1].trim().toLowerCase();
        if (["true", "false", "mixed", "unknown"].includes(val)) {
          result = val;
        }
      }
      const e2 = line.match(/^Explanation:\s*(.+)$/i);
      if (e2) {
        explanation = e2[1].trim() + "\n" + lines.slice(i + 1).join("\n");
        break;
      }
    }

    return {
      result,
      explanation,
      provider: provider + "+openrouter",
      sources
    };
  } catch (err) {
    // Any unexpected error (including network stuff)
    console.error("Fact-check failed (service-level):", err);
    return {
      result: "unknown",
      explanation:
        "Fact-check failed due to a server or network error. Please try again later.",
      provider: "error",
      sources: []
    };
  }
}