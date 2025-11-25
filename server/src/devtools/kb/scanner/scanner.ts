import { walkDirectory } from "./walkers";
import { readAndChunk, CodeChunk } from "./reader";

export async function scanProject(root: string): Promise<CodeChunk[]> {
  console.log("🔍 Scanning project:", root);

  const allFiles = walkDirectory(root);
  const allChunks: CodeChunk[] = [];

  for (const file of allFiles) {
    const chunks = readAndChunk(file.filePath);
    allChunks.push(...chunks);
  }

  console.log(`📦 Total chunks: ${allChunks.length}`);
  return allChunks;
}