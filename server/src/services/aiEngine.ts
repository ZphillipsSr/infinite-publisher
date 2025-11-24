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
        "X-Title": "Infinite Publisher - Local Dev",
      },
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
    apiKey: keyToUse,
  });
}

// ---------------------------------------------------------------------------
// Model selection
// ---------------------------------------------------------------------------

// Free-tier OpenRouter models only.
// These slugs are from OpenRouter's catalog; if any become unavailable
// on a given day, we fall through to the next one.
const OPENROUTER_FREE_MODELS: string[] = [
  "meta-llama/llama-3.1-8b-instruct:free",
  "google/gemini-1.5-flash-8b:free",
  "mistralai/mistral-7b-instruct:free",
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
    `[AI] Input too long (${totalChars} chars). Trimming down to ~${MAX_INPUT_CHARS} chars for purpose "${purpose ||
      "generic"}".`
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
        excerpt,
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
      content,
  };

  return [...systemMessages, trimmedLatest];
}

// ---------------------------------------------------------------------------
// Unified runner
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
          content: m.content,
        })),
      });

      const text =
        completion.choices?.[0]?.message?.content?.toString().trim() || "";

      if (!text) {
        throw new Error("Model returned empty response.");
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