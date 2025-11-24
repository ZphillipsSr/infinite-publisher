import express from "express";
import cors from "cors";
import { PORT } from "./config";
import { registerProjectRoutes } from "./routes/projectsRoutes";
import { registerManuscriptRoutes } from "./routes/manuscriptsRoutes";
import aiRoutes from "./routes/aiRoutes";
import { registerResearchRoutes } from "./routes/researchRoutes";
import { registerDebugRoutes } from "./routes/debugRoutes";
import { registerHealthRoutes } from "./routes/healthRoutes";

const app = express();

// ---------- Middleware ----------
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ---------- Route registration (modular) ----------
registerHealthRoutes(app);
registerDebugRoutes(app);
registerProjectRoutes(app);
registerManuscriptRoutes(app);
app.use("/api/ai", aiRoutes);
registerResearchRoutes(app);

// ---------- Start server (guarded for ts-node-dev) ----------
// ts-node-dev sometimes re-requires this file in the same process.
// We guard app.listen so it only runs once per process to avoid EADDRINUSE.

const globalAny = global as any;

if (!globalAny.__IP_SERVER_STARTED__) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
  globalAny.__IP_SERVER_STARTED__ = true;
}

export default app;