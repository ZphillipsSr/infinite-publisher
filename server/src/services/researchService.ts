// src/services/researchService.ts
//
// Unified Engine Patch (Phase 2B)
//
// - All AI summarization & fact-checking now uses runAIUnified()
// - No OpenAI credit errors
// - No paid OpenRouter models are ever used
// - Tavily + Serper search remain unchanged
// - Research behavior now consistent with the rest of the app

import fetch from "node-fetch";
import { TAVILY_API_KEY, SERPER_API_KEY, OPENROUTER_KEY } from "../config";
import { ResearchSource } from "../types/project";
import { runAIUnified, ChatMessage } from "./aiEngine";

/* -------------------------------------------------------
   Provider Selection Logic
--------------------------------------------------------- */
let providerScores = { tavily: 1, serper: 1 };

function chooseProvider(query: string): "tavily" | "serper" | "auto" {
  const q = query.toLowerCase();

  if (
    q.includes("who") ||
    q.includes("what") ||
    q.includes("where") ||
    q.includes("when") ||
    q.includes("why") ||
    q.includes("how")
  ) {
    return "tavily";
  }

  if (query.length < 50) return "serper";

  return "auto";
}

/* -------------------------------------------------------
   Tavily Search Wrapper
--------------------------------------------------------- */
async function searchTavily(query: string): Promise<ResearchSource[] | null> {
  if (!TAVILY_API_KEY) return null;

  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: "basic",
        max_results: 5
      })
    });

    if (!r.ok) return null;
    const data: any = await r.json();
    const arr = Array.isArray(data.results) ? data.results : [];

    providerScores.tavily += 0.5;

    return arr.slice(0, 5).map((r: any) => ({
      title: r.title || "(no title)",
      url: r.url || "",
      snippet: r.content || ""
    }));
  } catch (err) {
    console.error("Tavily error:", err);
    providerScores.tavily -= 0.2;
    return null;
  }
}

/* -------------------------------------------------------
   Serper Search Wrapper
--------------------------------------------------------- */
async function searchSerper(query: string): Promise<ResearchSource[] | null> {
  if (!SERPER_API_KEY) return null;

  try {
    const r = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": SERPER_API_KEY
      },
      body: JSON.stringify({ q: query, num: 5 })
    });

    if (!r.ok) return null;
    const data: any = await r.json();
    const arr = Array.isArray(data.organic) ? data.organic : [];

    providerScores.serper += 0.5;

    return arr.slice(0, 5).map((r: any) => ({
      title: r.title || "(no title)",
      url: r.link || "",
      snippet: r.snippet || ""
    }));
  } catch (err) {
    console.error("Serper error:", err);
    providerScores.serper -= 0.2;
    return null;
  }
}

/* -------------------------------------------------------
   Determine Which Provider to Use
--------------------------------------------------------- */
export async function runWebSearch(query: string): Promise<{
  sources: ResearchSource[];
  provider: string;
}> {
  const preferred = chooseProvider(query);

  let sources: ResearchSource[] | null = null;
  let providerUsed = "none";

  const tryOrder =
    preferred === "auto"
      ? providerScores.tavily >= providerScores.serper
        ? ["tavily", "serper"]
        : ["serper", "tavily"]
      : preferred === "tavily"
      ? ["tavily", "serper"]
      : ["serper", "tavily"];

  for (const p of tryOrder) {
    if (p === "tavily") {
      sources = await searchTavily(query);
      if (sources && sources.length > 0) {
        providerUsed = "tavily";
        break;
      }
    }
    if (p === "serper") {
      sources = await searchSerper(query);
      if (sources && sources.length > 0) {
        providerUsed = "serper";
        break;
      }
    }
  }

  if (!sources) {
    return {
      sources: [],
      provider: "none"
    };
  }

  return {
    sources,
    provider: providerUsed
  };
}

