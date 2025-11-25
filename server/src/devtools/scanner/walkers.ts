import fs from "fs";
import path from "path";

export type FileInfo = {
  filePath: string;
  stats: fs.Stats;
};

const IGNORE_DIRS = ["node_modules", ".git", "dist", "build", "out"];

export function walkDirectory(rootDir: string): FileInfo[] {
  const results: FileInfo[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const full = path.join(dir, entry.name);

      // skip ignored directories
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.includes(entry.name)) walk(full);
        continue;
      }

      const stats = fs.statSync(full);
      results.push({ filePath: full, stats });
    }
  }

  walk(rootDir);
  return results;
}
