import type { CodeChunk } from "../scanner/reader";

export type KbRecord = {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  language: string;
  embedding: number[];
};

export type KbData = {
  version: 1;
  createdAt: string;
  updatedAt: string;
  records: KbRecord[];
};

export type KbSearchResult = {
  record: KbRecord;
  score: number;
};

export type ChunkWithEmbedding = {
  chunk: CodeChunk;
  embedding: number[];
};