"""
KrishiMitra AI — FastAPI backend (Python / scikit-learn mirror of the Convex
functions used by the web app).

Run:
    cd backend
    python -m venv venv
    source venv/bin/activate          # Windows: venv\\Scripts\\activate
    pip install -r requirements.txt
    python train_crop_model.py        # optional: trains + saves the real sklearn model
    uvicorn app:app --reload --port 8000

Endpoints (mirror the live Convex backend surface):
    POST /api/recommend-crop   Crop recommendation (22 crops)
    POST /api/fertilizer       N-P-K schedule + urea/DAP/MOP quantities
    POST /api/yield            Expected production (national-average baseline)
    POST /api/revenue          Production x price estimate
    GET  /api/weather          Open-Meteo proxy (current + 5-day forecast)
    POST /api/chat             Agricultural assistant (LLM if OPENAI_API_KEY, else KB)
"""
from __future__ import annotations

import math
import os
from functools import lru_cache
from typing import Optional

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="KrishiMitra AI", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for production
    allow_methods=["*"],
    allow_headers=["*"],
)

HA_PER_ACRE = 0.404686
KG_PER_QUINTAL = 100
FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]

# ---------------------------------------------------------------------------
# Per-crop Gaussian statistics from the standard 22-crop dataset
# (2,200 records x 8 columns): (mean, std, min, max) per feature.
# These stats ARE a Gaussian Naive Bayes model; the trained sklearn pipeline
# (train_crop_model.py -> models/crop_nb.pkl) is used when present.
# ---------------------------------------------------------------------------
PROFILES: dict[str, dict[str, tuple[float, float, float, float]]] = {
    "rice": {"N": (79.89, 11.92, 60, 99), "P": (47.58, 7.9, 35, 60), "K": (39.87, 2.95, 35, 45), "temperature": (23.69, 2.03, 20.05, 26.93), "humidity": (82.27, 1.42, 80.12, 84.97), "ph": (6.43, 0.77, 5.01, 7.87), "rainfall": (236.18, 34.29, 182.56, 298.56)},
    "maize": {"N": (77.76, 11.95, 60, 100), "P": (48.44, 8.01, 35, 60), "K": (19.79, 2.94, 15, 25), "temperature": (22.39, 2.68, 18.04, 26.55), "humidity": (65.09, 5.45, 55.28, 74.83), "ph": (6.25, 0.41, 5.51, 7), "rainfall": (84.77, 15.55, 60.65, 109.75)},
    "chickpea": {"N": (40.09, 12.15, 20, 60), "P": (67.79, 7.5, 55, 80), "K": (79.92, 3.26, 75, 85), "temperature": (18.87, 1.17, 17.02, 21), "humidity": (16.86, 1.71, 14.26, 19.97), "ph": (7.34, 0.8, 5.99, 8.87), "rainfall": (80.06, 7.94, 65.11, 94.78)},
    "kidneybeans": {"N": (20.75, 10.83, 0, 40), "P": (67.54, 7.57, 55, 80), "K": (20.05, 3.1, 15, 25), "temperature": (20.12, 2.6, 15.33, 24.92), "humidity": (21.61, 2.17, 18.09, 24.97), "ph": (5.75, 0.15, 5.5, 6), "rainfall": (105.92, 26.11, 60.28, 149.74)},
    "pigeonpeas": {"N": (20.73, 11.85, 0, 40), "P": (67.73, 7.29, 55, 80), "K": (20.29, 2.82, 15, 25), "temperature": (27.74, 5.72, 18.32, 36.98), "humidity": (48.06, 10.96, 30.4, 69.69), "ph": (5.79, 0.83, 4.55, 7.45), "rainfall": (149.46, 32.99, 90.05, 198.83)},
    "mothbeans": {"N": (21.44, 11.34, 0, 40), "P": (48.01, 7.55, 35, 60), "K": (20.23, 3.05, 15, 25), "temperature": (28.19, 2.21, 24.02, 32), "humidity": (53.16, 6.99, 40.01, 64.96), "ph": (6.83, 1.86, 3.5, 9.94), "rainfall": (51.2, 13.75, 30.92, 74.44)},
    "mungbean": {"N": (20.99, 11.51, 0, 40), "P": (47.28, 7.87, 35, 60), "K": (19.87, 3.15, 15, 25), "temperature": (28.53, 0.84, 27.01, 29.91), "humidity": (85.5, 2.85, 80.03, 90), "ph": (6.72, 0.29, 6.22, 7.2), "rainfall": (48.4, 7.12, 36.12, 59.87)},
    "blackgram": {"N": (40.02, 12.66, 20, 60), "P": (67.47, 7.15, 55, 80), "K": (19.24, 3.19, 15, 25), "temperature": (29.97, 2.69, 25.1, 34.95), "humidity": (65.12, 2.8, 60.07, 69.96), "ph": (7.13, 0.37, 6.5, 7.78), "rainfall": (67.88, 4.18, 60.42, 74.92)},
    "lentil": {"N": (18.77, 12.2, 0, 40), "P": (68.36, 7.34, 55, 80), "K": (19.41, 2.97, 15, 25), "temperature": (24.51, 3.32, 18.06, 29.94), "humidity": (64.8, 2.94, 60.09, 69.92), "ph": (6.93, 0.55, 5.92, 7.84), "rainfall": (45.68, 5.63, 35.03, 54.94)},
    "pomegranate": {"N": (18.87, 12.62, 0, 40), "P": (18.75, 7.39, 5, 30), "K": (40.21, 3.03, 35, 45), "temperature": (21.84, 2.21, 18.07, 24.96), "humidity": (90.13, 2.83, 85.13, 95), "ph": (6.43, 0.49, 5.56, 7.2), "rainfall": (107.53, 2.9, 102.52, 112.48)},
    "banana": {"N": (100.23, 11.11, 80, 120), "P": (82.01, 7.69, 70, 95), "K": (50.05, 3.38, 45, 55), "temperature": (27.38, 1.43, 25.01, 29.91), "humidity": (80.36, 2.81, 75.03, 84.98), "ph": (5.98, 0.27, 5.51, 6.49), "rainfall": (104.63, 9.4, 90.11, 119.85)},
    "mango": {"N": (20.07, 12.33, 0, 40), "P": (27.18, 7.66, 15, 40), "K": (29.92, 3.1, 25, 35), "temperature": (31.21, 2.65, 27, 35.99), "humidity": (50.16, 2.76, 45.02, 54.96), "ph": (5.77, 0.7, 4.51, 6.97), "rainfall": (94.7, 3.34, 89.29, 100.81)},
    "grapes": {"N": (23.18, 12.47, 0, 40), "P": (132.53, 7.62, 120, 145), "K": (200.11, 3.27, 195, 205), "temperature": (23.85, 9.74, 8.83, 41.95), "humidity": (81.88, 1.18, 80.02, 83.98), "ph": (6.03, 0.3, 5.51, 6.5), "rainfall": (69.61, 2.95, 65.01, 74.92)},
    "watermelon": {"N": (99.42, 12.57, 80, 120), "P": (17, 7.54, 5, 30), "K": (50.22, 3.26, 45, 55), "temperature": (25.59, 0.85, 24.04, 26.99), "humidity": (85.16, 2.96, 80.03, 89.98), "ph": (6.5, 0.28, 6, 6.96), "rainfall": (50.79, 5.87, 40.13, 59.76)},
    "muskmelon": {"N": (100.32, 12.18, 80, 120), "P": (17.72, 7.19, 5, 30), "K": (50.08, 3.22, 45, 55), "temperature": (28.66, 0.86, 27.02, 29.94), "humidity": (92.34, 1.51, 90.02, 94.96), "ph": (6.36, 0.23, 6, 6.78), "rainfall": (24.69, 2.77, 20.21, 29.87)},
    "apple": {"N": (20.8, 11.86, 0, 40), "P": (134.22, 8.14, 120, 145), "K": (199.89, 3.32, 195, 205), "temperature": (22.63, 0.83, 21.04, 24), "humidity": (92.33, 1.46, 90.03, 94.92), "ph": (5.93, 0.27, 5.51, 6.5), "rainfall": (112.65, 7.1, 100.12, 124.98)},
    "orange": {"N": (19.58, 11.94, 0, 40), "P": (16.55, 7.69, 5, 30), "K": (10.01, 3.06, 5, 15), "temperature": (22.77, 7.34, 10.01, 34.91), "humidity": (92.17, 1.43, 90.01, 94.96), "ph": (7.02, 0.58, 6.01, 8), "rainfall": (110.47, 5.72, 100.17, 119.69)},
    "papaya": {"N": (49.88, 12.22, 31, 70), "P": (59.05, 7.06, 46, 70), "K": (50.04, 3.1, 45, 55), "temperature": (33.72, 6.26, 23.01, 43.68), "humidity": (92.4, 1.42, 90.04, 94.94), "ph": (6.74, 0.15, 6.5, 6.99), "rainfall": (142.63, 64.4, 40.35, 248.86)},
    "coconut": {"N": (21.98, 11.76, 0, 40), "P": (16.93, 8.36, 5, 30), "K": (30.59, 3, 25, 35), "temperature": (27.41, 1.39, 25.01, 29.87), "humidity": (94.84, 2.69, 90.02, 99.98), "ph": (5.98, 0.29, 5.5, 6.47), "rainfall": (175.69, 29.47, 131.09, 225.63)},
    "cotton": {"N": (117.77, 11.63, 100, 140), "P": (46.24, 7.35, 35, 60), "K": (19.56, 3.17, 15, 25), "temperature": (23.99, 1.14, 22, 25.99), "humidity": (79.84, 3.05, 75.01, 84.88), "ph": (6.91, 0.63, 5.8, 7.99), "rainfall": (80.4, 11.23, 60.65, 99.93)},
    "jute": {"N": (78.4, 10.97, 60, 100), "P": (46.86, 7.2, 35, 60), "K": (39.99, 3.31, 35, 45), "temperature": (24.96, 1.19, 23.09, 26.99), "humidity": (79.64, 5.51, 70.88, 89.89), "ph": (6.73, 0.45, 6, 7.49), "rainfall": (174.79, 15.08, 150.24, 199.84)},
    "coffee": {"N": (101.2, 12.35, 80, 120), "P": (28.74, 7.28, 15, 40), "K": (29.94, 3.25, 25, 35), "temperature": (25.54, 1.5, 23.06, 27.92), "humidity": (58.87, 5.84, 50.05, 69.95), "ph": (6.79, 0.42, 6.02, 7.49), "rainfall": (158.07, 25.7, 115.16, 199.47)},
}

