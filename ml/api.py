from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import requests
import re

# ==============================
# Load ML Model
# ==============================

APP_DIR = Path(__file__).resolve().parent
MODEL_PATH = APP_DIR / "artifacts" / "liar_tfidf_logreg.joblib"

model = joblib.load(MODEL_PATH)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TIPS = [
    "Look for a primary source (official statement, study, data).",
    "Check if multiple reputable outlets report the same core facts.",
    "Be cautious with screenshots/quotes without context.",
]

# ==============================
# Request / Response Models
# ==============================

class FactCheck(BaseModel):
    evidence_snippet: str
    verdict: str
    confidence: str
    alignment_score: float

class AnalyzeIn(BaseModel):
    text: str

class AnalyzeOut(BaseModel):
    label: str
    score: int
    signals: List[str]
    tips: List[str]
    prob_true: Optional[float] = None
    fact_explanation: Optional[FactCheck] = None

# ==============================
# Entity Extraction
# ==============================

def extract_entity(text):
    matches = re.findall(r"\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b", text)
    if matches:
        return matches[0]
    return text.split()[0]

# ==============================
# Wikipedia Retrieval
# ==============================

def wiki_summary(query):
    try:
        url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{query.replace(' ', '_')}"
        headers = {
            "User-Agent": "misinfo-detector/1.0 (devika project)"
        }

        response = requests.get(url, headers=headers)

        if response.status_code != 200:
            return None

        data = response.json()
        return data.get("extract")

    except:
        return None

# ==============================
# Grounded Fact Check
# ==============================

def grounded_fact_check(text):
    entity = extract_entity(text)
    evidence = wiki_summary(entity)

    if not evidence:
        return None

    text_lower = text.lower()
    evidence_lower = evidence.lower()

    if "element" in text_lower and "element" in evidence_lower:
        verdict = "Consistent with reference evidence."
        confidence = "High"
        alignment_score = 0.8
    elif "president" in text_lower and "president" in evidence_lower:
        verdict = "Consistent with reference evidence."
        confidence = "High"
        alignment_score = 0.8
    else:
        verdict = "Not clearly supported by reference evidence."
        confidence = "Low"
        alignment_score = 0.3

    return {
        "evidence_snippet": evidence[:300],
        "verdict": verdict,
        "confidence": confidence,
        "alignment_score": alignment_score
    }

# ==============================
# Health Route
# ==============================

@app.get("/health")
def health():
    return {"ok": True}

# ==============================
# Analyze Route
# ==============================

@app.post("/analyze", response_model=AnalyzeOut)
def analyze(body: AnalyzeIn):
    text = (body.text or "").strip()

    if not text:
        return {
            "label": "Error",
            "score": 0,
            "signals": ["Missing text"],
            "tips": TIPS,
            "prob_true": None,
            "fact_explanation": None,
        }

    proba = model.predict_proba([text])[0]
    prob_true = float(proba[1])

    risk_score = int(round((1.0 - prob_true) * 100))

    if risk_score >= 70:
        label = "High risk"
        signals = ["Model predicts high misinformation risk."]
    elif risk_score >= 40:
        label = "Medium risk"
        signals = ["Model sees mixed reliability signals."]
    else:
        label = "Low risk"
        signals = ["Model predicts lower misinformation risk."]

    fact_explanation = grounded_fact_check(text)

    return {
        "label": label,
        "score": risk_score,
        "signals": signals,
        "tips": TIPS,
        "prob_true": prob_true,
        "fact_explanation": fact_explanation,
    }
