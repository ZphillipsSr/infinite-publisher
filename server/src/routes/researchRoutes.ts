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
      provider?: string;
    };

    if (!query || !query.trim()) {
      return res.status(400).json({ error: "query is required" });
    }

    try {
      const { sources, provider } = await runWebSearch(query.trim());

      // Use AI summary if available (inside summarizeSearchResults)
      const summary = await summarizeSearchResults(query.trim(), sources);

      res.json({
        query: query.trim(),
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
      provider?: string;
    };

    if (!claim || !claim.trim()) {
      return res.status(400).json({ error: "claim is required" });
    }

    try {
      const result = await factCheckClaim(claim.trim(), context);

      // factCheckClaim already handles AI errors and rate limits,
      // and always returns a structured result.
      res.json({
        claim: claim.trim(),
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