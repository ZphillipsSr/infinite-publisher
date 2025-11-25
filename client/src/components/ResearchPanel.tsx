import React, { useState } from "react";

const DEFAULT_API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

type ResearchPanelProps = {
  apiBase?: string;
  manuscript: string;
  userOpenAIKey?: string | null;
};

type ResearchSource = {
  title?: string;
  url?: string;
  snippet?: string;
};

type WebSearchResponse = {
  provider?: string;
  sources?: ResearchSource[];
};

type FactCheckResponse = {
  result?: string;
  explanation?: string;
  sources?: ResearchSource[];
};

type ErrorResponse = {
  message?: string;
};

type ResearchResultMode = "search" | "fact-check" | "error";

type ResearchResultData =
  | WebSearchResponse
  | FactCheckResponse
  | ErrorResponse
  | null;

type ResearchResultState = {
  mode: ResearchResultMode;
  data: ResearchResultData;
} | null;

const ResearchPanel: React.FC<ResearchPanelProps> = ({
  apiBase = DEFAULT_API_BASE,
  manuscript,
  userOpenAIKey
}) => {
  const [researchQuery, setResearchQuery] = useState("");
  const [factClaim, setFactClaim] = useState("");
  const [researchResult, setResearchResult] = useState<ResearchResultState>(
    null
  );
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchSuggestions, setResearchSuggestions] = useState<string[]>([]);

  const buildHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    const key = userOpenAIKey?.trim();
    if (key) {
      headers["X-User-OpenAI-Key"] = key;
    }
    return headers;
  };

  const handleRunResearch = async () => {
    const query = researchQuery.trim();
    if (!query) {
      alert("Enter a search query.");
      return;
    }

    setResearchLoading(true);
    setResearchResult(null);

    try {
      const res = await fetch(`${apiBase}/api/research/search`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({ query })
      });

      if (!res.ok) {
        console.error("Research search failed with status", res.status);
        let errorPayload: unknown;
        try {
          errorPayload = await res.json();
        } catch {
          /* ignore JSON parse errors */
        }
        setResearchResult({
          mode: "error",
          data: {
            message:
              (errorPayload as ErrorResponse | undefined)?.message ||
              "Research search failed."
          }
        });
        return;
      }

      const data: WebSearchResponse = await res.json();
      setResearchResult({ mode: "search", data });
    } catch (err) {
      console.error("Research search failed", err);
      setResearchResult({
        mode: "error",
        data: { message: "Research search failed." }
      });
    } finally {
      setResearchLoading(false);
    }
  };

  const handleSuggestResearchTopics = () => {
    const text = manuscript;
    if (!text.trim()) {
      alert("Add some manuscript content first.");
      return;
    }

    const rawWords = text
      .split(/[^A-Za-z0-9]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 3);

    if (rawWords.length === 0) {
      alert("Not enough content to suggest topics.");
      return;
    }

    const stopWords = new Set([
      "this",
      "that",
      "with",
      "from",
      "have",
      "will",
      "they",
      "them",
      "then",
      "there",
      "here",
      "into",
      "about",
      "your",
      "their",
      "been",
      "what",
      "when",
      "where",
      "which",
      "would",
      "could",
      "should",
      "because",
      "while",
      "chapter",
      "section",
      "intro",
      "introduction",
      "conclusion",
      "the",
      "and",
      "for",
      "are",
      "was",
      "were",
      "you",
      "him",
      "her",
      "his",
      "she",
      "who",
      "why",
      "how",
      "these",
      "those"
    ]);

    const freq: Record<string, number> = {};
    for (const w of rawWords) {
      const key = w.toLowerCase();
      if (stopWords.has(key)) continue;
      freq[key] = (freq[key] || 0) + 1;
    }

    const candidates = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word]) => word);

    setResearchSuggestions(candidates);
  };

  const handleFactCheck = async () => {
    const targetClaim = factClaim.trim();
    if (!targetClaim) {
      alert("Enter a claim to fact-check.");
      return;
    }

    setResearchLoading(true);
    setResearchResult(null);

    try {
      const res = await fetch(`${apiBase}/api/research/fact-check`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({
          claim: targetClaim,
          // keep context small-ish so we don't send the whole book
          context: manuscript.slice(0, 2000)
        })
      });

      if (!res.ok) {
        console.error("Fact-check failed with status", res.status);
        let errorPayload: unknown;
        try {
          errorPayload = await res.json();
        } catch {
          /* ignore JSON parse errors */
        }
        setResearchResult({
          mode: "error",
          data: {
            message:
              (errorPayload as ErrorResponse | undefined)?.message ||
              "Fact-check failed."
          }
        });
        return;
      }

      const data: FactCheckResponse = await res.json();
      setResearchResult({ mode: "fact-check", data });
    } catch (err) {
      console.error("Fact-check failed", err);
      setResearchResult({
        mode: "error",
        data: { message: "Fact-check failed." }
      });
    } finally {
      setResearchLoading(false);
    }
  };

  const currentProvider =
    (researchResult?.data as WebSearchResponse | undefined)?.provider ||
    (researchResult?.data as FactCheckResponse | undefined)?.result ||
    undefined;

  const searchSources =
    (researchResult?.data as WebSearchResponse | undefined)?.sources || [];

  const factSources =
    (researchResult?.data as FactCheckResponse | undefined)?.sources || [];

  const isSearchMode = researchResult?.mode === "search";
  const isFactCheckMode = researchResult?.mode === "fact-check";
  const isErrorMode = researchResult?.mode === "error";

  return (
    <div className="console-pane console-pane-animated">
      <p className="console-hint">
        Use this panel to run <strong>web searches</strong> and{" "}
        <strong>fact-check claims</strong> related to your manuscript. Results
        come from the configured search APIs plus the AI summarizer.
      </p>

      {/* Web Search */}
      <div className="research-section">
        <h4>Web Search</h4>
        <p className="print-hint">
          Enter a query to search the web (Tavily / Serper). You can also let
          the app suggest topics based on your manuscript.
        </p>

        <div className="research-input-row">
          <input
            type="text"
            value={researchQuery}
            onChange={(e) => setResearchQuery(e.target.value)}
            placeholder="Search topic, concept, or question…"
          />
          <button
            type="button"
            onClick={handleRunResearch}
            disabled={researchLoading || !researchQuery.trim()}
          >
            {researchLoading && isSearchMode ? "Searching..." : "Run Web Search"}
          </button>
          <button
            type="button"
            onClick={handleSuggestResearchTopics}
            disabled={!manuscript.trim()}
            style={{ marginLeft: "0.5rem" }}
          >
            Suggest from Manuscript
          </button>
        </div>

        {researchSuggestions.length > 0 && (
          <div className="research-suggestions">
            <p className="print-hint">
              Click a suggestion to use it as your search query:
            </p>
            <div className="suggestion-chips">
              {researchSuggestions.map((topic, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="suggestion-chip"
                  onClick={() => setResearchQuery(topic)}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fact Check */}
      <div className="research-section">
        <h4>Fact Check</h4>
        <p className="print-hint">
          Paste a specific claim or sentence. The AI will search the web,
          compare sources, and respond with a cautious verdict.
        </p>

        <textarea
          value={factClaim}
          onChange={(e) => setFactClaim(e.target.value)}
          rows={3}
          placeholder='Example: "The human brain contains about 86 billion neurons."'
        />
        <button
          type="button"
          onClick={handleFactCheck}
          disabled={researchLoading || !factClaim.trim()}
        >
          {researchLoading && isFactCheckMode
            ? "Fact-checking..."
            : "Run Fact Check"}
        </button>
      </div>

      {/* Results */}
      <div className="research-results">
        <h4>Results</h4>
        {researchLoading && !researchResult && (
          <p className="research-status">Working on it…</p>
        )}

        {!researchLoading && !researchResult && (
          <p className="chat-placeholder">
            Run a web search or fact check to see structured results here.
          </p>
        )}

        {researchResult && (
          <div className="research-output">
            {isSearchMode && (
              <>
                <p className="print-hint">
                  Web search results (provider: {currentProvider || "unknown"}):
                </p>
                {Array.isArray(searchSources) && searchSources.length > 0 ? (
                  <ul className="research-list">
                    {searchSources.map((s: ResearchSource, idx: number) => (
                      <li key={idx} className="research-item">
                        <strong>{s.title || "(no title)"}</strong>
                        {s.url && (
                          <div>
                            <a href={s.url} target="_blank" rel="noreferrer">
                              {s.url}
                            </a>
                          </div>
                        )}
                        {s.snippet && <p>{s.snippet}</p>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No sources returned.</p>
                )}
              </>
            )}

            {isFactCheckMode && (
              <>
                <p className="print-hint">
                  Fact-check verdict from AI + web search:
                </p>
                <p>
                  <strong>Result:</strong>{" "}
                  {(
                    (researchResult.data as FactCheckResponse | null)
                      ?.result || "UNKNOWN"
                  )
                    .toString()
                    .toUpperCase()}
                </p>
                {(researchResult.data as FactCheckResponse | null)
                  ?.explanation && (
                  <p>
                    <strong>Explanation:</strong>{" "}
                    {
                      (researchResult.data as FactCheckResponse | null)
                        ?.explanation
                    }
                  </p>
                )}
                {Array.isArray(factSources) && factSources.length > 0 && (
                  <>
                    <p className="print-hint">Sources considered:</p>
                    <ul className="research-list">
                      {factSources.map((s: ResearchSource, idx: number) => (
                        <li key={idx} className="research-item">
                          <strong>{s.title || "(no title)"}</strong>
                          {s.url && (
                            <div>
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {s.url}
                              </a>
                            </div>
                          )}
                          {s.snippet && <p>{s.snippet}</p>}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}

            {isErrorMode && (
              <p className="error">
                {(researchResult.data as ErrorResponse | null)?.message ||
                  "An error occurred running research."}
              </p>
            )}

            {/* Fallback raw JSON view for debugging */}
            <details style={{ marginTop: "0.5rem" }}>
              <summary>Show raw research payload (debug)</summary>
              <pre className="debug-output">
                {JSON.stringify(researchResult.data, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResearchPanel;