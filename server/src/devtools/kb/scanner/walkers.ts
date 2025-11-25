import fs from "fs";
import path from "path";

const IGNORE_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  "dev-data",
]);

export type WalkedFile = {
  filePath: string;
  size: number;
};

export function walkDirectory(root: string): WalkedFile[] {
  const results: WalkedFile[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        walk(fullPath);
      } else if (entry.isFile()) {
        const stats = fs.statSync(fullPath);
        results.push({
          filePath: fullPath,
          size: stats.size,
        });
      }
    }
  }

  walk(root);
  return results;
}