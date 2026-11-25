/**
 * KrishiMitra AI — Market Price Prediction API.
 * Mirrors the planned REST surface: GET /api/price-forecast.
 *
 * Data: AGMARKNET via data.gov.in (official Government of India feed).
 * Pipeline: fetch history → clean → weekly medians → Holt's linear trend →
 * 4-week forecast with an honest ±band. Real API data only — never fake
 * prices; insufficient history is reported, not estimated around.
 */
import { action, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { mutation } from "./_generated/server";
import {
  forecast,
  InsufficientDataError,
  MIN_DAYS,
  MAX_HORIZON_DAYS,
  type ForecastResult,
} from "./lib/priceModel";

const RESOURCE_ID = "35985678-0d79-46b4-9ed6-6f13308a1d24";

export type FcReason =
  | "missing_key"
  | "rate_limited"
  | "api_error"
  | "network"
  | "no_data"
  | "insufficient_data";

export interface LatestActual {
  date: string;
  modal: number;
  min: number;
  max: number;
}

export interface PriceForecastSuccess {
  result: Omit<ForecastResult, "series"> & {
    series: { date: string; modal: number }[];
    crop: string;
    commodity: string;
    state: string;
    market: string;
    district: string | null;
    latest: LatestActual | null;
  };
}

export type PriceForecastResponse =
  | ({ ok: true } & PriceForecastSuccess)
  | { ok: false; reason: FcReason; detail?: string };

export interface MarketHit {
  market: string;
  district: string | null;
  latestDate: string | null;
  records: number;
}

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
  return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
};

const toNum = (v: unknown): number => {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const cleanStr = (v: unknown): string => String(v ?? "").trim();

// ---------------------------------------------------------------------------
// AGMARKNET fetch + DB cache helpers
// ---------------------------------------------------------------------------

interface CleanRecord {
  date: string;
  market: string;
  district: string | null;
  modal: number;
  min: number;
  max: number;
}

interface Fetched {
  records: CleanRecord[];
  rateLimited: boolean;
  apiError: string | null;
}

/**
 * The sample data.gov.in key caps every response at 10 records, so history
 * needs offset pagination. `maxPages` bounds the number of requests.
 */
async function fetchAgmarknet(
  apiKey: string,
  commodity: string,
  state: string,
  market: string | undefined,
  maxPages = 15,
): Promise<Fetched> {
  // NOTE: data.gov.in AGMARKNET fields are capitalised (Commodity, State,
  // Market) — lowercase filter names are silently ignored. Sorting by
  // Arrival_Date desc returns the most recent arrivals first.
  const base =
    `https://api.data.gov.in/resource/${RESOURCE_ID}?api-key=${encodeURIComponent(apiKey)}` +
    "&format=json&limit=10" +
    `&filters%5BCommodity%5D=${encodeURIComponent(commodity)}` +
    `&filters%5BState%5D=${encodeURIComponent(state)}` +
    (market ? `&filters%5BMarket%5D=${encodeURIComponent(market)}` : "") +
    "&sort%5BArrival_Date%5D=desc";

  const all: CleanRecord[] = [];
  for (let page = 0; page < maxPages; page++) {
    try {
      const res = await fetch(`${base}&offset=${page * 10}`);
      if (res.status === 429) {
        return { records: all, rateLimited: true, apiError: null };
      }
      if (!res.ok) {
        return { records: all, rateLimited: false, apiError: `HTTP ${res.status}` };
      }
      const data = (await res.json()) as { records?: RawRecord[]; count?: number };
      const recs = data.records ?? [];
      for (const r of recs) {
        const date = parseDMY(r.Arrival_Date ?? r.arrival_date);
        const marketName = cleanStr(r.Market ?? r.market);
        const modal = toNum(r.Modal_Price ?? r.modal_price);
        if (date === null || modal <= 0 || marketName === "") continue;
        all.push({
          date,
          market: marketName,
          district: cleanStr(r.District ?? r.district) || null,
          modal,
          min: toNum(r.Min_Price ?? r.min_price),
          max: toNum(r.Max_Price ?? r.max_price),
        });
      }
      if (recs.length < 10) break; // last page reached
    } catch (e) {
      if (all.length === 0) {
        return {
          records: [],
          rateLimited: false,
          apiError: e instanceof Error ? e.message : "fetch failed",
        };
      }
      break; // keep what we already have from earlier pages
    }
  }
  return { records: all, rateLimited: false, apiError: null };
}

const cacheKey = (crop: string, state: string, market: string) =>
  `h|${crop}|${state}|${market}`;

export const getCachedHistory = query({
  args: { key: v.string() },
  handler: async (_ctx, { key }) => {
    const row = await _ctx.db
      .query("priceHistoryCache")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    return row ?? null;
  },
});

export const putCachedHistory = mutation({
  args: { key: v.string(), records: v.any(), fetchedAt: v.number() },
  handler: async (ctx, { key, records, fetchedAt }) => {
    const row = await ctx.db
      .query("priceHistoryCache")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (row) {
      await ctx.db.patch(row._id, { records, fetchedAt });
    } else {
      await ctx.db.insert("priceHistoryCache", { key, records, fetchedAt });
    }
  },
});

/** Freshness window: reuse cache for 6 h before refetching. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * List markets (with districts) available for a crop+state, from a state-wide
 * AGMARKNET fetch. Cached like history.
 */
export const listMarkets = action({
  args: { crop: v.string(), state: v.optional(v.string()) },
  handler: async (ctx, { crop, state }): Promise<
    | { ok: true; markets: MarketHit[] }
    | { ok: false; reason: FcReason; detail?: string }
  > => {
    const key = process.env.DATA_GOV_IN_API_KEY;
    if (!key) return { ok: false, reason: "missing_key" };
    const stateName = state ?? "Karnataka";
    const commodity = CROP_TO_COMMODITY[crop] ?? crop;
    const ck = cacheKey(crop, stateName, "*");

    let records: CleanRecord[];
    const cached = await ctx.runQuery(api.priceForecast.getCachedHistory, { key: ck });
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      records = cached.records as CleanRecord[];
    } else {
      const f = await fetchAgmarknet(key, commodity, stateName, undefined);
      if (f.rateLimited) return { ok: false, reason: "rate_limited" };
      if (f.apiError) return { ok: false, reason: "api_error", detail: f.apiError };
      records = f.records;
      if (records.length > 0) {
        await ctx.runMutation(api.priceForecast.putCachedHistory, {
          key: ck,
          records,
          fetchedAt: Date.now(),
        });
      }
    }

    // Group by market, keep latest date + record count.
    const byMarket = new Map<string, MarketHit>();
    for (const r of records) {
      const cur = byMarket.get(r.market);
      if (cur) {
        cur.records += 1;
        if (r.date > (cur.latestDate ?? "")) cur.latestDate = r.date;
        if (!cur.district && r.district) cur.district = r.district;
      } else {
        byMarket.set(r.market, {
          market: r.market,
          district: r.district,
          latestDate: r.date,
          records: 1,
        });
      }
    }
    const markets = [...byMarket.values()].sort((a, b) => b.records - a.records);
    return { ok: true, markets };
  },
});

