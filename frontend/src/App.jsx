import { useMemo, useState } from "react";
import "./App.css";

export default function App() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const disabled = useMemo(() => text.trim().length === 0 || loading, [text, loading]);

  async function onAnalyze() {
    try {
      setLoading(true);
      setResult(null);

      const resp = await fetch("http://localhost:8000/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Request failed");

      setResult(data);
    } catch (e) {
      setResult({
        score: 0,
        label: "Error",
        signals: [String(e?.message || e)],
        tips: ["Make sure the backend is running: cd backend && node server.js"],
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, marginBottom: 6 }}>Misinformation Risk Checker</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Paste a claim or paragraph. You’ll get a risk score + signals to verify (not a definitive truth verdict).
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste text here…"
        rows={10}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 12,
          border: "1px solid #ddd",
          fontSize: 14,
          lineHeight: 1.4,
        }}
      />

      <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "center" }}>
        <button
          onClick={onAnalyze}
          disabled={disabled}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #111",
            background: disabled ? "#eee" : "#111",
            color: disabled ? "#888" : "#fff",
            cursor: disabled ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "Analyzing…" : "Analyze"}
        </button>

        <button
          onClick={() => {
            setText("");
            setResult(null);
          }}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Clear
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 18, padding: 16, borderRadius: 16, border: "1px solid #ddd" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {result.label} ({result.score}/100)
            </div>
            <div style={{ opacity: 0.7, fontSize: 13 }}>Higher score = more red flags detected</div>
          </div>

          <h3 style={{ marginBottom: 8 }}>Signals detected</h3>
          {result.signals?.length ? (
            <ul style={{ marginTop: 0 }}>
              {result.signals.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          ) : (
            <p style={{ marginTop: 0, opacity: 0.8 }}>No strong signals detected.</p>
          )}

          <h3 style={{ marginBottom: 8 }}>How to verify</h3>
          <ul style={{ marginTop: 0 }}>
            {result.tips?.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
