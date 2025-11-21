// src/routes/healthRoutes.ts
import { Express, Request, Response } from "express";

export function registerHealthRoutes(app: Express) {
  app.get("/", (req: Request, res: Response) => {
    res.send("Infinite Publisher server is running.");
  });
}