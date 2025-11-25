import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { ChunkWithEmbedding, KbData, KbRecord, KbSearchResult } from "./types";

const DEV_DATA_DIR = path.join(process.cwd(), "dev-data");
const KB_FILE = path.join(DEV_DATA_DIR, "project-kb.json");

function ensureDir() {
  if (!fs.existsSync(DEV_DATA_DIR)) {
    fs.mkdirSync(DEV_DATA_DIR, { recursive: true });
  }
}

export function loadKb(): KbData | null {
  ensureDir();
  if (!fs.existsSync(KB_FILE)) return null;

  const raw = fs.readFileSync(KB_FILE, "utf8");
  const data = JSON.parse(raw) as KbData;
  return data;
}

export function saveKb(data: KbData): void {
  ensureDir();
  const updated: KbData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(KB_FILE, JSON.stringify(updated, null, 2), "utf8");
}

export function createKbFromChunks(items: ChunkWithEmbedding[]): KbData {
  const now = new Date().toISOString();

  const records: KbRecord[] = items.map((item) => ({
    id: randomUUID(),
    filePath: item.chunk.filePath,
    startLine: item.chunk.startLine,
    endLine: item.chunk.endLine,
    content: item.chunk.content,
    language: item.chunk.language,
    embedding: item.embedding,
  }));

  const kb: KbData = {
    version: 1,
    createdAt: now,
    updatedAt: now,
    records,
  };

  return kb;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || !b.length) {
    return 0;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const va = a[i];
    const vb = b[i];
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }

  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function searchKb(
  kb: KbData,
  queryEmbedding: number[],
  topK = 8
): KbSearchResult[] {
  const scores: KbSearchResult[] = kb.records.map((rec) => ({
    record: rec,
    score: cosineSimilarity(queryEmbedding, rec.embedding),
  }));

  return scores.sort((a, b) => b.score - a.score).slice(0, topK);
}