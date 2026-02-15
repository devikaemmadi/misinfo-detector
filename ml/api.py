from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib

APP_DIR = Path(__file__).resolve().parent
MODEL_PATH = APP_DIR / "artifacts" / "liar_tfidf_logreg.joblib"

model = joblib.load(MODEL_PATH)

app = FastAPI()

# allow your Vite dev server to call this API
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

class AnalyzeIn(BaseModel):
    text: str

class AnalyzeOut(BaseModel):
    label: str
    score: int
    signals: List[str]
    tips: List[str]
    prob_true: Optional[float] = None  # extra info; your UI will ignore it if you want

@app.get("/health")
def health():
    return {"ok": True}

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
        }

    # model is a sklearn Pipeline(tfidf + logistic regression)
    proba = model.predict_proba([text])[0]
    # classes order is model.classes_ -> [0,1] usually
    # In train.py we used y=1 for "true-ish"
    prob_true = float(proba[1])

    # Map prob_true into your existing 0-100 style score
    # Higher score = more misinformation risk
    risk_score = int(round((1.0 - prob_true) * 100))

    if risk_score >= 70:
        label = "High risk"
        signals = [
            "ML model predicts claim is likely misleading based on learned patterns (TF-IDF + Logistic Regression).",
            "High misinformation-risk score (low predicted reliability).",
        ]
    elif risk_score >= 40:
        label = "Medium risk"
        signals = [
            "ML model sees mixed signals based on learned patterns (TF-IDF + Logistic Regression).",
            "Verify using reputable sources before sharing.",
        ]
    else:
        label = "Low risk"
        signals = [
            "ML model predicts lower misinformation risk based on learned patterns (TF-IDF + Logistic Regression).",
            "Still verify if the claim is high-stakes (health/finance/safety).",
        ]

    return {
        "label": label,
        "score": risk_score,
        "signals": signals,
        "tips": TIPS,
        "prob_true": prob_true,
    }
