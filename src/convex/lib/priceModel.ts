/**
 * KrishiMitra AI — Price prediction model (pure math, no I/O).
 *
 * Model: Holt's linear trend method (double exponential smoothing) on the
 * DAILY modal price series. Why this and not ARIMA/XGBoost:
 *  • The AGMARKNET daily-price dataset on data.gov.in only retains a short
 *    rolling window (~1–2 weeks), and the sample API key returns at most 10
 *    records per request. ARIMA needs months of clean history; Holt fits a
 *    short irregular series without per-market order tuning.
 *  • One-step residuals give an honest prediction band (±1.5σ) — no fake
 *    precision. Fewer than MIN_DAYS distinct dates → refuse to forecast.
 *  • Deterministic and dependency-free: runs inside a Convex action and
 *    mirrors cleanly to the Python backend.
 */

export interface PricePoint {
  date: string; // YYYY-MM-DD
  modal: number; // ₹/quintal
  min: number;
  max: number;
}

export interface ForecastPoint {
  date: string;
  modal: number;
  min: number;
  max: number;
}

export interface ForecastResult {
  series: { date: string; modal: number }[]; // daily aggregated history
  forecast: ForecastPoint[];
  trend: {
    direction: "increasing" | "decreasing" | "stable";
    /** Estimated ₹ change per day over the fitted window. */
    perDay: number;
  };
  band: { pct: number }; // ± % band around predicted modal
  model: {
    name: string;
    note: string;
    points: number; // distinct daily points used
    days: number; // = points
    alpha: number;
    beta: number;
  };
}

export class InsufficientDataError extends Error {
  constructor() {
    super("insufficient_data");
    this.name = "InsufficientDataError";
  }
}

export const MIN_DAYS = 6; // minimum distinct daily points for a fit
export const MAX_HORIZON_DAYS = 14; // short-term only, honestly labelled

/** Median of a numeric list (robust to mandi outliers). */
export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}

/**
 * Aggregate irregular daily records (multiple varieties/markets per date)
 * into one point per date: median modal, min of mins, max of maxes.
 */
export function toDaily(points: PricePoint[]): PricePoint[] {
  const buckets = new Map<string, PricePoint[]>();
  for (const p of points) {
    const arr = buckets.get(p.date);
    if (arr) arr.push(p);
    else buckets.set(p.date, [p]);
  }
  return [...buckets.keys()]
    .sort()
    .map((date) => {
      const pts = buckets.get(date)!;
      return {
        date,
        modal: Math.round(median(pts.map((x) => x.modal))),
        min: Math.min(...pts.map((x) => x.min)),
        max: Math.max(...pts.map((x) => x.max)),
      };
    });
}

/** One Holt run: returns fitted one-step values and final level/trend. */
function holtRun(
  y: number[],
  alpha: number,
  beta: number,
): { fitted: number[]; sse: number; level: number; trend: number } {
  let level = y[0]!;
  let trend = y.length > 1 ? y[1]! - y[0]! : 0;
  const fitted: number[] = [y[0]!];
  let sse = 0;
  for (let i = 1; i < y.length; i++) {
    const f1 = level + trend;
    fitted.push(f1);
    const err = y[i]! - f1;
    sse += err * err;
    const prevLevel = level;
    level = alpha * y[i]! + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  return { fitted, sse, level, trend };
}

/**
 * Holt's linear trend with a small deterministic grid search over
 * (alpha, beta) minimising one-step SSE.
 */
export function holtForecast(
  daily: { date: string; modal: number }[],
  horizonDays: number,
): {
  fitted: number[];
  forecast: number[];
  level: number;
  trend: number;
  alpha: number;
  beta: number;
  residualStd: number;
} {
  const y = daily.map((d) => d.modal);
  let best = {
    alpha: 0.5,
    beta: 0.2,
    sse: Infinity,
    fitted: [] as number[],
    level: y[0] ?? 0,
    trend: 0,
  };
  for (const a of [0.2, 0.4, 0.6, 0.8]) {
    for (const b of [0.05, 0.1, 0.2, 0.3]) {
      const r = holtRun(y, a, b);
      if (r.sse < best.sse) {
        best = { alpha: a, beta: b, ...r };
      }
    }
  }
  const residuals = y.slice(1).map((v, i) => v - best.fitted[i + 1]!);
  const residualStd =
    residuals.length > 0
      ? Math.sqrt(residuals.reduce((s, e) => s + e * e, 0) / residuals.length)
      : 0;

  const forecast: number[] = [];
  for (let h = 1; h <= horizonDays; h++) {
    forecast.push(Math.max(0, Math.round(best.level + h * best.trend)));
  }
  return {
    fitted: best.fitted,
    forecast,
    level: best.level,
    trend: best.trend,
    alpha: best.alpha,
    beta: best.beta,
    residualStd,
  };
}

/** ±1.5σ of one-step residuals, as a % of the last observed price. */
export function bandPct(residualStd: number, lastPrice: number): number {
  if (lastPrice <= 0) return 15;
  return Math.min(35, Math.max(6, Math.round(((1.5 * residualStd) / lastPrice) * 100)));
}

export function classifyTrend(
  perDay: number,
  lastPrice: number,
): "increasing" | "decreasing" | "stable" {
  if (lastPrice <= 0) return "stable";
  // Threshold: ±1.5% over a week ≈ ±0.21%/day — anything smaller is noise.
  const rel = (perDay * 7) / lastPrice;
  if (rel > 0.015) return "increasing";
  if (rel < -0.015) return "decreasing";
  return "stable";
}

/**
 * Full forecast pipeline: clean chronological series → daily aggregation →
 * Holt fit → daily forecast with a ±band. Throws InsufficientDataError when
 * there are fewer than MIN_DAYS distinct dates.
 */
export function forecast(
  points: PricePoint[],
  horizonDays = 7,
): ForecastResult {
  const cleaned = [...points]
    .filter(
      (p) =>
        Number.isFinite(p.modal) &&
        p.modal > 0 &&
        Number.isFinite(p.min) &&
        Number.isFinite(p.max),
    )
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const series = toDaily(cleaned);
  if (series.length < MIN_DAYS) {
    throw new InsufficientDataError();
  }
  const horizon = Math.min(MAX_HORIZON_DAYS, Math.max(1, Math.round(horizonDays)));
  const fit = holtForecast(
    series.map((d) => ({ date: d.date, modal: d.modal })),
    horizon,
  );
  const last = series[series.length - 1]!;
  const band = bandPct(fit.residualStd, last.modal);
  const perDay = Math.round(fit.trend * 10) / 10;
  const direction = classifyTrend(perDay, last.modal);

  const start = new Date(last.date + "T00:00:00Z");
  const fc: ForecastPoint[] = fit.forecast.map((modal, i) => {
    const d = new Date(start.getTime() + (i + 1) * 86400000);
    return {
      date: d.toISOString().slice(0, 10),
      modal,
      min: Math.max(0, Math.round((modal * (100 - band)) / 100)),
      max: Math.round((modal * (100 + band)) / 100),
    };
  });

  return {
    series: series.map((p) => ({ date: p.date, modal: p.modal })),
    forecast: fc,
    trend: { direction, perDay },
    band: { pct: band },
    model: {
      name: "Holt's linear trend (double exponential smoothing)",
      note: "Daily medians of mandi records · ±1.5σ one-step residual band",
      points: series.length,
      days: series.length,
      alpha: fit.alpha,
      beta: fit.beta,
    },
  };
}
