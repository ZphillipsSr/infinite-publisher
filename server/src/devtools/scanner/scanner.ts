import { walkDirectory } from "./walkers";
import { readAndChunk, CodeChunk } from "./reader";
import path from "path";
import fs from "fs";

// Directories to ignore completely
const IGNORE_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  ".git",
  ".github",
  ".next",
  ".vite",
  ".turbo",
  ".cache",
  ".vscode",
  ".idea",
  "coverage",
  "public",
  "logs",
  "tmp",
  "temp",
]);

// Only index files with these extensions
const ALLOWED_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".mdx",
  ".yml",
  ".yaml",
  ".toml",
  ".env",
  ".txt",
]);

function shouldIndexFile(filePath: string): boolean {
  const rel = filePath.replace(/\\/g, "/");

  // Skip ANY file inside an ignored directory
  const parts = rel.split("/");
  if (parts.some((p) => IGNORE_DIRS.has(p))) return false;

  // Check extension
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return false;

  // Optionally skip huge JSON files
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > 2 * 1024 * 1024) return false; // >2MB skip
  } catch {}

  return true;
}

export async function scanProject(root: string): Promise<CodeChunk[]> {
  console.log("🔍 Scanning project:", root);

  const allFiles = walkDirectory(root);

  const allChunks: CodeChunk[] = [];

  for (const file of allFiles) {
    if (!shouldIndexFile(file.filePath)) continue;

    const chunks = readAndChunk(file.filePath);
    allChunks.push(...chunks);
  }

  console.log(`📦 Total chunks: ${allChunks.length}`);
  return allChunks;
}