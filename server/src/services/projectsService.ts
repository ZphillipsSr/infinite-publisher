import fs from "fs";
import { DATA_FILE } from "../config";
import { Project, StyleProfile } from "../types/project";

let projects: Project[] = loadProjectsFromDisk();

function loadProjectsFromDisk(): Project[] {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveProjectsToDisk() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2), "utf-8");
}

export function listProjects(): Project[] {
  return projects;
}

function createId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

export function createProject(
  title: string,
  styleProfile?: StyleProfile
): Project {
  const now = new Date().toISOString();
  const project: Project = {
    id: createId(),
    title: title.trim(),
    manuscript: "",
    createdAt: now,
    updatedAt: now,
    styleProfile: styleProfile || {}
  };

  projects.unshift(project);
  saveProjectsToDisk();
  return project;
}

export function updateProject(
  id: string,
  payload: { manuscript?: string; styleProfile?: StyleProfile }
): Project | null {
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return null;

  const now = new Date().toISOString();

  const updated: Project = {
    ...projects[idx],
    manuscript: payload.manuscript ?? projects[idx].manuscript,
    styleProfile:
      "styleProfile" in payload
        ? payload.styleProfile
        : projects[idx].styleProfile,
    updatedAt: now
  };

  projects[idx] = updated;
  saveProjectsToDisk();
  return updated;
}