/* -------------------------------------------------------
   Summarize Search Results (Unified AI)
--------------------------------------------------------- */
export async function summarizeSearchResults(
  query: string,
  sources: ResearchSource[],
  userOpenAIKey?: string
): Promise<string> {
  if (!sources || sources.length === 0) {
    return "No search sources were available for this query.";
  }

  // AI summary allowed only if OpenRouter OR user's OpenAI key exists
  const aiEnabled = !!OPENROUTER_KEY || !!userOpenAIKey;

  if (!aiEnabled) {
    return `Found ${sources.length} sources. AI summarizer disabled.`;
  }

  const context = sources
    .map(
      (s, i) =>
        `[${i + 1}] ${s.title}\nURL: ${s.url}\nSnippet: ${s.snippet || ""}`
    )
    .join("\n\n")
    .slice(0, 9000);

  const prompt = `
Summarize these search results in 5–7 neutral sentences.
Highlight consensus, disagreements, and uncertainty.
Do not add information that is not in the excerpts.

Query:
"${query}"

Excerpts:
${context}
`;

  const messages: ChatMessage[] = [
    { role: "system", content: "You summarize conservatively and neutrally." },
    { role: "user", content: prompt }
  ];

  try {
    return await runAIUnified(
      messages,
      {
        purpose: "research",
        temperature: 0.3,
        maxTokens: 800
      },
      userOpenAIKey
    );
  } catch (err) {
    console.error("AI summary error:", err);
    return `Found ${sources.length} sources. AI summarizer unavailable.`;
  }
}

/* -------------------------------------------------------
   Fact-Checking (Unified AI)
--------------------------------------------------------- */
export async function factCheckClaim(
  claim: string,
  manuscriptContext: string | undefined,
  userOpenAIKey?: string
): Promise<{
  result: string;
  explanation: string;
  provider: string;
  sources: ResearchSource[];
}> {
  const { sources, provider } = await runWebSearch(claim);

  // AI allowed only if OpenRouter or user key
  const aiEnabled = !!OPENROUTER_KEY || !!userOpenAIKey;

  if (!aiEnabled || sources.length === 0) {
    return {
      result: "unknown",
      explanation: "AI fact-checking unavailable. Review sources manually.",
      provider,
      sources
    };
  }

  const excerpts = sources
    .map(
      (s, i) =>
        `[${i + 1}] ${s.title}\nURL: ${s.url}\nSnippet: ${s.snippet || ""}`
    )
    .join("\n\n")
    .slice(0, 9000);

  const prompt = `
You are a cautious fact-checker.

Claim:
"${claim}"

Context:
${(manuscriptContext || "").slice(0, 1500)}

Excerpts:
${excerpts}

Respond ONLY in this format:

Result: <TRUE|FALSE|MIXED|UNKNOWN>
Explanation: <3–6 short cautious sentences>
`;

  const messages: ChatMessage[] = [
    { role: "system", content: "You are a cautious fact-checker." },
    { role: "user", content: prompt }
  ];

  let ai: string;

  try {
    ai = await runAIUnified(
      messages,
      {
        purpose: "research",
        temperature: 0.1,
        maxTokens: 800
      },
      userOpenAIKey
    );
  } catch (err) {
    console.error("Fact-check AI error:", err);
    return {
      result: "unknown",
      explanation:
        "AI failed or was rate-limited. Unable to complete fact-check.",
      provider,
      sources
    };
  }

  // Parse result and explanation
  let result = "unknown";
  let explanation = ai;

  const lines = ai.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    const m = line.match(/^Result:\s*(true|false|mixed|unknown)/i);
    if (m) {
      result = m[1].toLowerCase();
    }

    const e = line.match(/^Explanation:\s*(.*)$/i);
    if (e) {
      explanation = e[1] + "\n" + lines.slice(i + 1).join("\n");
      break;
    }
  }

  return {
    result,
    explanation,
    provider: provider + "+ai",
    sources
  };
}