// src/services/aiEngine.ts
//
// Unified AI engine for Infinite Publisher.
//
// Design goals (current configuration):
// - Use **OpenRouter only**, with **free-tier models only**.
// - Never call paid OpenRouter models (like openai/gpt-4o-mini)
//   while AI_FREE_ONLY=true.
// - Support user-supplied keys from the frontend (X-User-OpenAI-Key)
//   but you can simply NOT use that feature until your grant is live.
//
// If you later want to enable paid models or direct OpenAI usage,
// you can:
//   - change AI_PROVIDER, and/or
//   - set AI_FREE_ONLY=false in your `.env`.
//
// For now, we treat everything as: "OpenRouter + free models only".

import OpenAI from "openai";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type RunOptions = {
  purpose?: string;
  temperature?: number;
  maxTokens?: number;
};

// Backwards-compat alias for older code that imports AIOptions
export type AIOptions = RunOptions;

/* ---------------------------------------------------------------------------
   Unified AI Core v1 – Job-level types
--------------------------------------------------------------------------- */

export type AIJobType =
  | "chat"
  | "rewrite"
  | "summarize"
  | "outline"
  | "manuscript_edit"
  | "format_helper"
  | "research";

export interface AIJobRequest {
  jobType: AIJobType;
  userMessage: string;
  manuscriptText?: string;
  selectionText?: string;
  instructions?: string;
  styleProfileId?: string;
  formatPresetId?: string;
}

