import OpenAI from "openai";
import fetch from "node-fetch";
import type { CodeChunk } from "./scanner/reader";

type Provider = "ollama" | "openai";

const PROVIDER = (process.env.EMBED_PROVIDER || "ollama").toLowerCase() as Provider;

// ---------- OLLAMA CONFIG ----------
const OLLAMA_URL =
  process.env.OLLAMA_URL || "http://localhost:11434/api/embeddings";
const OLLAMA_MODEL =
  process.env.OLLAMA_EMBED_MODEL || "mxbai-embed-large";

// ---------- OPENAI CONFIG ----------
const OPENAI_MODEL =
  process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";

function createOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  return new OpenAI({
    apiKey,
    baseURL,
  });
}

// ---------- OLLAMA IMPLEMENTATION ----------

async function ollamaEmbed(text: string): Promise<number[]> {
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: text,
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama error: ${res.status} ${res.statusText}`);
  }

  const json: any = await res.json();

  const embedding =
    json.embedding ||
    (Array.isArray(json.embeddings) && json.embeddings[0]?.embedding);

  if (!embedding || !embedding.length) {
    console.error("Ollama returned empty embedding payload:", json);
    return [];
  }

  return embedding as number[];
}

async function embedTextsWithOllama(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (const t of texts) {
    out.push(await ollamaEmbed(t));
  }
  return out;
}

// ---------- OPENAI IMPLEMENTATION ----------

async function embedTextsWithOpenAI(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const client = createOpenAIClient();

  const response = await client.embeddings.create({
    model: OPENAI_MODEL,
    input: texts,
  });

  return response.data.map((d) => d.embedding as number[]);
}

// ---------- PUBLIC API (used by KB) ----------

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  if (PROVIDER === "openai") {
    return embedTextsWithOpenAI(texts);
  }
  return embedTextsWithOllama(texts);
}

export async function embedChunks(
  chunks: CodeChunk[]
): Promise<{ chunk: CodeChunk; embedding: number[] }[]> {
  if (!chunks.length) return [];

  const vectors = await embedTexts(chunks.map((c) => c.content));
  return chunks.map((chunk, i) => ({
    chunk,
    embedding: vectors[i],
  }));
}