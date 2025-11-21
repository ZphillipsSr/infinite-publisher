import dotenv from "dotenv";
import path from "path";

dotenv.config();

export const PORT = Number(process.env.PORT || 4000);
export const NODE_ENV = process.env.NODE_ENV || "development";

export const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";
export const OPENROUTER_MODEL_ID = process.env.OPENROUTER_MODEL_ID || "";

export const OPENROUTER_FALLBACK_MODEL_ID =
  process.env.OPENROUTER_FALLBACK_MODEL_ID || "";

export const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";
export const SERPER_API_KEY = process.env.SERPER_API_KEY || "";

export const DATA_FILE = path.join(process.cwd(), "projects-data.json");

export const ENV_DEBUG_INFO = {
  nodeEnv: NODE_ENV,
  cwd: process.cwd(),
  envFile: path.join(process.cwd(), ".env"),
  openRouter: {
    keySet: !!OPENROUTER_KEY,
    modelId: OPENROUTER_MODEL_ID || null,
    keyPreview: OPENROUTER_KEY
      ? OPENROUTER_KEY.slice(0, 6) + "...(hidden)"
      : null
  },
  search: {
    tavilyEnabled: !!TAVILY_API_KEY,
    serperEnabled: !!SERPER_API_KEY
  }
};