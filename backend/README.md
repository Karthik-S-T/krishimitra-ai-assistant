# KrishiMitra AI — Python FastAPI Backend

This is the **Python backend per the project spec** (FastAPI + pandas/NumPy +
scikit-learn + joblib). It mirrors every endpoint of the Convex backend that
powers the live web app in this workspace, so both stacks expose the same API
surface.

> **Note:** the web preview in this workspace runs on Convex (serverless
> functions — no separate server can be hosted here). Use this FastAPI service
> for the college-submission stack / your own deployment: run it locally and
> point any client at `http://localhost:8000`.

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Optional but recommended: train + save the real sklearn model
python train_crop_model.py      # -> models/crop_nb.pkl

uvicorn app:app --reload --port 8000
```

Interactive API docs: <http://localhost:8000/docs>

## Endpoints

| Method | Path                  | Purpose                                                    |
| ------ | --------------------- | ---------------------------------------------------------- |
| GET    | `/api/health`         | Service status + which model is loaded                     |
| POST   | `/api/recommend-crop` | Top-3 crop recommendation (22 crops) with feature stats    |
| POST   | `/api/fertilizer`     | N-P-K schedule, soil status, urea/DAP/MOP per acre         |
| POST   | `/api/yield`          | Expected production (quintals) from national-average yields|
| POST   | `/api/revenue`        | Production × price estimate (low/typical/high)             |
| GET    | `/api/weather`        | Open-Meteo proxy (current + 5-day forecast)                |
| POST   | `/api/chat`           | Agricultural assistant (LLM if `OPENAI_API_KEY`, else KB)  |

## Model

- `train_crop_model.py` downloads the standard 22-crop dataset
  (2,200 records × 8 columns), runs 5-fold cross-validated GaussianNB
  (~99.5% accuracy) and saves `models/crop_nb.pkl` via joblib.
- `app.py` loads that pickle at startup. If it is missing, it falls back to
  the embedded per-crop Gaussian statistics — which are mathematically the
  same Gaussian Naive Bayes classifier — so the API always works.

## Environment variables (optional)

- `OPENAI_API_KEY` — enables LLM mode for `/api/chat`
  (any OpenAI-compatible provider via `OPENAI_BASE_URL` / `OPENAI_MODEL`).
- `DATA_GOV_IN_API_KEY` — for live mandi prices in deployments that call the
  AGMARKNET feed on data.gov.in.