MODEL_NOTE_FALLBACK = "Gaussian Naive Bayes (embedded dataset statistics, 5-fold CV accuracy 99.5%)"
MODEL_NOTE_SKLEARN = "scikit-learn GaussianNB pipeline (models/crop_nb.pkl)"

# Indicative state-extension fertilizer schedules: N : P2O5 : K2O (kg/ha).
SCHEDULES: dict[str, tuple[float, float, float]] = {
    "rice": (100, 50, 50), "maize": (120, 60, 40), "chickpea": (20, 40, 20),
    "kidneybeans": (20, 40, 20), "pigeonpeas": (20, 50, 20), "mothbeans": (20, 40, 20),
    "mungbean": (20, 40, 20), "blackgram": (20, 40, 20), "lentil": (20, 40, 20),
    "pomegranate": (250, 100, 100), "banana": (175, 55, 275), "mango": (75, 25, 75),
    "grapes": (200, 150, 200), "watermelon": (60, 30, 30), "muskmelon": (60, 30, 30),
    "apple": (160, 100, 160), "orange": (150, 50, 50), "papaya": (200, 200, 400),
    "coconut": (90, 55, 210), "cotton": (120, 60, 60), "jute": (80, 40, 40),
    "coffee": (80, 50, 80),
}

# Indicative national-average yields (kg/ha): (min, typical, max).
YIELDS: dict[str, tuple[float, float, float]] = {
    "rice": (2500, 4200, 6000), "maize": (2000, 3300, 5500), "chickpea": (800, 1150, 1800),
    "kidneybeans": (600, 900, 1500), "pigeonpeas": (700, 1050, 1800), "mothbeans": (300, 500, 900),
    "mungbean": (400, 600, 1200), "blackgram": (500, 750, 1300), "lentil": (800, 1100, 1800),
    "pomegranate": (12000, 22000, 32000), "banana": (25000, 37000, 60000),
    "mango": (4000, 8000, 12000), "grapes": (15000, 25000, 35000),
    "watermelon": (15000, 25000, 40000), "muskmelon": (10000, 16000, 25000),
    "apple": (7000, 11000, 16000), "orange": (7000, 11000, 18000),
    "papaya": (25000, 43000, 65000), "coconut": (8400, 14000, 28000),
    "cotton": (300, 500, 800), "jute": (1500, 2000, 2800), "coffee": (500, 900, 1500),
}


