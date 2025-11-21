import React from "react";

type ModelStatusPanelProps = {
  apiBase: string;
};

const ModelStatusPanel: React.FC<ModelStatusPanelProps> = ({ apiBase }) => {
  return (
    <section className="model-status-panel" style={{ padding: "1rem", border: "1px solid #444", marginTop: "1rem" }}>
      <h2>AI Model Status</h2>
      <p style={{ opacity: 0.8 }}>
        Backend API Base URL: <code>{apiBase}</code>
      </p>
      <p style={{ opacity: 0.8 }}>
        For full environment & AI status, open Settings → <strong>Server & AI Status</strong>.
      </p>
    </section>
  );
};

export default ModelStatusPanel;