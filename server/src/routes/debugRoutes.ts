// src/routes/debugRoutes.ts
import { Express, Request, Response } from "express";
import { ENV_DEBUG_INFO, OPENROUTER_KEY, OPENROUTER_MODEL_ID, TAVILY_API_KEY, SERPER_API_KEY } from "../config";

export function registerDebugRoutes(app: Express) {
  app.get("/api/debug/env", (req: Request, res: Response) => {
    const aiEnabled = !!OPENROUTER_KEY && !!OPENROUTER_MODEL_ID;
    const tavilyEnabled = !!TAVILY_API_KEY;
    const serperEnabled = !!SERPER_API_KEY;

    res.json({
      aiEnabled,
      openRouter: {
        keySet: !!OPENROUTER_KEY,
        keyPreview: ENV_DEBUG_INFO.openRouter.keyPreview,
        modelId: ENV_DEBUG_INFO.openRouter.modelId
      },
      search: {
        tavilyEnabled,
        serperEnabled
      },
      nodeEnv: ENV_DEBUG_INFO.nodeEnv,
      cwd: ENV_DEBUG_INFO.cwd,
      envFile: ENV_DEBUG_INFO.envFile
    });
  });
}