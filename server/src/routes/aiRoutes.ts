// src/routes/aiRoutes.ts
//
// Unified AI routes for Infinite Publisher.
// - Uses runAIUnified() from services/aiEngine
// - OpenRouter + free models only (per aiEngine.ts config)
// - Outline / back-cover use a TRUNCATED manuscript to avoid context-limit errors
// - Exposes /api/ai/models/status for ModelStatusPanel

import express from "express";
import { runAIUnified as runAI, ChatMessage } from "../services/aiEngine";

const router = express.Router();

/* ---------------------------------------------------------------------------
   Local AI env flags (mirrors aiEngine.ts so ModelStatusPanel can show status)
--------------------------------------------------------------------------- */

const AI_PROVIDER = process.env.AI_PROVIDER || "openrouter";
const AI_FREE_ONLY =
  (process.env.AI_FREE_ONLY || "true").toLowerCase() === "true";

const HAS_OPENROUTER_KEY = !!process.env.OPENROUTER_API_KEY;
const HAS_OPENAI_KEY = !!process.env.OPENAI_API_KEY;

// Keep these in sync with aiEngine.ts
const OPENROUTER_FREE_MODELS: string[] = [
  "google/gemma-3-4b-it:free",
  "google/gemma-3-12b-it:free",
  "google/gemma-3-27b-it:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
  "mistralai/mistral-nemo:free",
  "deepseek/deepseek-r1:free",
  "x-ai/grok-4.1-fast:free"
];

const OPENROUTER_PAID_MODELS: string[] = [
  // "openai/gpt-4o-mini", // intentionally disabled while AI_FREE_ONLY=true
];

const OPENAI_MODELS: string[] = ["gpt-4o-mini", "gpt-4.1-mini"];

/* ---------------------------------------------------------------------------
   Helpers
--------------------------------------------------------------------------- */

function normalizeMessages(raw: any[]): ChatMessage[] {
  return raw.map((m) => {
    if (!m.role || !m.content) {
      throw new Error("Invalid message format.");
    }
    return {
      role: m.role,
      content: m.content
    };
  });
}

// Hard cap so huge manuscripts don’t blow the context window
const MAX_MANUSCRIPT_CHARS = 30_000;

/* ---------------------------------------------------------------------------
   POST /api/ai/chat
   Main AI entry point for chat panel + book co-author console
--------------------------------------------------------------------------- */
router.post("/chat", async (req, res) => {
  try {
    const { messages, temperature, maxTokens, purpose } = req.body;

    const userOpenAIKey =
      req.headers["x-user-openai-key"] &&
      String(req.headers["x-user-openai-key"]).trim();

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Missing or invalid 'messages' array."
      });
    }

    const normalized = normalizeMessages(messages);

    const reply = await runAI(
      normalized,
      {
        purpose,
        temperature,
        maxTokens
      },
      userOpenAIKey
    );

    return res.json({
      ok: true,
      reply
    });
  } catch (err) {
    console.error("AI /chat error:", err);
    return res.status(500).json({
      ok: false,
      error: "AI request failed"
    });
  }
});

/* ---------------------------------------------------------------------------
   POST /api/ai/rewrite
   Rewrite a selected span of text with given instructions
--------------------------------------------------------------------------- */
router.post("/rewrite", async (req, res) => {
  try {
    const { text, instructions } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        ok: false,
        error: "Missing 'text' to rewrite."
      });
    }

    const safeInstructions =
      typeof instructions === "string" && instructions.trim().length > 0
        ? instructions.trim()
        : "Rewrite this text clearly and concisely while preserving meaning and tone.";

    const userKey =
      req.headers["x-user-openai-key"] &&
      String(req.headers["x-user-openai-key"]).trim();

    const msg: ChatMessage[] = [
      {
        role: "system",
        content:
          "You rewrite text clearly, concisely, and stylistically aligned with instructions."
      },
      {
        role: "user",
        content: `Instructions:\n${safeInstructions}\n\nText to rewrite:\n${text}`
      }
    ];

    const rewritten = await runAI(
      msg,
      { purpose: "rewrite", temperature: 0.4, maxTokens: 600 },
      userKey
    );

    return res.json({ ok: true, rewritten });
  } catch (err) {
    console.error("AI /rewrite error:", err);
    return res.status(500).json({ ok: false, error: "Rewrite failed" });
  }
});

