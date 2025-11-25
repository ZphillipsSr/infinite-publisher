import fs from "fs";
import { isTextFile } from "./filters";

export type CodeChunk = {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  language: string;
};

export function readAndChunk(filePath: string): CodeChunk[] {
  if (!isTextFile(filePath)) return [];

  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split("\n");

  const chunks: CodeChunk[] = [];
  const MAX_LINES = 80;

  let start = 0;
  while (start < lines.length) {
    const end = Math.min(start + MAX_LINES, lines.length);

    chunks.push({
      filePath,
      startLine: start + 1,
      endLine: end,
      content: lines.slice(start, end).join("\n"),
      language: detectLanguage(filePath),
    });

    start = end;
  }

  return chunks;
}

function detectLanguage(file: string): string {
  if (file.endsWith(".ts") || file.endsWith(".tsx")) return "typescript";
  if (file.endsWith(".js") || file.endsWith(".jsx")) return "javascript";
  if (file.endsWith(".json")) return "json";
  if (file.endsWith(".md")) return "markdown";
  return "text";
}