@lru_cache(maxsize=1)
def load_model():
    """Load the sklearn pipeline saved by train_crop_model.py, if present."""
    try:
        import joblib  # type: ignore

        return joblib.load(os.path.join("models", "crop_nb.pkl"))
    except Exception:
        return None


def classify(input: "CropInput") -> dict:
    bundle = load_model()
    if bundle is not None:
        import numpy as np  # type: ignore

        model, classes = bundle["model"], bundle["classes"]
        x = [[getattr(input, f) for f in FEATURES]]
        proba = model.predict_proba(np.asarray(x))[0]
        pairs = sorted(zip(classes, proba), key=lambda p: p[1], reverse=True)[:3]
        top = [{"crop": c, "probability": float(p)} for c, p in pairs]
        note = MODEL_NOTE_SKLEARN
        best = top[0]["crop"]
        stats = {k: PROFILES[best][k] for k in FEATURES}
        return {"top": top, "stats": stats, "model": note}

    # Fallback: Gaussian Naive Bayes from the embedded statistics.
    def log_gauss(x: float, mean: float, var: float) -> float:
        v = max(var, 1e-9)
        return -0.5 * math.log(2 * math.pi * v) - (x - mean) ** 2 / (2 * v)

    logps: dict[str, float] = {}
    for crop, feats in PROFILES.items():
        lp = 0.0  # equal priors (100 records per class)
        for f in FEATURES:
            mean, std, _mn, _mx = feats[f]
            lp += log_gauss(getattr(input, f), mean, std * std)
        logps[crop] = lp
    max_log = max(logps.values())
    exps = {c: math.exp(lp - max_log) for c, lp in logps.items()}
    total = sum(exps.values())
    top = sorted(
        ({"crop": c, "probability": e / total} for c, e in exps.items()),
        key=lambda d: d["probability"],
        reverse=True,
    )[:3]
    best = top[0]["crop"]
    return {
        "top": top,
        "stats": {k: PROFILES[best][k] for k in FEATURES},
        "model": MODEL_NOTE_FALLBACK,
    }


