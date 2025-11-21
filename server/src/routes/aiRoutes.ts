import { Express, Request, Response } from "express";
import { callOpenRouterChat, getModelRuntimeStatus } from "../services/aiService";
import { OPENROUTER_KEY } from "../config";

type StyleProfile = {
  tone?: string;
  audience?: string;
  genre?: string;
  pov?: string;
  tense?: string;
  pacing?: string;
  formality?: string;
  notes?: string;
};

export function registerAIRoutes(app: Express) {
  // Simple check: AI enabled?
  const aiEnabled = !!OPENROUTER_KEY;

  // --------- General Chat ---------
  app.post("/api/ai/chat", async (req: Request, res: Response) => {
    const { message } = req.body as { message?: string };

    if (!aiEnabled) {
      return res.json({
        reply:
          '[Local stub] Set OPENROUTER_API_KEY and model env vars to enable real AI responses.'
      });
    }

    try {
      const reply = await callOpenRouterChat(
        [
          {
            role: "system",
            content:
              "You are a helpful writing and publishing assistant. Help the user with editing, structure, and KDP-related questions."
          },
          {
            role: "user",
            content: message || ""
          }
        ],
        0.7
      );

      res.json({ reply });
    } catch (err: any) {
      console.error("OpenRouter chat error:", err?.message || err);
      res.status(500).json({
        reply: "Error contacting OpenRouter API (chat)."
      });
    }
  });

  // --------- Context Chat (with manuscript) ---------
  app.post("/api/ai/context", async (req: Request, res: Response) => {
    const { message, manuscript, styleProfile } = req.body as {
      message?: string;
      manuscript?: string;
      styleProfile?: StyleProfile;
    };

    if (!aiEnabled) {
      return res.json({
        reply:
          '[Local stub] Context mode requires OPENROUTER_API_KEY and models in .env.'
      });
    }

    try {
      let styleSummary = "";
      if (styleProfile) {
        const parts: string[] = [];
        if (styleProfile.tone) parts.push(`Tone: ${styleProfile.tone}`);
        if (styleProfile.audience) parts.push(`Audience: ${styleProfile.audience}`);
        if (styleProfile.genre) parts.push(`Genre: ${styleProfile.genre}`);
        if (styleProfile.pov) parts.push(`POV: ${styleProfile.pov}`);
        if (styleProfile.tense) parts.push(`Tense: ${styleProfile.tense}`);
        if (styleProfile.pacing) parts.push(`Pacing: ${styleProfile.pacing}`);
        if (styleProfile.formality)
          parts.push(`Formality: ${styleProfile.formality}`);
        if (styleProfile.notes)
          parts.push(`Extra notes: ${styleProfile.notes}`);
        if (parts.length > 0) {
          styleSummary =
            "Author style profile:\n" + parts.map((p) => `- ${p}`).join("\n");
        }
      }

      const prompt = `
You are an expert writing, editing, and publishing assistant.
You analyze manuscripts deeply and provide clear, actionable improvements.

The user asked:
"${message}"

${styleSummary ? styleSummary + "\n" : ""}Below is the manuscript text. Use it as needed to answer.
If you reference the text, be specific, but keep answers concise.

--- MANUSCRIPT BEGIN ---
${(manuscript || "").slice(0, 100000)}
--- MANUSCRIPT END ---
`;

      const reply = await callOpenRouterChat(
        [
          {
            role: "system",
            content:
              "You are a precise manuscript editing and publishing assistant. Honor the author's stated style profile whenever it is provided."
          },
          { role: "user", content: prompt }
        ],
        0.4
      );

      res.json({ reply });
    } catch (err: any) {
      console.error("Context AI error:", err?.message || err);
      res.status(500).json({ reply: "OpenRouter context mode error." });
    }
  });

  // --------- Rewrite Selection ---------
  app.post("/api/ai/rewrite", async (req: Request, res: Response) => {
    const { instruction, selectedText, manuscript, styleProfile } = req.body as {
      instruction?: string;
      selectedText?: string;
      manuscript?: string;
      styleProfile?: StyleProfile;
    };

    if (!aiEnabled) {
      return res.json({
        rewritten:
          '[Local stub] Set OPENROUTER_API_KEY and models in .env for real rewrite behavior.'
      });
    }

    if (!selectedText || !selectedText.trim()) {
      return res.status(400).json({ error: "selectedText is required." });
    }

    try {
      let styleSummary = "";
      if (styleProfile) {
        const parts: string[] = [];
        if (styleProfile.tone) parts.push(`Tone: ${styleProfile.tone}`);
        if (styleProfile.audience) parts.push(`Audience: ${styleProfile.audience}`);
        if (styleProfile.genre) parts.push(`Genre: ${styleProfile.genre}`);
        if (styleProfile.pov) parts.push(`POV: ${styleProfile.pov}`);
        if (styleProfile.tense) parts.push(`Tense: ${styleProfile.tense}`);
        if (styleProfile.pacing) parts.push(`Pacing: ${styleProfile.pacing}`);
        if (styleProfile.formality)
          parts.push(`Formality: ${styleProfile.formality}`);
        if (styleProfile.notes)
          parts.push(`Extra notes: ${styleProfile.notes}`);
        if (parts.length > 0) {
          styleSummary =
            "Author style profile:\n" + parts.map((p) => `- ${p}`).join("\n");
        }
      }

      const prompt = `
You are an expert line editor.

Task: Rewrite ONLY the given selected text according to the instruction.
- Preserve the author's core meaning and style as much as possible.
- Do NOT add surrounding context that wasn't in the selection.
- Output ONLY the rewritten text, with no extra commentary.

Instruction:
"${instruction}"

${styleSummary ? styleSummary + "\n" : ""}Selected text:
"${selectedText}"

(For additional context, here is some of the manuscript, but do not rewrite it directly. Use it only to infer tone and style.)

--- MANUSCRIPT CONTEXT BEGIN ---
${(manuscript || "").slice(0, 8000)}
--- MANUSCRIPT CONTEXT END ---
`;

      const rewritten = await callOpenRouterChat(
        [
          {
            role: "system",
            content:
              "You are a precise line editor that only returns the rewritten text and respects the author's style profile."
          },
          { role: "user", content: prompt }
        ],
        0.5
      );

      res.json({ rewritten });
    } catch (err: any) {
      console.error("Rewrite AI error:", err?.message || err);
      res.status(500).json({ error: "Server error in rewrite route." });
    }
  });

  // --------- AI Model Status (for dashboard) ---------
  app.get("/api/ai/models/status", (req: Request, res: Response) => {
    const status = getModelRuntimeStatus();
    res.json({
      aiEnabled,
      ...status
    });
  });
}