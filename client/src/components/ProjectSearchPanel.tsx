import React, { useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export type KbResult = {
  score: number;
  id: string;
  filePath: string;
  relPath: string;
  startLine: number;
  endLine: number;
  language: string;
  content: string;
};

type ProjectSearchPanelProps = {
  onUseInAssistant?: (payload: {
    query: string;
    result: KbResult;
    composedContext: string;
  }) => void;
};

export default function ProjectSearchPanel({
  onUseInAssistant,
}: ProjectSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KbResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        query: query.trim(),
        topK: "10",
      });

      const res = await fetch(
        `${API_BASE}/api/devtools/kb/search?${params.toString()}`
      );
      const json = await res.json();

      if (!res.ok || json.ok === false) {
        throw new Error(json.error || "Search failed");
      }

      setResults(json.results || []);
    } catch (err: any) {
      console.error("KB search failed:", err);
      setError(err?.message || "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="project-search-panel">
      <h2>Project KB Search</h2>
      <form onSubmit={runSearch} style={{ marginBottom: "0.5rem" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your codebase, e.g. 'Ollama embeddings'..."
          style={{ width: "100%", padding: "0.5rem" }}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          style={{ marginTop: "0.4rem" }}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error && (
        <div style={{ color: "red", marginBottom: "0.5rem" }}>{error}</div>
      )}

      <div style={{ maxHeight: "50vh", overflow: "auto", marginTop: "0.5rem" }}>
        {results.map((r) => (
          <div
            key={`${r.filePath}-${r.startLine}-${r.id}`}
            style={{
              marginBottom: "0.75rem",
              padding: "0.5rem",
              border: "1px solid #444",
              borderRadius: "4px",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "#aaa" }}>
              Score: {r.score.toFixed(3)} • {r.language} • lines{" "}
              {r.startLine}–{r.endLine}
            </div>
            <div style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              {r.relPath || r.filePath}
            </div>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontSize: "0.8rem",
                marginTop: "0.25rem",
              }}
            >
              {r.content}
            </pre>

            {onUseInAssistant && (
              <button
                type="button"
                style={{ marginTop: "0.4rem", fontSize: "0.8rem" }}
                onClick={() => {
                  const composedContext =
                    `Query: ${query.trim() || "(none)"}\n` +
                    `File: ${r.relPath || r.filePath}\n` +
                    `Lines: ${r.startLine}–${r.endLine}\n\n` +
                    r.content;

                  onUseInAssistant({
                    query: query.trim(),
                    result: r,
                    composedContext,
                  });
                }}
              >
                Use in Assistant
              </button>
            )}
          </div>
        ))}

        {!loading && !error && results.length === 0 && (
          <div style={{ fontSize: "0.8rem", color: "#888" }}>
            No results yet. Try a query above.
          </div>
        )}
      </div>
    </div>
  );
}