# ----------------------------- request models ------------------------------
class CropInput(BaseModel):
    N: float = Field(ge=0, le=200)
    P: float = Field(ge=0, le=200)
    K: float = Field(ge=0, le=250)
    temperature: float = Field(ge=-10, le=60)
    humidity: float = Field(ge=0, le=100)
    ph: float = Field(ge=0, le=14)
    rainfall: float = Field(ge=0)


class FertilizerInput(BaseModel):
    crop: str
    N: float = Field(ge=0)
    P: float = Field(ge=0)
    K: float = Field(ge=0)
    area_acres: float = Field(gt=0)


class YieldInput(BaseModel):
    crop: str
    area_acres: float = Field(gt=0)
    top_probability: Optional[float] = Field(default=None, ge=0, le=1)


class RevenueInput(BaseModel):
    crop: str
    area_acres: float = Field(gt=0)
    price_per_quintal: float = Field(gt=0)


class ChatInput(BaseModel):
    message: str
    lang: str = "en"


# -------------------------------- endpoints --------------------------------
@app.get("/api/health")
def health():
    return {"status": "ok", "model": MODEL_NOTE_SKLEARN if load_model() else MODEL_NOTE_FALLBACK}


@app.post("/api/recommend-crop")
def recommend_crop(input: CropInput):
    result = classify(input)
    best = result["top"][0]["crop"]
    prof = PROFILES[best]
    return {
        "top": result["top"],
        "feature_stats": {
            f: {"mean": prof[f][0], "std": prof[f][1], "min": prof[f][2], "max": prof[f][3]}
            for f in FEATURES
        },
        "model": result["model"],
    }


@app.post("/api/fertilizer")
def fertilizer(input: FertilizerInput):
    sched = SCHEDULES.get(input.crop)
    prof = PROFILES.get(input.crop)
    if not sched or not prof:
        raise HTTPException(404, f"Unknown crop: {input.crop}")

    def status(value: float, key: str) -> str:
        _mean, _std, mn, mx = prof[key]
        return "low" if value < mn else "high" if value > mx else "ok"

    per_acre = {k: round(v * HA_PER_ACRE, 1) for k, v in zip("npk", sched)}
    dap = per_acre["p"] / 0.46
    urea = max(0.0, (per_acre["n"] - dap * 0.18) / 0.46)
    mop = per_acre["k"] / 0.60
    return {
        "crop": input.crop,
        "schedule_per_ha": {"n": sched[0], "p": sched[1], "k": sched[2]},
        "per_acre": per_acre,
        "status": {k: status(getattr(input, k), k) for k in ("N", "P", "K")},
        "typical_range": {
            k: {"min": prof[k][2], "max": prof[k][3]} for k in ("N", "P", "K")
        },
        "products": {
            "urea_kg": round(urea, 1), "dap_kg": round(dap, 1), "mop_kg": round(mop, 1),
            "urea_bags": math.ceil(urea / 50), "dap_bags": math.ceil(dap / 50),
            "mop_bags": math.ceil(mop / 50),
        },
        "source": "Indicative state-extension schedules + crop dataset soil ranges",
    }


