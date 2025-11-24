import { Express, Request, Response } from "express";
import {
  runWebSearch,
  summarizeSearchResults,
  factCheckClaim
} from "../services/researchService";

export function registerResearchRoutes(app: Express) {
  // -------------------------
  // POST /api/research/search
  // -------------------------
  app.post("/api/research/search", async (req: Request, res: Response) => {
    const { query } = req.body as {
      query?: string;
    };

    // User-provided API key (optional)
    const userOpenAIKey = (req.headers["x-user-openai-key"] as
      | string
      | undefined)?.trim();

    if (!query || !query.trim()) {
      return res.status(400).json({ error: "query is required" });
    }

    try {
      const cleaned = query.trim();

      const { sources, provider } = await runWebSearch(cleaned);

      const summary = await summarizeSearchResults(
        cleaned,
        sources,
        userOpenAIKey // <-- pass user key
      );

      res.json({
        query: cleaned,
        provider,
        summary,
        sources
      });
    } catch (err) {
      console.error("Research search failed:", err);
      res.status(500).json({
        query: query.trim(),
        provider: "error",
        summary: "Research search failed due to a server error.",
        sources: []
      });
    }
  });

  // ------------------------------
  // POST /api/research/fact-check
  // ------------------------------
  app.post("/api/research/fact-check", async (req: Request, res: Response) => {
    const { claim, context } = req.body as {
      claim?: string;
      context?: string;
    };

    // User OpenAI key support
    const userOpenAIKey = (req.headers["x-user-openai-key"] as
      | string
      | undefined)?.trim();

    if (!claim || !claim.trim()) {
      return res.status(400).json({ error: "claim is required" });
    }

    try {
      const cleaned = claim.trim();

      const result = await factCheckClaim(
        cleaned,
        context,
        userOpenAIKey // <-- pass in user key
      );

      res.json({
        claim: cleaned,
        ...result
      });
    } catch (err) {
      console.error("Fact-check failed (route-level):", err);
      res.json({
        claim: claim.trim(),
        provider: "error",
        result: "unknown",
        explanation:
          "Fact-check failed due to an unexpected server error. Please try again later.",
        sources: []
      });
    }
  });
}