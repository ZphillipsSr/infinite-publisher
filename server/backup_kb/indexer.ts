import path from "path";
import { scanProject } from "../scanner/scanner";
import { createKbFromChunks, saveKb, loadKb, searchKb } from "./store";
import type { KbData, KbSearchResult } from "./types";
import fetch from "node-fetch";

const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_EMBED_MODEL =
  process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";

/**
 * Call Ollama's /api/embeddings endpoint for a single text.
 */
async function embedWithOllama(text: string): Promise<number[]> {
  // Tiny delay so thousands of chunks don't hammer Ollama and cause ECONNRESET
  await new Promise((r) => setTimeout(r, 20));

  const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_EMBED_MODEL,
      // IMPORTANT: Ollama expects "prompt", not "input"
      prompt: text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Ollama embeddings failed: ${res.status} ${res.statusText} – ${body}`,
    );
  }

  const data = (await res.json()) as { embedding?: number[] };

  if (!data.embedding || !Array.isArray(data.embedding) || data.embedding.length === 0) {
    throw new Error(
      `Ollama returned empty embedding payload: ${JSON.stringify(data)}`,
    );
  }

  return data.embedding;
}

/**
 * Try to consistently get "text" from whatever shape CodeChunk has.
 */
function getChunkText(chunk: any): string {
  return (
    chunk.text ??
    chunk.content ??
    chunk.code ??
    ""
  );
}

/**
 * Resolve project root:
 * Server runs from <repo>/server, so repo root = parent folder.
 */
function resolveProjectRoot(): string {
  const serverDir = process.cwd();
  const repoRoot = path.join(serverDir, "..");
  return repoRoot;
}

/**
 * Scan the repo, create embeddings via Ollama, and write dev-data/project-kb.json
 */
export async function buildProjectKb(projectRoot?: string): Promise<KbData> {
  const root = projectRoot || resolveProjectRoot();

  console.log("🧠 Building KB from root:", root);

  const chunks = await scanProject(root);
  console.log(`📦 Total chunks: ${chunks.length}`);
  console.log(`📄 Chunks to embed: ${chunks.length}`);

  const embedded: any[] = [];

  for (const chunk of chunks as any[]) {
    const text = getChunkText(chunk);
    if (!text || !text.trim()) {
      continue; // skip empty chunks
    }

    const embedding = await embedWithOllama(text);
    embedded.push({
      ...chunk,
      embedding,
    });
  }

  const kb = createKbFromChunks(embedded);
  saveKb(kb);
  console.log(`✅ KB built with ${kb.records.length} records.`);
  return kb;
}

/**
 * Ensure KB exists; build if missing, then return it.
 */
export async function getOrBuildKb(): Promise<KbData> {
  let kb = loadKb();
  if (!kb) {
    kb = await buildProjectKb();
  }
  return kb;
}

/**
 * Run a semantic search over the KB with a natural-language query.
 */
export async function searchProjectKb(
  query: string,
  topK = 8,
): Promise<KbSearchResult[]> {
  const kb = await getOrBuildKb();

  const queryEmbedding = await embedWithOllama(query);
  return searchKb(kb, queryEmbedding, topK);
}