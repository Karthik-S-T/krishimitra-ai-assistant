/**
 * KrishiMitra AI — Smart Farming Alerts rule engine (pure functions).
 *
 * Alerts are derived ONLY from real inputs the farmer already has in the app:
 *   • Open-Meteo daily forecast → rain / heat alerts
 *   • AGMARKNET mandi trend    → market movement alert
 *   • The farmer's own fields (crop + sowing date) → crop-stage reminders
 *   • The farmer's own soil report → soil pH advisory
 *
 * If an input is missing, that rule is skipped — no alert is ever invented.
 * Content is stored as { ruleKey, params }; the UI renders it localized
 * (en/kn/hi) via src/lib/alertText.ts.
 */

export type Severity = "info" | "warning" | "important" | "urgent";

export interface DerivedAlert {
  ruleKey: "rain" | "heat" | "market" | "stage" | "disease" | "soil_ph";
  /** Dedupe key: one alert per rule per (day / market-move / week / pH). */
  dayKey: string;
  severity: Severity;
  params: Record<string, string | number>;
  source: string;
}

export interface ForecastDay {
  date: string; // YYYY-MM-DD
  precipSum: number; // mm
  tMax: number; // °C
}

export interface RuleInput {
  today: string; // YYYY-MM-DD
  /** Open-Meteo daily forecast, index 0 = today. */
  daily?: ForecastDay[] | null;
  /** AGMARKNET trend (from getMandiPrices). */
  market?: {
    crop: string; // model crop id
    commodity: string;
    direction: "up" | "down" | "flat";
    pct: number;
    latestDate: string;
  } | null;
  /** The farmer's saved fields. */
  fields: {
    fieldName: string;
    crop: string | null; // model crop id (or free text)
    sowingDate: string | null; // YYYY-MM-DD
  }[];
  /** Farmer's latest soil report pH. */
  soilPh?: number | null;
}

/* ---------------- stage bands (generic, non-prescriptive) ----------------
 * Wide windows used only to NAME the current stage for the farmer. Advice is
 * qualitative monitoring guidance — never fertilizer doses. */
const STAGE_BANDS: { max: number; key: string }[] = [
  { max: 15, key: "germination" },
  { max: 40, key: "vegetative" },
  { max: 75, key: "flowering" },
  { max: 105, key: "fruiting" },
  { max: 9999, key: "maturity" },
];

export const stageForDay = (day: number): string =>
  STAGE_BANDS.find((b) => day <= b.max)!.key;

const dayDiff = (a: string, b: string): number =>
  Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);

export function deriveAlerts(input: RuleInput): DerivedAlert[] {
  const alerts: DerivedAlert[] = [];
  const daily = input.daily ?? [];

  /* --- 1. Rain expected (tomorrow / day after) ----------------------- */
  const wet = daily.slice(1, 3);
  const rainy = wet.find((d) => d.precipSum >= 5);
  if (rainy) {
    const heavy = rainy.precipSum >= 20;
    alerts.push({
      ruleKey: "rain",
      dayKey: `${rainy.date}:rain`,
      severity: rainy.precipSum >= 35 ? "urgent" : heavy ? "important" : "info",
      params: {
        mm: Math.round(rainy.precipSum),
        dayOffset: wet.indexOf(rainy) + 1,
        light: heavy ? 0 : 1,
      },
      source: "Open-Meteo forecast",
    });
  }

  /* --- 2. Heat stress (tomorrow, dry day) ----------------------------- */
  const tomorrow = daily[1];
  if (tomorrow && tomorrow.tMax >= 38 && tomorrow.precipSum < 5) {
    alerts.push({
      ruleKey: "heat",
      dayKey: `${tomorrow.date}:heat`,
      severity: tomorrow.tMax >= 41 ? "important" : "warning",
      params: { tmax: Math.round(tomorrow.tMax) },
      source: "Open-Meteo forecast",
    });
  }

  /* --- 3. Market movement (≥5% between latest and previous arrival) --- */
  if (input.market && Math.abs(input.market.pct) >= 5) {
    alerts.push({
      ruleKey: "market",
      dayKey: `${input.market.latestDate}:market:${input.market.direction}`,
      severity: "info",
      params: {
        crop: input.market.crop,
        commodity: input.market.commodity,
        pct: Math.abs(Math.round(input.market.pct * 10) / 10),
        direction: input.market.direction,
      },
      source: "AGMARKNET · data.gov.in",
    });
  }

  /* --- 4. Crop-stage reminders (from the farmer's own fields) --------- */
  for (const f of input.fields) {
    if (!f.crop || !f.sowingDate) continue;
    const day = dayDiff(input.today, f.sowingDate);
    if (!Number.isFinite(day) || day < 0 || day > 365) continue;
    const stage = stageForDay(day);
    const stageChanged = stage !== stageForDay(Math.max(0, day - 1));
    const weekly = day > 0 && day % 7 === 0;
    if (!stageChanged && !weekly) continue;
    alerts.push({
      ruleKey: "stage",
      dayKey: `${f.fieldName}:${stage}:${Math.floor(day / 7)}`,
      severity: "info",
      params: { crop: f.crop, day, stage, field: f.fieldName },
      source: "Farmer's saved crop calendar",
    });
  }

  /* --- 5. Disease-risk nudge after notable rain on a standing crop ---- */
  const rainedToday = (daily[0]?.precipSum ?? 0) >= 10;
  if (rainedToday) {
    for (const f of input.fields) {
      if (!f.crop) continue;
      alerts.push({
        ruleKey: "disease",
        dayKey: `${input.today}:disease:${f.fieldName}`,
        severity: "warning",
        params: { crop: f.crop, field: f.fieldName },
        source: "Open-Meteo observed precipitation",
      });
    }
  }

  /* --- 6. Soil pH outside the comfortable band (5.5–8.2) -------------- */
  const ph = input.soilPh;
  if (typeof ph === "number" && (ph < 5.5 || ph > 8.2)) {
    alerts.push({
      ruleKey: "soil_ph",
      dayKey: `ph:${ph}`,
      severity: ph < 5.0 || ph > 8.8 ? "important" : "warning",
      params: { ph },
      source: "Farmer's soil report",
    });
  }

  return alerts;
}

export const SEVERITY_ORDER: Record<Severity, number> = {
  urgent: 0,
  important: 1,
  warning: 2,
  info: 3,
};
