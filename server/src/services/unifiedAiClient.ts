import type { Request } from "express";
import OpenAI from "openai";

/**
 * Purposes we might call the AI engine for.
 * This lets us pick different default models per use-case later if we want.
 */
export type AiPurpose =
  | "rewrite"
  | "manuscript_context"
  | "dev_console"
  | "analysis"
  | "research"
  | string;

export interface UnifiedAiOptions {
  model?: string;
  purpose?: AiPurpose;
}

/**
 * Gets the effective API key for this request:
 *  1) Prefer the user's personal key from X-User-OpenAI-Key header
 *  2) Otherwise fall back to the server's OPENAI_API_KEY
 *  3) Otherwise return null (caller should handle this)
 */
export function getEffectiveApiKey(req: Request): string | null {
  const headerKey = (req.header("X-User-OpenAI-Key") || "").trim();
  if (headerKey) {
    return headerKey;
  }

  const envKey = (process.env.OPENAI_API_KEY || "").trim();
  if (envKey) {
    return envKey;
  }

  return null;
}

/**
 * Creates an OpenAI client using the effective key for this request.
 * Throws a clear error if no key is available.
 */
export function getOpenAiClient(req: Request): OpenAI {
  const apiKey = getEffectiveApiKey(req);
  if (!apiKey) {
    throw new Error(
      "No OpenAI API key available (none in X-User-OpenAI-Key header and no OPENAI_API_KEY in server env)."
    );
  }

  return new OpenAI({ apiKey });
}

/**
 * Centralized default model selection.
 * You can override via options.model or environment variables.
 */
export function getDefaultModel(opts?: UnifiedAiOptions): string {
  if (opts?.model) {
    return opts.model;
  }

  switch (opts?.purpose) {
    case "rewrite":
      return process.env.OPENAI_REWRITE_MODEL || process.env.OPENAI_DEFAULT_MODEL || "gpt-4.1-mini";
    case "manuscript_context":
      return process.env.OPENAI_CONTEXT_MODEL || process.env.OPENAI_DEFAULT_MODEL || "gpt-4.1-mini";
    case "dev_console":
      return process.env.OPENAI_DEV_MODEL || process.env.OPENAI_DEFAULT_MODEL || "gpt-4.1-mini";
    case "analysis":
      return process.env.OPENAI_ANALYSIS_MODEL || process.env.OPENAI_DEFAULT_MODEL || "gpt-4.1-mini";
    case "research":
      return process.env.OPENAI_RESEARCH_MODEL || process.env.OPENAI_DEFAULT_MODEL || "gpt-4.1-mini";
    default:
      return process.env.OPENAI_DEFAULT_MODEL || "gpt-4.1-mini";
  }
}

/**
 * Convenience helper so routes can quickly see *how* the AI is being powered.
 * Helpful for debug endpoints and ModelStatusPanel.
 */
export function describeAiSource(req: Request): {
  source: "user_key" | "server_key" | "none";
  hasUserKey: boolean;
  hasServerKey: boolean;
} {
  const headerKey = (req.header("X-User-OpenAI-Key") || "").trim();
  const envKey = (process.env.OPENAI_API_KEY || "").trim();

  const hasUserKey = !!headerKey;
  const hasServerKey = !!envKey;

  let source: "user_key" | "server_key" | "none" = "none";
  if (hasUserKey) source = "user_key";
  else if (hasServerKey) source = "server_key";

  return { source, hasUserKey, hasServerKey };
}