/** Commodity names used by AGMARKNET, aligned with market.ts mapping. */
const CROP_TO_COMMODITY: Record<string, string> = {
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

/**
 * Price forecast for crop + state + market. Uses the 6 h cache; refetches
 * history otherwise; runs the Holt forecast; never fabricates prices.
 */
export const getPriceForecast = action({
  args: {
    crop: v.string(),
    state: v.optional(v.string()),
    market: v.string(),
    horizonDays: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { crop, state, market, horizonDays },
  ): Promise<PriceForecastResponse> => {
    const key = process.env.DATA_GOV_IN_API_KEY;
    if (!key) return { ok: false, reason: "missing_key" };
    const stateName = state ?? "Karnataka";
    const commodity = CROP_TO_COMMODITY[crop] ?? crop;
    const horizon = Math.min(MAX_HORIZON_DAYS, Math.max(1, horizonDays ?? 7));
    const ck = cacheKey(crop, stateName, market);

    // --- History: cache first, then live fetch ------------------------------
    let records: CleanRecord[] = [];
    let latest: LatestActual | null = null;
    const cached = await ctx.runQuery(api.priceForecast.getCachedHistory, { key: ck });
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      records = cached.records as CleanRecord[];
    } else {
      const f = await fetchAgmarknet(key, commodity, stateName, market);
      if (f.rateLimited) return { ok: false, reason: "rate_limited" };
      if (f.apiError) return { ok: false, reason: "api_error", detail: f.apiError };
      records = f.records;
      if (records.length > 0) {
        await ctx.runMutation(api.priceForecast.putCachedHistory, {
          key: ck,
          records,
          fetchedAt: Date.now(),
        });
      }
    }

    if (records.length === 0) {
      return { ok: false, reason: "no_data" };
    }

    // --- Latest actual record for the "current price" display ----------------
    const sortedAll = [...records].sort((a, b) => (a.date < b.date ? -1 : 1));
    const lastRec = sortedAll[sortedAll.length - 1]!;
    latest = {
      date: lastRec.date,
      modal: lastRec.modal,
      min: lastRec.min,
      max: lastRec.max,
    };

    // --- Forecast -------------------------------------------------------------
    try {
      const r = forecast(
        sortedAll.map((x) => ({ date: x.date, modal: x.modal, min: x.min, max: x.max })),
        horizon,
      );
      return {
        ok: true,
        result: {
          ...r,
          series: r.series.map((p) => ({ date: p.date, modal: p.modal })),
          crop,
          commodity,
          state: stateName,
          market,
          district: sortedAll[0]?.district ?? null,
          latest,
        },
      };
    } catch (e) {
      if (e instanceof InsufficientDataError) {
        return {
          ok: false,
          reason: "insufficient_data",
          detail: String(MIN_DAYS),
        };
      }
      return { ok: false, reason: "api_error", detail: "forecast_failed" };
    }
  },
});
