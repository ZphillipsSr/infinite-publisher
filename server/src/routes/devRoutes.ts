import { Router } from "express";
import { searchProjectKb } from "../devtools/kb/indexer";

const router = Router();

router.get("/search", async (req, res) => {
  try {
    const q = (req.query.q as string | undefined)?.trim() || "";
    const kRaw = req.query.k as string | undefined;
    const topK = kRaw ? Math.min(parseInt(kRaw, 10) || 8, 32) : 8;

    if (!q) {
      return res.status(400).json({
        ok: false,
        error: "Missing required query parameter: q",
      });
    }

    console.log("[/api/dev/search] incoming query:", q, "topK:", topK);

    const results = await searchProjectKb(q, topK);

    console.log("[/api/dev/search] got", results.length, "results");

    return res.json({
      ok: true,
      query: q,
      topK,
      results: results.map((r) => ({
        filePath: r.record.filePath,
        startLine: r.record.startLine,
        endLine: r.record.endLine,
        language: r.record.language,
        score: r.score,
        content:
          r.record.content.length > 400
            ? r.record.content.slice(0, 400) + "..."
            : r.record.content,
      })),
    });
  } catch (err: any) {
    console.error("Error in /api/dev/search:", err);
    return res.status(500).json({
      ok: false,
      error: "Internal error while searching project KB",
    });
  }
});

export default router;