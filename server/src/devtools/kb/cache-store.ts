import fs from "fs";
import path from "path";

const CACHE_PATH = path.join(process.cwd(), "dev-data", "kb-cache.json");

export type FileCacheEntry = {
  hash: string;          // SHA256 of the file contents
  embeddings: number[][]; // one embedding per chunk, in order
};

export type CacheMap = {
  [filePath: string]: FileCacheEntry;
};

export function loadCache(): CacheMap {
  if (!fs.existsSync(CACHE_PATH)) return {};
  try {
    const raw = fs.readFileSync(CACHE_PATH, "utf8");
    return JSON.parse(raw) as CacheMap;
  } catch {
    return {};
  }
}

export function saveCache(cache: CacheMap) {
  const dir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
}