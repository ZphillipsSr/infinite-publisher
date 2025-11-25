import path from "path";
import { scanProject } from "../scanner/scanner";
import { createKbFromChunks, saveKb, loadKb, searchKb } from "./store";
import type { KbData, KbSearchResult } from "./types";
import { embedText } from "./embeddings";
import { hashFile } from "./hash";
import { loadCache, saveCache, CacheMap } from "./cache-store";

// Extract text safely from various chunk shapes
function getChunkText(chunk: any): string {
  return chunk.text ?? chunk.content ?? chunk.code ?? "";
}

// Resolve project root
function resolveProjectRoot(): string {
  return path.join(process.cwd(), "..");
}

// Build KB with per-file caching
export async function buildProjectKb(projectRoot?: string): Promise<KbData> {
  const root = projectRoot || resolveProjectRoot();
  console.log("🧠 Building KB from root:", root);

  const chunks = await scanProject(root);
  console.log(`📦 Total chunks: ${chunks.length}`);
  console.log(`📄 Chunks to embed: ${chunks.length}`);

  // Group chunks by filePath
  const byFile: Record<string, any[]> = {};
  for (const chunk of chunks as any[]) {
    if (!chunk.filePath) continue;
    if (!byFile[chunk.filePath]) byFile[chunk.filePath] = [];
    byFile[chunk.filePath].push(chunk);
  }

  const cache: CacheMap = loadCache();
  const newCache: CacheMap = {};
  const embedded: any[] = [];

  const filePaths = Object.keys(byFile);
  console.log(`📁 Unique files to process: ${filePaths.length}`);

  for (const filePath of filePaths) {
    const fileChunks = byFile[filePath];
    const fileHash = hashFile(filePath);

    const cached = cache[filePath];
    const canReuseCache =
      cached &&
      cached.hash === fileHash &&
      cached.embeddings &&
      cached.embeddings.length === fileChunks.length;

    let embeddings: number[][] = [];

    if (canReuseCache) {
      embeddings = cached.embeddings;
      console.log(
        `⏭️ Cached file: ${filePath} (${fileChunks.length} chunks reused)`
      );
    } else {
      console.log(
        `🔄 Embedding file: ${filePath} (${fileChunks.length} chunks)`
      );
      embeddings = [];
      for (const chunk of fileChunks) {
        const text = getChunkText(chunk);
        if (!text || !text.trim()) {
          embeddings.push([]);
          continue;
        }
        const vector = await embedText(text);
        embeddings.push(vector);
      }
    }

    // Save into new cache
    newCache[filePath] = {
      hash: fileHash,
      embeddings,
    };

    // Attach embeddings to chunks in order
    fileChunks.forEach((chunk, idx) => {
      const vector = embeddings[idx];
      if (!vector || !vector.length) return;
      embedded.push({
        ...chunk,
        embedding: vector,
      });
    });
  }

  // Save updated cache
  saveCache(newCache);

  const kb = createKbFromChunks(embedded);
  saveKb(kb);

  console.log(`✅ KB built with ${kb.records.length} records.`);
  return kb;
}

// Load KB or build if missing
export async function getOrBuildKb(): Promise<KbData> {
  let kb = loadKb();
  if (!kb) kb = await buildProjectKb();
  return kb;
}

// Query KB
export async function searchProjectKb(
  query: string,
  topK = 8
): Promise<KbSearchResult[]> {
  const kb = await getOrBuildKb();
  const queryEmbedding = await embedText(query);
  return searchKb(kb, queryEmbedding, topK);
}