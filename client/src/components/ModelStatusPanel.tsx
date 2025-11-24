// src/components/ModelStatusPanel.tsx
//
// Simple status card for AI backend + keys.
// Matches /api/ai/models/status response shape from aiRoutes.ts.

import React, { useEffect, useState } from "react";

type ModelStatusResponse = {
  ok: boolean;
  provider?: string;
  freeOnly?: boolean;
  hasOpenRouterKey?: boolean;
  hasOpenAIKey?: boolean;
  timestamp?: string;
  error?: string;
};

type Props = {
  apiBase: string;
};

function ModelStatusPanel({ apiBase }: Props) {
  const [status, setStatus] = useState<ModelStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBase}/api/ai/models/status`);
      if (!res.ok) {
        const text = await res.text();
        console.error("Model status HTTP error:", res.status, text);
        setError(`HTTP ${res.status} ${res.statusText}`);
        setStatus(null);
        return;
      }

      const data = (await res.json()) as ModelStatusResponse;
      setStatus(data);
    } catch (err) {
      console.error("Model status fetch failed:", err);
      setError("Failed to contact /api/ai/models/status.");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // You can uncomment this if you ever want auto-refresh:
    // const id = setInterval(fetchStatus, 60_000);
    // return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  const providerLabel = (() => {
    if (!status) return "Unknown";
    const p = status.provider || "openrouter";
    if (p.toLowerCase() === "openrouter") return "OpenRouter (default)";
    if (p.toLowerCase() === "openai") return "OpenAI (direct)";
    return p;
  })();

  const freeModeLabel = (() => {
    if (!status) return "Unknown";
    if (status.freeOnly) return "Free-tier only";
    return "Paid / custom models allowed";
  })();

  const hasOR = status?.hasOpenRouterKey ?? false;
  const hasOA = status?.hasOpenAIKey ?? false;

  return (
    <div className="model-status-panel">
      <div className="model-status-header">
        <h3>AI Backend Status</h3>
        <button
          type="button"
          className="model-status-refresh"
          onClick={fetchStatus}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <p className="error">
          Could not load AI status: <span>{error}</span>
        </p>
      )}

      {!error && !status && !loading && (
        <p className="model-status-text">Status not loaded yet.</p>
      )}

      {status && (
        <div className="model-status-body">
          {!status.ok && status.error && (
            <p className="error">
              Backend reported an issue: <span>{status.error}</span>
            </p>
          )}

          <dl className="model-status-list">
            <div className="model-status-row">
              <dt>Provider</dt>
              <dd>{providerLabel}</dd>
            </div>

            <div className="model-status-row">
              <dt>Free mode</dt>
              <dd>{freeModeLabel}</dd>
            </div>

            <div className="model-status-row">
              <dt>OpenRouter API key</dt>
              <dd>{hasOR ? "Configured" : "Missing"}</dd>
            </div>

            <div className="model-status-row">
              <dt>OpenAI API key</dt>
              <dd>{hasOA ? "Configured" : "Not used / disabled"}</dd>
            </div>

            {status.timestamp && (
              <div className="model-status-row">
                <dt>Last check</dt>
                <dd>
                  {new Date(status.timestamp).toLocaleString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <p className="model-status-footnote">
        AI tools will fall back to free OpenRouter models if available. If
        they’re down or out of credits, outline/back-cover tools will show a
        text message instead of failing.
      </p>
    </div>
  );
}

export default ModelStatusPanel;