// src/routes/manuscriptsRoutes.ts
import { Express, Request, Response } from "express";
import multer from "multer";
import { Packer } from "docx";
import { createDocxFromManuscript } from "../services/docxService";
import { importManuscriptFromFile } from "../services/importService";
import { FormatResult } from "../types/project";

const upload = multer({ storage: multer.memoryStorage() });

export function registerManuscriptRoutes(app: Express) {
  // Format estimate
  app.post(
    "/api/manuscripts/format",
    (req: Request, res: Response<FormatResult | { error: string }>) => {
      const { content, trimSize, lineSpacing } = req.body as {
        content?: string;
        trimSize?: string;
        lineSpacing?: number;
      };

      if (!content || !content.trim()) {
        return res.status(400).json({ error: "content is required" });
      }

      const words = content
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 0);

      const wordCount = words.length;

      const baseWordsPerPage = 300;
      const spacingMultiplier =
        typeof lineSpacing === "number" && lineSpacing > 0
          ? lineSpacing / 1.15
          : 1;

      const wordsPerPage = baseWordsPerPage / spacingMultiplier;
      const estimatedPages = Math.max(
        1,
        Math.round(wordCount / (wordsPerPage || baseWordsPerPage))
      );

      const result: FormatResult = {
        wordCount,
        estimatedPages,
        trimSize: trimSize || "6x9",
        lineSpacing: lineSpacing || 1.15
      };

      res.json(result);
    }
  );

  // DOCX export
  app.post(
    "/api/manuscripts/export-docx",
    async (req: Request, res: Response) => {
      const { content, trimSize, lineSpacing, title } = req.body as {
        content?: string;
        trimSize?: string;
        lineSpacing?: number;
        title?: string;
      };

      if (!content || !content.trim()) {
        return res.status(400).json({ error: "content is required" });
      }

      try {
        const doc = createDocxFromManuscript({
          content,
          title,
          trimSize,
          lineSpacing
        });

        const buffer = await Packer.toBuffer(doc);
        const safeTitle = (title || "manuscript").replace(
          /[<>:"/\\|?*]+/g,
          "_"
        );

        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${safeTitle}.docx"`
        );

        res.send(buffer);
      } catch (err) {
        console.error("DOCX export error:", err);
        res.status(500).json({ error: "Failed to generate DOCX interior." });
      }
    }
  );

  // Binary import (txt/pdf/doc/docx/epub)
  app.post(
    "/api/manuscripts/import-binary",
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded." });
        }

        const result = await importManuscriptFromFile({
          originalName: req.file.originalname || "file",
          buffer: req.file.buffer
        });

        res.json(result);
      } catch (err: any) {
        console.error("import-binary error:", err);
        const status = err?.status || 500;
        res.status(status).json({
          error:
            err?.message ||
            "Failed to import this file. Check the server logs for details."
        });
      }
    }
  );
}