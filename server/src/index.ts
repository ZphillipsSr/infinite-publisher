import express from "express";
import cors from "cors";
import { PORT } from "./config";
import { registerProjectRoutes } from "./routes/projectsRoutes";
import { registerManuscriptRoutes } from "./routes/manuscriptsRoutes";
import aiRoutes from "./routes/aiRoutes";
import { registerResearchRoutes } from "./routes/researchRoutes";
import devRoutes from "./routes/devRoutes";
import { registerDebugRoutes } from "./routes/debugRoutes";
import { registerHealthRoutes } from "./routes/healthRoutes";
import kbRoutes from "./routes/kbRoutes";

const app = express();

// ---------- Middleware ----------
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ---------- Route registration ----------
registerHealthRoutes(app);
registerDebugRoutes(app);
registerProjectRoutes(app);
registerManuscriptRoutes(app);
app.use("/api/ai", aiRoutes);
registerResearchRoutes(app);
app.use("/api/dev", devRoutes);
app.use("/api/devtools/kb", kbRoutes);

// ---------- Start server (guarded for ts-node-dev) ----------
const globalAny = global as any;

if (!globalAny.__IP_SERVER_STARTED__) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
  globalAny.__IP_SERVER_STARTED__ = true;
}

export default app;