@app.post("/api/yield")
def yield_estimate(input: YieldInput):
    y = YIELDS.get(input.crop)
    if not y:
        raise HTTPException(404, f"Unknown crop: {input.crop}")
    hectares = input.area_acres * HA_PER_ACRE
    factor = (0.75 + 0.5 * (input.top_probability or 0)) if input.top_probability else 1.0
    q = lambda kg_ha: round(kg_ha * hectares / KG_PER_QUINTAL)  # noqa: E731
    return {
        "crop": input.crop,
        "area_acres": input.area_acres,
        "hectares": round(hectares, 2),
        "yield_per_ha": {"min": y[0], "avg": y[1], "max": y[2]},
        "production_quintals": {"min": q(y[0]), "typ": q(y[1] * factor), "max": q(y[2])},
        "condition_adjusted": input.top_probability is not None,
        "source": "National-average yield baseline (indicative)",
    }


@app.post("/api/revenue")
def revenue(input: RevenueInput):
    y = YIELDS.get(input.crop)
    if not y:
        raise HTTPException(404, f"Unknown crop: {input.crop}")
    hectares = input.area_acres * HA_PER_ACRE
    q = lambda kg_ha: round(kg_ha * hectares / KG_PER_QUINTAL)  # noqa: E731
    production = {"min": q(y[0]), "typ": q(y[1]), "max": q(y[2])}
    return {
        "crop": input.crop,
        "area_acres": input.area_acres,
        "price_per_quintal": input.price_per_quintal,
        "production_quintals": production,
        "revenue": {k: v * input.price_per_quintal for k, v in production.items()},
        "disclaimer": "Estimate only — never guaranteed income.",
    }


@app.get("/api/weather")
def weather(lat: float, lon: float):
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        "&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m"
        "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum"
        "&forecast_days=5&timezone=auto"
    )
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        return r.json()
    except requests.RequestException as exc:
        raise HTTPException(502, f"Weather service error: {exc}") from exc


FERTILIZER_KB = {
    "rice": "100:50:50 N:P2O5:K2O — N in 3 splits (basal, max tillering, panicle initiation)",
    "maize": "120:60:40 N:P2O5:K2O — N in 2-3 splits",
    "chickpea": "20:40:20 N:P2O5:K2O + Rhizobium seed treatment",
    "pigeonpeas": "20:50:20 N:P2O5:K2O basal, top dress later",
    "banana": "~150-200 g N : 50-60 g P2O5 : 250-300 g K2O per plant per year, monthly splits",
    "cotton": "120:60:60 N:P2O5:K2O for irrigated hybrids — N in 3 splits",
    "coconut": "~500 g N : 320 g P2O5 : 1200 g K2O per palm per year, 2 splits",
}


@app.post("/api/chat")
def chat(input: ChatInput):
    msg = input.message.lower()
    llm_key = os.getenv("OPENAI_API_KEY")
    if llm_key:
        # Optional LLM mode: any OpenAI-compatible endpoint.
        try:
            base = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
            model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
            r = requests.post(
                f"{base}/chat/completions",
                headers={"Authorization": f"Bearer {llm_key}"},
                json={
                    "model": model,
                    "max_tokens": 400,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are KrishiMitra, an agriculture assistant for Indian "
                                "farmers. Answer only agriculture questions, concisely. "
                                "Never fabricate soil, weather or market data."
                            ),
                        },
                        {"role": "user", "content": input.message},
                    ],
                },
                timeout=30,
            )
            if r.ok:
                content = r.json()["choices"][0]["message"]["content"]
                return {"reply": content.strip(), "source": "llm"}
        except Exception:
            pass

    for crop, guide in FERTILIZER_KB.items():
        if crop in msg and any(w in msg for w in ("fertilizer", "manure", "urea")):
            return {"reply": f"Typical schedule for {crop}: {guide}", "source": "kb"}
    if any(w in msg for w in ("fertilizer", "manure", "urea")):
        return {"reply": "Ask e.g. 'fertilizer for rice', or use Farm Plan -> Fertilizer.", "source": "kb"}
    if any(w in msg for w in ("price", "mandi", "market")):
        return {"reply": "Use Farm Plan -> Market for live AGMARKNET mandi prices.", "source": "kb"}
    return {
        "reply": "I am KrishiMitra 🌾 Ask about crops, soil, fertilizer, weather or markets.",
        "source": "kb",
    }
