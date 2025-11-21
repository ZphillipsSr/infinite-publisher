import OpenAI from "openai";
import { OPENROUTER_KEY } from "../config";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const openrouter = new OpenAI({
  apiKey: OPENROUTER_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:5173",
    "X-Title": "Infinite Publisher"
  }
});

type ModelConfig = {
  id: string;
  label: string; // "primary" | "fallback1" | "fallback2"
  index: number; // position in configured order
};

type ModelRuntimeState = {
  id: string;
  label: string;
  displayName: string;
  lastUsedAt?: string;
  lastResult?: "success" | "rate_limited" | "policy_blocked" | "other_error";
  successCount: number;
  errorCount: number;
};

const modelRuntime: Record<string, ModelRuntimeState> = {};
let modelPointer = 0; // rotating starting index for next call

function getDisplayName(id: string): string {
  if (id.includes("deepseek")) return "DeepSeek";
  if (id.includes("moonshotai/kimi-k2")) return "Kimi K2 Free";
  if (id.includes("llama-3.1")) return "Llama 3.1";
  return id;
}

/**
 * Build model configs from env in a stable order.
 *
 * 1) OPENROUTER_MODEL_ID
 * 2) OPENROUTER_FALLBACK_MODEL_ID
 * 3) OPENROUTER_FALLBACK_MODEL_2_ID
 */
function getConfiguredModels(): ModelConfig[] {
  const primary = process.env.OPENROUTER_MODEL_ID || "";
  const fallback1 = process.env.OPENROUTER_FALLBACK_MODEL_ID || "";
  const fallback2 = process.env.OPENROUTER_FALLBACK_MODEL_2_ID || "";

  const models: ModelConfig[] = [];
  let index = 0;

  if (primary) {
    models.push({ id: primary, label: "primary", index: index++ });
  }
  if (fallback1) {
    models.push({ id: fallback1, label: "fallback1", index: index++ });
  }
  if (fallback2) {
    models.push({ id: fallback2, label: "fallback2", index: index++ });
  }

  return models;
}

function ensureModelState(cfg: ModelConfig): ModelRuntimeState {
  if (!modelRuntime[cfg.id]) {
    modelRuntime[cfg.id] = {
      id: cfg.id,
      label: cfg.label,
      displayName: getDisplayName(cfg.id),
      successCount: 0,
      errorCount: 0
    };
  }
  return modelRuntime[cfg.id];
}

/**
 * Exposed for the dashboard: current runtime stats + configured order.
 */
export function getModelRuntimeStatus() {
  const configs = getConfiguredModels();
  const configuredOrder = configs.map((c) => ({
    id: c.id,
    label: c.label,
    displayName: getDisplayName(c.id)
  }));

  return {
    models: Object.values(modelRuntime),
    pointerIndex: modelPointer,
    configuredOrder
  };
}

/**
 * callOpenRouterChat — AI call with automatic rotating fallback.
 *
 * Rotation:
 *   - We keep models in a ring.
 *   - Each successful call advances the pointer to the next model.
 *   - On errors (429 / 404 policy), we try the next model in the ring.
 */
export async function callOpenRouterChat(
  messages: ChatMessage[],
  temperature = 0.7
): Promise<string> {
  if (!OPENROUTER_KEY) {
    throw new Error("Missing OPENROUTER_API_KEY environment variable.");
  }

  const baseModels = getConfiguredModels();
  if (baseModels.length === 0) {
    throw new Error(
      "No OpenRouter models configured. Set OPENROUTER_MODEL_ID (and optional fallbacks)."
    );
  }

  // Build rotated order: start at modelPointer and wrap around.
  const orderedConfigs: ModelConfig[] = baseModels.map((_, offset) => {
    const idx = (modelPointer + offset) % baseModels.length;
    return baseModels[idx];
  });

  let lastError: any = null;

  for (let i = 0; i < orderedConfigs.length; i++) {
    const cfg = orderedConfigs[i];
    const state = ensureModelState(cfg);

    try {
      const completion = await openrouter.chat.completions.create({
        model: cfg.id,
        messages,
        temperature
      });

      const now = new Date().toISOString();
      state.lastUsedAt = now;
      state.lastResult = "success";
      state.successCount++;

      // Advance pointer so next call starts from the model after this one.
      modelPointer = (cfg.index + 1) % baseModels.length;

      if (i > 0) {
        console.warn(
          `[AI] Fallback model used: ${cfg.id} (${cfg.label}) — a higher-priority/earlier model was unavailable or rate-limited.`
        );
      }

      const reply =
        completion.choices?.[0]?.message?.content?.trim() ||
        "I couldn't generate a response.";

      return reply;
    } catch (err: any) {
      lastError = err;

      const status = err?.status ?? err?.code;
      const providerCode = err?.error?.code;

      const isRateLimit = status === 429 || providerCode === 429;
      const isNotFoundPolicy = status === 404 || providerCode === 404;
      const retryable = isRateLimit || isNotFoundPolicy;

      const now = new Date().toISOString();
      state.lastUsedAt = now;
      state.errorCount++;
      state.lastResult = isRateLimit
        ? "rate_limited"
        : isNotFoundPolicy
        ? "policy_blocked"
        : "other_error";

      if (!retryable || i === orderedConfigs.length - 1) {
        console.error(
          `[AI] OpenRouter error on model ${cfg.id} (${cfg.label}), no more fallbacks:`,
          err
        );
        throw err;
      }

      console.warn(
        `[AI] Model ${cfg.id} (${cfg.label}) failed with ${
          isRateLimit ? "429 rate limit" : "404 data policy"
        }. Trying next fallback model...`
      );
    }
  }

  // Should not normally reach here.
  throw lastError || new Error("All OpenRouter models failed.");
}