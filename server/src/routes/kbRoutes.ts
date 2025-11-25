import { Router } from "express";
import { searchProjectKb } from "../devtools/kb/indexer";

const router = Router();

/**
 * GET /api/devtools/kb/search?query=...&topK=8
 */
router.get("/search", async (req, res) => {
  try {
    const query = String(req.query.query || "").trim();
    const topK = req.query.topK ? Number(req.query.topK) : 8;

    if (!query) {
      return res.status(400).json({ error: "Missing 'query' parameter" });
    }

    const results = await searchProjectKb(query, topK || 8);

    // Return only the essentials to the client
    const payload = results.map((r) => ({
      score: r.score,
      id: r.record.id,
      filePath: r.record.filePath,
      relPath: r.record.relPath,
      startLine: r.record.startLine,
      endLine: r.record.endLine,
      language: r.record.language,
      // small snippet of content
      content: r.record.content.slice(0, 400),
    }));

    res.json({ ok: true, results: payload });
  } catch (err: any) {
    console.error("KB search error:", err);
    res.status(500).json({ ok: false, error: err?.message || "KB search failed" });
  }
});

export default router;