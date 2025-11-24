import React, { useState } from "react";

const DEFAULT_API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

type ResearchPanelProps = {
  apiBase?: string;
  manuscript: string;
};

type ResearchResultMode = "search" | "fact-check" | "error";

type ResearchResultState = {
  mode: ResearchResultMode;
  data: any;
} | null;

const ResearchPanel: React.FC<ResearchPanelProps> = ({
  apiBase = DEFAULT_API_BASE,
  manuscript
}) => {
  const [researchQuery, setResearchQuery] = useState("");
  const [factClaim, setFactClaim] = useState("");
  const [researchResult, setResearchResult] = useState<ResearchResultState>(
    null
  );
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchSuggestions, setResearchSuggestions] = useState<string[]>([]);

  const handleRunResearch = async () => {
    if (!researchQuery.trim()) {
      alert("Enter a search query.");
      return;
    }
    setResearchLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/research/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: researchQuery.trim()
        })
      });
      const data = await res.json();
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
    try {
      const res = await fetch(`${apiBase}/api/research/fact-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claim: targetClaim,
          context: manuscript.slice(0, 2000)
        })
      });
      const data = await res.json();
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
            {researchLoading && researchResult?.mode === "search"
              ? "Searching..."
              : "Run Web Search"}
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
          {researchLoading && researchResult?.mode === "fact-check"
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
            {researchResult.mode === "search" && (
              <>
                <p className="print-hint">
                  Web search results (provider:{" "}
                  {researchResult.data?.provider || "unknown"}):
                </p>
                {Array.isArray(researchResult.data?.sources) &&
                researchResult.data.sources.length > 0 ? (
                  <ul className="research-list">
                    {researchResult.data.sources.map(
                      (s: any, idx: number) => (
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
                      )
                    )}
                  </ul>
                ) : (
                  <p>No sources returned.</p>
                )}
              </>
            )}

            {researchResult.mode === "fact-check" && (
              <>
                <p className="print-hint">
                  Fact-check verdict from AI + web search:
                </p>
                <p>
                  <strong>Result:</strong>{" "}
                  {researchResult.data?.result?.toUpperCase?.() || "UNKNOWN"}
                </p>
                {researchResult.data?.explanation && (
                  <p>
                    <strong>Explanation:</strong>{" "}
                    {researchResult.data.explanation}
                  </p>
                )}
                {Array.isArray(researchResult.data?.sources) &&
                  researchResult.data.sources.length > 0 && (
                    <>
                      <p className="print-hint">Sources considered:</p>
                      <ul className="research-list">
                        {researchResult.data.sources.map(
                          (s: any, idx: number) => (
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
                          )
                        )}
                      </ul>
                    </>
                  )}
              </>
            )}

            {researchResult.mode === "error" && (
              <p className="error">
                {researchResult.data?.message ||
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