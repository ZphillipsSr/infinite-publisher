/**
 * aiService.ts — Wrapper around the unified AI engine.
 *
 * THIS FILE NOW ONLY:
 * - Provides a backward-compatible "runAI" function
 * - Forwards all calls to runAIUnified()
 * - Handles user-provided OpenAI keys
 *
 * The old OpenAI/OpenRouter logic is gone.
 */

import { runAIUnified, ChatMessage, AIOptions } from "./aiEngine";

/**
 * runAI (legacy compatibility)
 * - All other services in the app already call `runAI(...)`
 * - We keep the function name so nothing else breaks
 * - Internally this simply forwards to the unified engine
 */
export async function runAI(
  messages: ChatMessage[],
  opts?: AIOptions,
  userOpenAIKey?: string
): Promise<string> {
  return await runAIUnified(messages, opts, userOpenAIKey);
}