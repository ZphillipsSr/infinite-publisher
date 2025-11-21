export type StyleProfile = {
  tone?: string;
  audience?: string;
  genre?: string;
  pov?: string;
  tense?: string;
  pacing?: string;
  formality?: string;
  notes?: string;
};

export type Project = {
  id: string;
  title: string;
  manuscript: string;
  createdAt: string;
  updatedAt: string;
  styleProfile?: StyleProfile;
};

export type FormatResult = {
  wordCount: number;
  estimatedPages: number;
  trimSize: string;
  lineSpacing: number;
};

export type ResearchSource = {
  title: string;
  url: string;
  snippet: string;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};