import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function simpleSignals(text) {
  const signals = [];
  let score = 20;

  const sensational =
    /\b(shocking|explosive|they don’t want you to know|they don't want you to know|secret|wake up|exposed|destroyed)\b/i;
  const absolute = /\b(always|never|everyone|no one|100%|guaranteed|proof)\b/i;
  const urgency = /\b(share this|before it’s deleted|before it's deleted|act now|urgent|must see)\b/i;
  const conspiracy = /\b(mainstream media|cover[- ]?up|deep state|they are lying)\b/i;
  const hasLink = /(https?:\/\/|www\.)/i;

  if (sensational.test(text)) {
    signals.push("Sensational / clickbait language");
    score += 15;
  }
  if (absolute.test(text)) {
    signals.push("Absolutist wording (always/never/guaranteed)");
    score += 10;
  }
  if (urgency.test(text)) {
    signals.push("Urgency / ‘share now’ framing");
    score += 15;
  }
  if (conspiracy.test(text)) {
    signals.push("Conspiracy framing (‘cover-up’, ‘they’re lying’)");
    score += 20;
  }
  if (!hasLink.test(text) && text.length > 120) {
    signals.push("No sources/links provided");
    score += 10;
  }
  if (text.trim().length < 40) {
    signals.push("Very short claim (hard to verify from context)");
    score += 5;
  }
  if (/\b(might|could|unclear|preliminary|early findings)\b/i.test(text)) {
    signals.push("Uses cautious language (slightly lowers risk)");
    score -= 10;
  }

  score = clamp(score, 0, 100);

  let label = "Low risk";
  if (score >= 70) label = "High risk";
  else if (score >= 40) label = "Medium risk";

  return {
    score,
    label,
    signals: signals.slice(0, 6),
    tips: [
      "Look for a primary source (official statement, study, data).",
      "Check if multiple reputable outlets report the same core facts.",
      "Be cautious with screenshots/quotes without context.",
    ],
  };
}

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Heuristic (non-LLM) endpoint
app.post("/analyze", (req, res) => {
  const text = String(req.body?.text ?? "").trim();
  if (!text) return res.status(400).json({ error: "Missing text" });

  const result = simpleSignals(text);
  res.json(result);
});

// LLM assistant endpoint (does NOT claim truth; gives risk + verification steps)
app.post("/analyze-llm", async (req, res) => {
  try {
    const text = String(req.body?.text ?? "").trim();
    if (!text) return res.status(400).json({ error: "Missing text" });

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "YOUR_KEY_HERE") {
      return res.status(500).json({
        error:
          "OPENAI_API_KEY is not set (or is still YOUR_KEY_HERE). Export your real key and restart the server.",
      });
    }

    const prompt = `
You are a misinformation analysis assistant. You DO NOT know the ground truth.
You must NOT claim a statement is true or false.
Your job: assess risk signals and propose verification steps.

Return ONLY valid JSON with this schema:
{
  "risk": "Low" | "Medium" | "High",
  "summary": string,
  "redFlags": string[],
  "whatToVerify": string[],
  "suggestedSearchQueries": string[],
  "trustedSourceTypes": string[],
  "neutralRewrite": string
}

Analyze this text:
"""${text}"""
`.trim();

    const response = await client.responses.create({
      model: "gpt-5.2",
      input: prompt,
    });

    const raw = response.output_text?.trim() ?? "";

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      // If the model didn't output JSON, return a safe fallback
      return res.json({
        risk: "Medium",
        summary: "Model returned non-JSON output. Showing raw text.",
        redFlags: [],
        whatToVerify: [],
        suggestedSearchQueries: [],
        trustedSourceTypes: [],
        neutralRewrite: "",
        raw,
      });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