export interface AIJobResponse {
  ok: boolean;
  jobType: AIJobType;
  text?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Environment / configuration
// ---------------------------------------------------------------------------

const AI_PROVIDER = process.env.AI_PROVIDER || "openrouter"; // "openrouter" | "openai"
const AI_FREE_ONLY =
  (process.env.AI_FREE_ONLY || "true").toLowerCase() === "true";

// NOTE: For OpenRouter we expect OPENROUTER_API_KEY to be set in server/.env
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

// If you *later* want to support direct OpenAI, you can set this.
// For now, we don't rely on it.
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// Helper to build an OpenAI client configured correctly
function makeClient(userSuppliedKey?: string | null): OpenAI {
  const trimmedUserKey = userSuppliedKey?.trim();

  if (AI_PROVIDER === "openrouter") {
    const keyToUse = trimmedUserKey || OPENROUTER_API_KEY;

    if (!keyToUse) {
      console.warn(
        "[AI] No OpenRouter API key configured (OPENROUTER_API_KEY). " +
          "Set it in server/.env or provide a user key."
      );
    }

    return new OpenAI({
      apiKey: keyToUse,
      baseURL: "https://openrouter.ai/api/v1",
      // Optional headers recommended by OpenRouter (customize if you like)
      defaultHeaders: {
        "HTTP-Referer": "https://infinite-publisher.local", // or your repo URL
        "X-Title": "Infinite Publisher - Local Dev"
      }
    });
  }

  // Fallback: pure OpenAI provider (disabled in your current setup since
  // you are not setting OPENAI_API_KEY and not using this mode).
  const keyToUse = trimmedUserKey || OPENAI_API_KEY;

  if (!keyToUse) {
    console.warn(
      "[AI] No OpenAI API key configured (OPENAI_API_KEY). " +
        "Requests will likely fail if AI_PROVIDER=openai."
    );
  }

  return new OpenAI({
    apiKey: keyToUse
  });
}

// ---------------------------------------------------------------------------
// Model selection
// ---------------------------------------------------------------------------

// Free-tier OpenRouter models only.
// These slugs are from OpenRouter's catalog; if any become unavailable
// on a given day, we fall through to the next one.
const OPENROUTER_FREE_MODELS: string[] = [
  "google/gemma-3-4b-it:free",                 // Google: Gemma 3 4B (free)
  "google/gemma-3-12b-it:free",                // Google: Gemma 3 12B (free)
  "google/gemma-3-27b-it:free",                // Google: Gemma 3 27B (free)
  "mistralai/mistral-small-3.2-24b-instruct:free", // Mistral Small 3 (free)
  "mistralai/mistral-nemo:free",               // Mistral Nemo (free)
  "deepseek/deepseek-r1:free",                 // DeepSeek R1 (free)
  "x-ai/grok-4.1-fast:free"                    // Grok 4.1 Fast (free)
];

// If/when you want to use paid OpenRouter models, you can add them here
// and set AI_FREE_ONLY=false in your .env. For now, we leave this empty.
const OPENROUTER_PAID_MODELS: string[] = [
  // "openai/gpt-4o-mini", // intentionally DISABLED in your current config
];

// Example list for direct OpenAI (not used while AI_PROVIDER=openrouter)
const OPENAI_MODELS: string[] = ["gpt-4o-mini", "gpt-4.1-mini"];

// Choose the model priority list based on provider + options
function getModelPriority(purpose?: string): string[] {
  if (AI_PROVIDER === "openrouter") {
    // For now we always use free-tier models.
    const baseFree = [...OPENROUTER_FREE_MODELS];

    // If you later want different priorities by purpose, you can branch here.
    // e.g., if (purpose === "dev_console") reorder them.

    // If AI_FREE_ONLY=true, we *only* use :free models and skip everything else.
    if (AI_FREE_ONLY) {
      return baseFree;
    }

    // If AI_FREE_ONLY=false, you might want to add paid models AFTER free ones:
    return [...baseFree, ...OPENROUTER_PAID_MODELS];
  }

  // Direct OpenAI provider (not active in your current setup).
  return OPENAI_MODELS;
}

// ---------------------------------------------------------------------------
// Context trimming helper (prevent huge manuscripts from blowing limits)
// ---------------------------------------------------------------------------

/**
 * Rough character budget for the model input.
 * 1 token ≈ 3–4 characters; 32k tokens ≈ 100k–130k chars.
 * We stay well below that to be safe.
 */
const MAX_INPUT_CHARS = 60000;

/**
 * Trim messages to stay under MAX_INPUT_CHARS.
 *
 * - Always keeps all system messages.
 * - For manuscript-related purposes, it keeps a single user message
 *   with a truncated excerpt of the manuscript plus a note.
 * - For other purposes, it keeps only the last user/assistant message,
 *   truncated if needed.
 */
function trimMessagesForModel(
  messages: ChatMessage[],
  purpose?: string
): ChatMessage[] {
  const totalChars = messages.reduce(
    (sum, m) => sum + (m.content?.length || 0),
    0
  );

  if (totalChars <= MAX_INPUT_CHARS) {
    return messages;
  }

  console.warn(
    `[AI] Input too long (${totalChars} chars). Trimming down to ~${MAX_INPUT_CHARS} chars for purpose "${
      purpose || "generic"
    }".`
  );

  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");

  // Special handling for manuscript-related purposes
  if (
    purpose &&
    (purpose === "manuscript_context" ||
      purpose === "manuscript_outline" ||
      purpose === "back_cover")
  ) {
    const combined = nonSystem.map((m) => m.content).join("\n\n");

    const excerpt =
      combined.length > MAX_INPUT_CHARS
        ? combined.slice(0, MAX_INPUT_CHARS)
        : combined;

    const userMessage: ChatMessage = {
      role: "user",
      content:
        "NOTE: The manuscript was longer than the model's context limit. " +
        "This is a truncated excerpt. Focus on high-level structure and themes.\n\n" +
        excerpt
    };

    return [...systemMessages, userMessage];
  }

  // Generic case: keep only the most recent non-system message
  const latest = nonSystem[nonSystem.length - 1];
  if (!latest) {
    // Should not happen, but fall back gracefully
    return systemMessages;
  }

  let content = latest.content || "";
  if (content.length > MAX_INPUT_CHARS) {
    content = content.slice(-MAX_INPUT_CHARS);
  }

  const trimmedLatest: ChatMessage = {
    role: latest.role,
    content:
      "NOTE: Conversation history was too long. Only the latest message is included.\n\n" +
      content
  };

  return [...systemMessages, trimmedLatest];
}

// ---------------------------------------------------------------------------
// Core runner – used by existing routes
// ---------------------------------------------------------------------------

export async function runAIUnified(
  messages: ChatMessage[],
  options: RunOptions = {},
  userSuppliedKey?: string | null
): Promise<string> {
  const { purpose, temperature = 0.7, maxTokens = 800 } = options;

  const client = makeClient(userSuppliedKey);
  const modelPriority = getModelPriority(purpose);

  if (!modelPriority.length) {
    throw new Error(
      "[AI] No models configured for the current provider / mode."
    );
  }

  const systemTag = purpose ? `[purpose=${purpose}]` : "[purpose=generic]";

  // Apply context trimming before any model call
  const trimmedMessages = trimMessagesForModel(messages, purpose);

  let lastError: unknown = null;

  for (const model of modelPriority) {
    // Extra guard: if AI_FREE_ONLY is true and this model is not explicitly
    // marked as free, skip it. This protects you even if you accidentally
    // add a paid model without the ":free" suffix.
    if (
      AI_PROVIDER === "openrouter" &&
      AI_FREE_ONLY &&
      !model.endsWith(":free")
    ) {
      console.warn(
        `[AI] Skipping non-free model "${model}" because AI_FREE_ONLY=true.`
      );
      continue;
    }

    try {
      console.log(`[AI] Calling model "${model}" ${systemTag}…`);

      const completion = await client.chat.completions.create({
        model,
        temperature,
        max_tokens: maxTokens,
        messages: trimmedMessages.map((m) => ({
          role: m.role,
          content: m.content
        }))
      });

      // Explicitly treat content as 'any' so we can handle both string and array forms
      const rawContent: any = completion.choices?.[0]?.message?.content as any;

      let text: string = "";
      if (typeof rawContent === "string") {
        text = rawContent.trim();
      } else if (Array.isArray(rawContent)) {
        // Some providers may return content as an array of segments
        text = rawContent
          .map((part: any) =>
            typeof part === "string"
              ? part
              : part?.text?.value ?? part?.text ?? ""
          )
          .join("")
          .trim();
      }

      if (!text) {
        // Treat empty / non-text content as a failure and try the next model.
        const msg = `Model "${model}" returned empty or non-text content.`;
        console.warn(`[AI] ${msg}`);
        throw new Error(msg);
      }

      console.log(`[AI] Model "${model}" succeeded.`);
      return text;
    } catch (err: any) {
      lastError = err;
      const code = err?.code || err?.status;
      const message = err?.error?.message || err?.message || String(err);

      console.warn(
        `[AI] Model "${model}" failed: code=${code ?? "unknown"} msg=${message}`
      );

      // If this is an OpenRouter 402 for credits, log clearly and continue.
      if (AI_PROVIDER === "openrouter" && (code === 402 || code === "402")) {
        console.warn(
          "[AI] OpenRouter credits / free quota issue. " +
            "Staying in free-only mode and trying other free models."
        );
      }

      // For other failures we just fall through and try the next model.
      continue;
    }
  }

  console.error("[AI] All models failed. Last error:", lastError);
  throw new Error(
    "All AI models failed. OpenRouter/Free endpoints down or unreachable."
  );
}

/* ---------------------------------------------------------------------------
   Unified AI Core v1 – High-level job runner
   (you can use this for the new “Unified AI Core” endpoint or 2nd AI panel)
--------------------------------------------------------------------------- */

const DEFAULT_CORE_SYSTEM_PROMPT = `
You are the Unified AI Core of the Infinite Publisher desktop app.
You help with writing, editing, summarization, outlining, manuscript polishing,
research synthesis, and light formatting guidance for authors.
Keep answers concise, practical, and aligned with the user's intent.
`.trim();

export async function runAIJob(
  job: AIJobRequest,
  userSuppliedKey?: string | null
): Promise<AIJobResponse> {
  try {
    const { jobType } = job;
    let purpose: string = "generic";
    let temperature = 0.7;
    let maxTokens = 800;
    let messages: ChatMessage[] = [];

    switch (jobType) {
      case "chat": {
        purpose = "chat";
        messages = [
          { role: "system", content: DEFAULT_CORE_SYSTEM_PROMPT },
          { role: "user", content: job.userMessage }
        ];
        break;
      }

      case "rewrite": {
        purpose = "rewrite";
        temperature = 0.4;
        maxTokens = 600;

        const base =
          job.selectionText || job.manuscriptText || job.userMessage || "";
        const instructions =
          job.instructions?.trim() ||
          "Rewrite this text clearly and concisely while preserving meaning and tone.";

        messages = [
          {
            role: "system",
            content:
              "You rewrite text clearly, concisely, and stylistically aligned with instructions."
          },
          {
            role: "user",
            content: `Instructions:\n${instructions}\n\nText to rewrite:\n${base}`
          }
        ];
        break;
      }

      case "summarize": {
        purpose = "summarize";
        temperature = 0.4;
        maxTokens = 700;

        const base =
          job.selectionText || job.manuscriptText || job.userMessage || "";

        messages = [
          {
            role: "system",
            content:
              "Summarize the text for an author, focusing on key arguments, structure, and emotional tone. Keep it concise."
          },
          { role: "user", content: base }
        ];
        break;
      }

      case "outline": {
        purpose = "manuscript_outline";
        temperature = 0.5;
        maxTokens = 900;

        const base = job.manuscriptText || job.userMessage;

        messages = [
          {
            role: "system",
            content:
              "You help authors create or refine book outlines. Return a structured outline with chapters and bullet points."
          },
          { role: "user", content: base }
        ];
        break;
      }

      case "manuscript_edit": {
        purpose = "manuscript_context";
        temperature = 0.5;
        maxTokens = 900;

        const base =
          job.selectionText || job.manuscriptText || job.userMessage || "";

        messages = [
          {
            role: "system",
            content:
              "Act as a professional line editor. Improve clarity, flow, and readability. Fix grammar and punctuation, but preserve the author's voice. Return ONLY the edited text."
          },
          { role: "user", content: base }
        ];
        break;
      }

      case "format_helper": {
        purpose = "format_helper";
        temperature = 0.4;
        maxTokens = 700;

        const context = [
          `Format preset: ${job.formatPresetId ?? "unknown"}`,
          `Style profile: ${job.styleProfileId ?? "none"}`
        ].join("\n");

        const userContent = `Format context:\n${context}\n\nUser question or notes:\n${job.userMessage}`;

        messages = [
          {
            role: "system",
            content:
              "You are a formatting advisor inside Infinite Publisher. Give concrete, KDP/print/ebook-safe advice based on the context."
          },
          { role: "user", content: userContent }
        ];
        break;
      }

      case "research": {
        purpose = "research";
        temperature = 0.5;
        maxTokens = 900;

        messages = [
          {
            role: "system",
            content:
              "You are a research synthesis assistant. You receive user questions and optional research snippets and return a clear, citation-like answer that an author can use as a starting point."
          },
          { role: "user", content: job.userMessage }
        ];
        break;
      }

      default: {
        throw new Error(`Unknown jobType: ${jobType}`);
      }
    }

    const text = await runAIUnified(
      messages,
      { purpose, temperature, maxTokens },
      userSuppliedKey
    );

    return {
      ok: true,
      jobType,
      text
    };
  } catch (err: any) {
    console.error("[AI Core v1] runAIJob error:", err);
    return {
      ok: false,
      jobType: job.jobType,
      error: err?.message ?? "Unknown AI core error"
    };
  }
}