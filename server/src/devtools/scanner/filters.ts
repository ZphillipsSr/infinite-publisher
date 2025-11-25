const TEXT_EXTENSIONS = [
  ".ts", ".tsx", ".js", ".jsx",
  ".json", ".md", ".txt",
  ".html", ".css"
];

export function isTextFile(filePath: string): boolean {
  return TEXT_EXTENSIONS.some(ext => filePath.toLowerCase().endsWith(ext));
}