/* ---------------------------------------------------------------------------
   POST /api/ai/analyze-manuscript
   Shared endpoint for:
   - Outline generation
   - Back-cover generation
   (frontend passes an `instructions` string saying what to do)
--------------------------------------------------------------------------- */
router.post("/analyze-manuscript", async (req, res) => {
  try {
    const { manuscript, instructions } = req.body;

    if (!manuscript || typeof manuscript !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Missing 'manuscript' in request body."
      });
    }

    const trimmed = manuscript.trim();
    if (!trimmed) {
      return res.status(400).json({
        ok: false,
        error: "Manuscript is empty."
      });
    }

    const userKey =
      req.headers["x-user-openai-key"] &&
      String(req.headers["x-user-openai-key"]).trim();

    // 🧠 Context guard: use only the first N characters
    const excerpt =
      trimmed.length > MAX_MANUSCRIPT_CHARS
        ? trimmed.slice(0, MAX_MANUSCRIPT_CHARS)
        : trimmed;

    const safeInstructions =
      typeof instructions === "string" && instructions.trim().length > 0
        ? instructions.trim()
        : "Analyze this manuscript excerpt and give structured feedback.";

    const msg: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are a manuscript analysis assistant for the Infinite Publisher app. " +
          "You may receive only an excerpt of the full book due to context limits. " +
          "Follow the user's instructions precisely, and if needed, note that your " +
          "analysis is based on a partial view."
      },
      {
        role: "user",
        content:
          `Instructions:\n${safeInstructions}\n\n` +
          `Manuscript excerpt (may be truncated):\n${excerpt}`
      }
    ];

    const reply = await runAI(
      msg,
      { purpose: "manuscript_context", temperature: 0.4, maxTokens: 800 },
      userKey
    );

    return res.json({ ok: true, reply });
  } catch (err) {
    console.error("Manuscript analyze error:", err);
    return res.status(500).json({ ok: false, error: "Analysis failed" });
  }
});

/* ---------------------------------------------------------------------------
   POST /api/ai/dev-console
   Dev / coding console assistant (no manuscript context by default)
--------------------------------------------------------------------------- */
router.post("/dev-console", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Missing 'prompt' for dev console."
      });
    }

    const userKey =
      req.headers["x-user-openai-key"] &&
      String(req.headers["x-user-openai-key"]).trim();

    const msg: ChatMessage[] = [
      { role: "system", content: "You are a helpful code assistant." },
      { role: "user", content: prompt }
    ];

    const reply = await runAI(
      msg,
      { purpose: "dev_console", temperature: 0.2, maxTokens: 600 },
      userKey
    );

    return res.json({ ok: true, reply });
  } catch (err) {
    console.error("Dev console AI error:", err);
    return res.status(500).json({ ok: false, error: "Developer console failed" });
  }
});

/* ---------------------------------------------------------------------------
   GET /api/ai/context
   Simple placeholder so any legacy calls don’t 404.
--------------------------------------------------------------------------- */
router.get("/context", async (req, res) => {
  try {
    return res.json({
      ok: true,
      context: "",
      message: "No manuscript context stored yet."
    });
  } catch (err: any) {
    console.error("AI context error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load AI context"
    });
  }
});

/* ---------------------------------------------------------------------------
   GET /api/ai/models/status
   Used by ModelStatusPanel to show provider + model info
--------------------------------------------------------------------------- */
router.get("/models/status", (req, res) => {
  try {
    const freeModels =
      AI_PROVIDER === "openrouter" ? OPENROUTER_FREE_MODELS : [];
    const paidModels =
      AI_PROVIDER === "openrouter" && !AI_FREE_ONLY
        ? OPENROUTER_PAID_MODELS
        : [];
    const openaiModels =
      AI_PROVIDER === "openai" ? OPENAI_MODELS : [];

    const activeModels =
      freeModels.length > 0
        ? freeModels
        : openaiModels.length > 0
        ? openaiModels
        : [];

    return res.json({
      ok: true,
      provider: AI_PROVIDER,
      freeOnly: AI_FREE_ONLY,
      activeModels,
      freeModels,
      paidModels,
      openaiModels,
      allModels: [...freeModels, ...paidModels, ...openaiModels],
      env: {
        hasOpenRouterKey: HAS_OPENROUTER_KEY,
        hasOpenAIKey: HAS_OPENAI_KEY
      }
    });
  } catch (err) {
    console.error("Model status error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load model status"
    });
  }
});

export default router;