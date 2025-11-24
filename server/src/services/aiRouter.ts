// src/services/aiRouter.ts

import type { Request } from "express";

export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface AIProvider {
  id: string;
  name: string;
  callChat(messages: AIMessage[], req?: Request): Promise<string>;
}

/**
 * Example provider: OpenAI-compatible endpoint using environment variable
 * OPENAI_API_KEY and OPENAI_BASE_URL (or similar).
 *
 * Adjust this to match how your existing OpenAI client is set up.
 */
async function callPrimaryProvider(messages: AIMessage[]): Promise<string> {
  // TODO: replace this with your actual OpenAI call.
  // For now, this is just a placeholder to show structure.
  throw new Error("Primary provider not configured.");
}

/**
 * Optional: secondary provider (another key / another vendor)
 * For now, we just stub it so we have the shape.
 */
async function callSecondaryProvider(messages: AIMessage[]): Promise<string> {
  // TODO: wire additional provider or alternate key here.
  throw new Error("Secondary provider not configured.");
}

export const providers: AIProvider[] = [
  {
    id: "primary",
    name: "Primary AI Provider",
    async callChat(messages: AIMessage[]) {
      return callPrimaryProvider(messages);
    }
  },
  {
    id: "secondary",
    name: "Secondary AI Provider",
    async callChat(messages: AIMessage[]) {
      return callSecondaryProvider(messages);
    }
  }
];

/**
 * Fallback loop:
 * - Try providers in order
 * - If one throws or returns empty string, move to the next
 * - Stop at the first successful reply
 */
export async function chatWithFallback(
  messages: AIMessage[],
  options?: {
    maxAttempts?: number;
  }
): Promise<{ reply: string; providerId: string }> {
  const maxAttempts =
    options?.maxAttempts ?? Math.min(providers.length, providers.length);

  const errors: string[] = [];

  for (let i = 0; i < maxAttempts && i < providers.length; i++) {
    const provider = providers[i];
    try {
      const reply = await provider.callChat(messages);

      if (reply && reply.trim().length > 0) {
        return {
          reply,
          providerId: provider.id
        };
      } else {
        errors.push(`${provider.id}: empty reply`);
      }
    } catch (err: any) {
      errors.push(
        `${provider.id}: ${err?.message || "Unknown error from provider"}`
      );
    }
  }

  throw new Error(
    `All AI providers failed. Details: ${errors.join(" | ")}`
  );
}