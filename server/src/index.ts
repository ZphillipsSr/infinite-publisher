import express from "express";
import cors from "cors";
import { PORT } from "./config";
import { registerProjectRoutes } from "./routes/projectsRoutes";
import { registerManuscriptRoutes } from "./routes/manuscriptsRoutes";
import { registerAIRoutes } from "./routes/aiRoutes";
import { registerResearchRoutes } from "./routes/researchRoutes";
import { registerDebugRoutes } from "./routes/debugRoutes";
import { registerHealthRoutes } from "./routes/healthRoutes";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

registerHealthRoutes(app);
registerDebugRoutes(app);
registerProjectRoutes(app);
registerManuscriptRoutes(app);
registerAIRoutes(app);
registerResearchRoutes(app);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});