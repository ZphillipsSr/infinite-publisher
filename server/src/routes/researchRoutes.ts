import { Express, Request, Response } from "express";
import {
  runWebSearch,
  summarizeSearchResults,
  factCheckClaim
} from "../services/researchService";

export function registerResearchRoutes(app: Express) {
  /* -----------------------------------------------------------------------
     POST /api/research/search
     Returns:
       {
         provider: string,
         sources: Array<{ title?: string, url?: string, snippet?: string }>
       }
  ----------------------------------------------------------------------- */
  app.post("/api/research/search", async (req: Request, res: Response) => {
    const { query } = req.body as { query?: string };

    const userOpenAIKey = (req.headers["x-user-openai-key"] as
      | string
      | undefined)?.trim();

    if (!query || !query.trim()) {
      return res.status(400).json({ message: "query is required" });
    }

    const cleaned = query.trim();

    try {
      // 1) Perform the actual web search via Tavily / Serper
      const { sources, provider } = await runWebSearch(cleaned);

      // 2) Summarize results using AI (may use user-supplied key)
      await summarizeSearchResults(
        cleaned,
        sources,
        userOpenAIKey
      );

      // 3) Return consistent shape expected by ResearchPanel
      return res.json({
        provider,
        sources
      });
    } catch (err) {
      console.error("Research search failed:", err);
      return res.status(500).json({
        provider: "error",
        sources: [],
        message: "Research search failed due to a server error."
      });
    }
  });

  /* -----------------------------------------------------------------------
     POST /api/research/fact-check
     Returns:
       {
         result: string,
         explanation?: string,
         sources?: Array<{ title?: string, url?: string, snippet?: string }>
       }
  ----------------------------------------------------------------------- */
  app.post("/api/research/fact-check", async (req: Request, res: Response) => {
    const { claim, context } = req.body as {
      claim?: string;
      context?: string;
    };

    const userOpenAIKey = (req.headers["x-user-openai-key"] as
      | string
      | undefined)?.trim();

    if (!claim || !claim.trim()) {
      return res.status(400).json({ message: "claim is required" });
    }

    const cleaned = claim.trim();

    try {
      const result = await factCheckClaim(cleaned, context, userOpenAIKey);

      // Shape from factCheckClaim should already match:
      // { result, explanation?, sources? }
      return res.json(result);
    } catch (err) {
      console.error("Fact-check failed (route-level):", err);

      return res.status(500).json({
        result: "unknown",
        explanation:
          "Fact-check failed due to a server error. Please try again.",
        sources: []
      });
    }
  });
}