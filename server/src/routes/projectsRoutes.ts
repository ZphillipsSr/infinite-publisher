// src/routes/projectsRoutes.ts
import { Express, Request, Response } from "express";
import { listProjects, createProject, updateProject } from "../services/projectsService";
import { StyleProfile } from "../types/project";

export function registerProjectRoutes(app: Express) {
  app.get("/api/projects", (req: Request, res: Response) => {
    res.json(listProjects());
  });

  app.post("/api/projects", (req: Request, res: Response) => {
    const { title, styleProfile } = req.body as {
      title?: string;
      styleProfile?: StyleProfile;
    };

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    const project = createProject(title, styleProfile);
    res.json(project);
  });

  app.put("/api/projects/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    const { manuscript, styleProfile } = req.body as {
      manuscript?: string;
      styleProfile?: StyleProfile;
    };

    const updated = updateProject(id, { manuscript, styleProfile });
    if (!updated) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json(updated);
  });
}