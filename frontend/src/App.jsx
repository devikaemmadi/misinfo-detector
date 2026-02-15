import { useState } from "react";
import "./App.css";

export default function App() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function onAnalyze() {
    setLoading(true);
    setResult(null);

    const resp = await fetch("http://localhost:8000/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await resp.json();
    setResult(data);
    setLoading(false);
  }

  return (
    <div className="app-container">
      <div className="ai-pill">
        Misinformation Detector ✨
      </div>

      <div className="input-card">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter a claim to analyze..."
          rows={6}
        />

        <button className="analyze-btn" onClick={onAnalyze}>
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </div>

      {result && (
        <div className="result-card">
          <h2>
            {result.label} ({result.score}/100)
          </h2>

          <h3>Signals</h3>
          <ul>
            {result.signals.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>

          {result.fact_explanation && (
            <div className="fact-box">
              <h3>Live Evidence Check</h3>
              <p><strong>Verdict:</strong> {result.fact_explanation.verdict}</p>
              <p><strong>Confidence:</strong> {result.fact_explanation.confidence}</p>
              <p><strong>Alignment Score:</strong> {result.fact_explanation.alignment_score}</p>
              <p className="evidence">
                {result.fact_explanation.evidence_snippet}...
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
