/**
 * KrishiMitra AI — Phase 4: Market Price / Trend Analysis API.
 * Mirrors the planned REST surface: GET /api/market.
 *
 * Source: AGMARKNET "Current Daily Price of Various Commodities from Various
 * Markets (Mandi)" on data.gov.in — the official government price feed named
 * in the project spec. Requires a free data.gov.in API key:
 *   1. Register at https://data.gov.in and create an API key.
 *   2. Add it as DATA_GOV_IN_API_KEY in the project's Keys tab.
 * Without a key the action reports `available: false` (never fake data).
 */
import { action } from "./_generated/server";
import { v } from "convex/values";

const RESOURCE_ID = "35985678-0d79-46b4-9ed6-6f13308a1d24";

/** Model crop id → AGMARKNET commodity name (best official match). */
const COMMODITY_MAP: Record<string, string> = {
  rice: "Rice",
  maize: "Maize",
  chickpea: "Chana",
  kidneybeans: "Rajma",
  pigeonpeas: "Arhar",
  mothbeans: "Moth",
  mungbean: "Moong",
  blackgram: "Urad",
  lentil: "Masur",
  pomegranate: "Pomegranate",
  banana: "Banana",
  mango: "Mango",
  grapes: "Grapes",
  watermelon: "Water Melon",
  muskmelon: "Muskmelon",
  apple: "Apple",
  orange: "Orange",
  papaya: "Papaya",
  coconut: "Coconut",
  cotton: "Kapas",
  jute: "Jute",
  coffee: "Coffee",
};

export interface MandiResult {
  available: true;
  commodity: string;
  state: string;
  /** Latest arrival date found, YYYY-MM-DD. */
  latestDate: string;
  /** ₹/quintal across the latest arrivals. */
  price: { min: number; avg: number; max: number };
  markets: { market: string; district: string | null; modal: number }[];
  trend: {
    direction: "up" | "down" | "flat";
    pct: number | null;
    prevDate: string | null;
  } | null;
}

export type MandiResponse =
  | MandiResult
  | {
      available: false;
      reason:
        | "missing_key"
        | "no_data"
        | "api_error"
        | "network"
        | "rate_limited";
      commodity?: string;
      detail?: string;
    };

interface RawRecord {
  // data.gov.in returns capitalised field names (e.g. "Arrival_Date").
  Arrival_Date?: unknown;
  Market?: unknown;
  District?: unknown;
  Min_Price?: unknown;
  Max_Price?: unknown;
  Modal_Price?: unknown;
  // Defensive: tolerate lowercase variants too.
  arrival_date?: unknown;
  market?: unknown;
  district?: unknown;
  min_price?: unknown;
  max_price?: unknown;
  modal_price?: unknown;
}

const parseDMY = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const dd = m[1]!.padStart(2, "0");
  const mm = m[2]!.padStart(2, "0");
  return `${m[3]}-${mm}-${dd}`;
};

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const mean = (xs: number[]) =>
  xs.length === 0 ? 0 : Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

export const getMandiPrices = action({
  args: {
    crop: v.string(),
    state: v.optional(v.string()),
  },
  handler: async (_ctx, { crop, state }): Promise<MandiResponse> => {
    const key = process.env.DATA_GOV_IN_API_KEY;
    if (!key) return { available: false, reason: "missing_key" };

    const commodity = COMMODITY_MAP[crop] ?? crop;
    const stateFilter = state ?? "Karnataka";
    // data.gov.in AGMARKNET fields are capitalised (Commodity, State) —
    // lowercase filter names are silently ignored. Sort desc = latest first.
    const url =
      `https://api.data.gov.in/resource/${RESOURCE_ID}?api-key=${encodeURIComponent(key)}` +
      "&format=json&limit=1000" +
      `&filters%5BCommodity%5D=${encodeURIComponent(commodity)}` +
      `&filters%5BState%5D=${encodeURIComponent(stateFilter)}` +
      "&sort%5BArrival_Date%5D=desc";

    let records: RawRecord[];
    try {
      const res = await fetch(url);
      if (!res.ok) {
        // data.gov.in returns 429 when the per-key request quota is exceeded
        // (common with the widely-shared sample key). Surface it distinctly.
        if (res.status === 429) {
          return { available: false, reason: "rate_limited" };
        }
        return {
          available: false,
          reason: "api_error",
          detail: `HTTP ${res.status}`,
        };
      }
      const data = (await res.json()) as { records?: RawRecord[] };
      records = data.records ?? [];
    } catch (e) {
      return {
        available: false,
        reason: "network",
        detail: e instanceof Error ? e.message : "fetch failed",
      };
    }

    const parsed = records
      .map((r) => ({
        date: parseDMY(r.Arrival_Date ?? r.arrival_date),
        market: String(r.Market ?? r.market ?? "").trim(),
        district: String(r.District ?? r.district ?? "").trim() || null,
        modal: toNum(r.Modal_Price ?? r.modal_price),
      }))
      .filter(
        (r): r is { date: string; market: string; district: string | null; modal: number } =>
          r.date !== null && r.modal > 0 && r.market !== "",
      )
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    if (parsed.length === 0) {
      return { available: false, reason: "no_data", commodity };
    }

    const latestDate = parsed[0]!.date;
    const latest = parsed.filter((r) => r.date === latestDate);
    const latestModals = latest.map((r) => r.modal);

    // 7-day trend: compare with the previous arrival date available.
    const distinctDates = [...new Set(parsed.map((r) => r.date))];
    const prevDate = distinctDates.length > 1 ? distinctDates[1]! : null;
    let trend: MandiResult["trend"] = null;
    if (prevDate) {
      const prevAvg = mean(parsed.filter((r) => r.date === prevDate).map((r) => r.modal));
      const avg = mean(latestModals);
      if (prevAvg > 0 && avg > 0) {
        const pct = Math.round(((avg - prevAvg) / prevAvg) * 1000) / 10;
        trend = {
          direction: pct > 1 ? "up" : pct < -1 ? "down" : "flat",
          pct,
          prevDate,
        };
      }
    }

    return {
      available: true,
      commodity,
      state: stateFilter,
      latestDate,
      price: {
        min: Math.min(...latestModals),
        avg: mean(latestModals),
        max: Math.max(...latestModals),
      },
      markets: [...latest]
        .sort((a, b) => b.modal - a.modal)
        .slice(0, 5)
        .map((r) => ({ market: r.market, district: r.district, modal: r.modal })),
      trend,
    };
  },
});
