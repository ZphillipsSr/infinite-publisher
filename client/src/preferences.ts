// src/preferences.ts

export type UserPreferences = {
  // Default layout for new / opened projects
  defaultTrimSize: "6x9" | "8.5x11";
  defaultLineSpacing: 1 | 1.15 | 1.5;

  // AI behavior flags
  // If false, we keep the key stored but do NOT send it to the backend.
  usePersonalOpenAIKey: boolean;

  // If false, and there is no usable personal key, the frontend
  // will refuse AI calls instead of falling back to server / OpenRouter.
  allowServerAI: boolean;
};

export const defaultUserPreferences: UserPreferences = {
  defaultTrimSize: "6x9",
  defaultLineSpacing: 1.15,
  usePersonalOpenAIKey: true,
  allowServerAI: true,
};

const PREFS_KEY = "ipublisher-user-preferences";
const USER_OPENAI_KEY = "ipublisher-user-openai-key";

/**
 * Load user preferences from localStorage, falling back to defaults on any error.
 */
export function loadUserPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return defaultUserPreferences;

    const parsed = JSON.parse(raw) as Partial<UserPreferences>;

    return {
      defaultTrimSize:
        parsed.defaultTrimSize === "8.5x11" ? "8.5x11" : "6x9",
      defaultLineSpacing:
        parsed.defaultLineSpacing === 1 ||
        parsed.defaultLineSpacing === 1.5
          ? parsed.defaultLineSpacing
          : 1.15,
      usePersonalOpenAIKey:
        typeof parsed.usePersonalOpenAIKey === "boolean"
          ? parsed.usePersonalOpenAIKey
          : true,
      allowServerAI:
        typeof parsed.allowServerAI === "boolean"
          ? parsed.allowServerAI
          : true,
    };
  } catch (err) {
    console.error("Failed to load user preferences, using defaults:", err);
    return defaultUserPreferences;
  }
}

/**
 * Persist user preferences to localStorage.
 */
export function saveUserPreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.error("Failed to save user preferences:", err);
  }
}

/**
 * Load the stored personal OpenAI API key (if any).
 */
export function loadUserOpenAIKey(): string | null {
  try {
    return localStorage.getItem(USER_OPENAI_KEY);
  } catch (err) {
    console.error("Failed to load user OpenAI key:", err);
    return null;
  }
}

/**
 * Save or clear the personal OpenAI API key.
 * Pass null to clear.
 */
export function saveUserOpenAIKey(value: string | null): void {
  try {
    if (value && value.trim()) {
      localStorage.setItem(USER_OPENAI_KEY, value.trim());
    } else {
      localStorage.removeItem(USER_OPENAI_KEY);
    }
  } catch (err) {
    console.error("Failed to save user OpenAI key:", err);
  }
}