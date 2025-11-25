// HYBRID EMBEDDING SYSTEM:
// Supports Ollama, Local (Xenova), and Auto fallback

import fetch from "node-fetch";

// Load local embedding model lazily
let localEmbedderPromise: Promise<any> | null = null;
async function getLocalEmbedder() {
  if (!localEmbedderPromise) {
    localEmbedderPromise = (async () => {
      const { pipeline } = await import("@xenova/transformers");
      const modelId =
        process.env.LOCAL_EMBED_MODEL || "Xenova/all-MiniLM-L6-v2";

      console.log(`[KB] Loading local (Xenova) model: ${modelId}`);
      return await pipeline("feature-extraction", modelId);
    })();
  }
  return localEmbedderPromise;
}

// ---- Ollama embedding ----
async function embedWithOllama(text: string): Promise<number[]> {
  const base = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";

  const res = await fetch(`${base}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: text }),
  });

  if (!res.ok) {
    throw new Error(`Ollama error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (!json.embedding) throw new Error("Ollama returned no embedding");

  return json.embedding;
}

// ---- Local Xenova embedding ----
async function embedWithLocal(text: string): Promise<number[]> {
  const pipe = await getLocalEmbedder();
  const output = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

// ---- Hybrid provider ----
export async function embedText(text: string): Promise<number[]> {
  const provider = process.env.EMBED_PROVIDER || "auto";

  if (provider === "ollama") {
    return embedWithOllama(text);
  }
  if (provider === "local") {
    return embedWithLocal(text);
  }

  // AUTO MODE (best)
  try {
    return await embedWithOllama(text);
  } catch (err) {
    console.warn("[KB] Ollama failed, falling back to local:", err);
    return embedWithLocal(text);
  }
}

// Batch version
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const result: number[][] = [];
  for (const t of texts) {
    result.push(await embedText(t));
  }
  return result;
}