/**
 * KrishiMitra AI — Live "Soil & Rainfall" API.
 * Mirrors the planned REST surface: GET /api/soil-rain.
 *
 * Data policy (per project spec — never invent values):
 *  • Location      → GPS coords given by the farmer; reverse geocoded to
 *                    village/town + district via BigDataCloud (keyless).
 *  • Rainfall      → Open-Meteo ERA5 reanalysis archive (satellite-based,
 *                    the same source IMD-grade reanalysis products use):
 *                    seasonal rainfall to date + 1991–2020 climatology for
 *                    the same window → deviation %. Always real.
 *  • Soil N/P/K/pH → field-level live soil data does not exist as a public
 *                    API. We ONLY show numbers that come from:
 *                      a) a verified data.gov.in soil-health resource,
 *                         enabled by the officer setting BOTH
 *                         DATA_GOV_IN_API_KEY and DATA_GOV_IN_SOIL_RESOURCE_ID
 *                      b) real soil-test records seeded into the soilTests
 *                         table (KVK / Soil Health Card labs)
 *                    Otherwise we return status "unavailable" and the UI
 *                    shows the honest message, never estimates.
 *  • Cache         → the last successful result is stored in soilRainCache
 *                    and returned (clearly flagged) if the live fetch fails.
 */
import {
  action,
  internalMutation,
  mutation,
  query,
  type ActionCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SeasonKey = "kharif" | "rabi" | "zaid";

export interface SoilTestInfo {
  label: string;
  district: string | null;
  lat: number;
  lon: number;
  ph: number;
  n: number; // kg/ha
  p: number; // kg/ha
  k: number; // kg/ha
  testedOn: string; // YYYY-MM-DD or "—"
  source: string;
  distanceKm: number | null;
  // Extra parameters when the lab / dataset provides them:
  oc?: number | null; // organic carbon %
  ec?: number | null; // electrical conductivity dS/m
  s?: number | null; // sulphur ppm
}

export interface SoilRainData {
  place: {
    village: string | null;
    town: string | null;
    taluk: string | null;
    district: string | null;
    state: string | null;
    label: string;
  };
  rain: {
    seasonKey: SeasonKey;
    windowStart: string; // YYYY-MM-DD
    windowEnd: string; // YYYY-MM-DD (today)
    seasonalMm: number; // season-to-date rainfall
    normalMm: number | null; // 1991–2020 average for the same window
    deviationPct: number | null;
    recent7Mm: number; // last 7 days
  };
  soil:
    | {
        status: "unavailable";
        /** Out-of-trusted-range record, shown ONLY as a reference — never
         * applied to the farm (UI must not feed it to the engine). */
        reference: SoilTestInfo | null;
        reason: string;
      }
    | { status: "test"; data: SoilTestInfo }
    | { status: "live"; data: SoilTestInfo; source: string };
  /** Configurable trusted distance (km) used for this response. */
  trustRadiusKm: number;
  fetchedAt: number; // ms epoch
}

export type SoilRainResponse =
  | { ok: true; data: SoilRainData; fromCache: false }
  | { ok: false; reason: string; cached: SoilRainData | null };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Trusted distance for using a nearby soil-test record AS the farm's soil
 * measurement (env SOIL_TRUST_RADIUS_KM, default 50 km).
 *
 * Why 50 km: Karnataka's soil-testing labs / KVKs serve roughly taluk-to-
 * district areas; soils within ~50 km of a sampled plot usually share the
 * same soil series / agro-climatic zone, so the lab record is a usable
 * *farm-level proxy*. Beyond that, soil type can change completely (laterite
 * vs black cotton soil within a district), so the record is demoted to a
 * "Nearby Soil-Test Reference" and is NOT used in any farm-specific
 * calculation. The default is documented here so it is never a magic
 * number; operators can tighten/loosen it via the env var.
 */
const TRUST_RADIUS_KM = (() => {
  const raw = process.env.SOIL_TRUST_RADIUS_KM;
  const v = raw !== undefined ? Number(raw) : NaN;
  return Number.isFinite(v) && v > 0 ? v : 50;
})();

const haversineKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10;
};

/** Agricultural seasons in India / Karnataka. month1 is 1-based (Jan = 1). */
function seasonFor(month1: number): {
  key: SeasonKey;
  startMD: string; // "--MM-DD" start of season
  wrapsYear: boolean;
} {
  if (month1 >= 6 && month1 <= 10) {
    return { key: "kharif", startMD: "06-01", wrapsYear: false };
  }
  if (month1 === 11 || month1 === 12 || month1 <= 2) {
    return { key: "rabi", startMD: "11-01", wrapsYear: true };
  }
  return { key: "zaid", startMD: "03-01", wrapsYear: false };
}

const sumRange = (times: string[], vals: (number | null)[], from: string, to: string): number => {
  let sum = 0;
  for (let i = 0; i < times.length; i++) {
    const t = times[i]!;
    if (t >= from && t <= to) sum += vals[i] ?? 0;
  }
  return Math.round(sum * 10) / 10;
};

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Column-name match against unknown dataset schemas (used only for the
 *  optional data.gov.in soil resource, parsed defensively). */
const pickColumn = (rec: Record<string, unknown>, test: (k: string) => boolean): number | null => {
  const found = Object.keys(rec).find((k) => test(k.toLowerCase()));
  if (found === undefined) return null;
  const n = Number(String(rec[found] ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && String(rec[found] ?? "").trim() !== "" ? n : null;
};

const isPhKey = (k: string) => /(^|[^a-z])ph([^a-z]|$)/.test(k);

// ---------------------------------------------------------------------------
// Rainfall + place fetchers
// ---------------------------------------------------------------------------

interface ArchiveDaily {
  daily?: { time: string[]; precipitation_sum: (number | null)[] };
}

async function fetchArchiveDaily(
  lat: number,
  lon: number,
  start: string,
  end: string,
): Promise<ArchiveDaily["daily"]> {
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
    `&start_date=${start}&end_date=${end}&daily=precipitation_sum&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Rainfall archive error (${res.status})`);
  const data = (await res.json()) as ArchiveDaily;
  return data.daily ?? undefined;
}

const cleanAdm = (s: string | null | undefined): string | null => {
  const v = (s ?? "").replace(/\s+(taluk|taluka|district)$/i, "").trim();
  return v || null;
};

async function reverseGeocode(lat: number, lon: number) {
  // Primary: BigDataCloud (keyless, clean district levels).
  try {
    const r = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    );
    if (r.ok) {
      const d = (await r.json()) as {
        locality?: string;
        city?: string;
        principalSubdivision?: string;
        localityInfo?: { administrative?: { name?: string; adminLevel?: number }[] };
      };
      const admin = d.localityInfo?.administrative ?? [];
      // BigDataCloud admin levels for India: 5 ≈ district, 6 ≈ taluk/sub-district.
      const district = cleanAdm(admin.find((a) => a.adminLevel === 5)?.name);
      const taluk = cleanAdm(admin.find((a) => a.adminLevel === 6)?.name);
      if (d.locality || d.city || district) {
        return {
          village: d.locality ?? null,
          town: d.city ?? null,
          taluk,
          district,
          state: d.principalSubdivision ?? null,
        };
      }
    }
  } catch {
    // fall through to Photon
  }
  // Fallback: Photon (OpenStreetMap-based, keyless).
  try {
    const r = await fetch(
      `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`,
    );
    if (r.ok) {
      const d = (await r.json()) as {
        features?: { properties?: Record<string, string> }[];
      };
      const p = d.features?.[0]?.properties;
      if (p) {
        return {
          village: p.district ?? p.name ?? null,
          town: p.city ?? null,
          taluk: cleanAdm(p.county),
          district: cleanAdm(p.county) ?? p.city ?? null,
          state: p.state ?? null,
        };
      }
    }
  } catch {
    // both failed — caller handles null
  }
  return null;
}

// ---------------------------------------------------------------------------
// Optional data.gov.in soil lookup — only when the officer configures BOTH
// env vars. Parsed defensively; if anything is missing we report
// "dataset_unavailable" instead of guessing.
// ---------------------------------------------------------------------------

async function fetchGovSoil(
  district: string | null,
  state: string | null,
): Promise<SoilTestInfo | null> {
  const key = process.env.DATA_GOV_IN_API_KEY;
  const resourceId = process.env.DATA_GOV_IN_SOIL_RESOURCE_ID;
  if (!key || !resourceId) return null;

  try {
    const url =
      `https://api.data.gov.in/resource/${resourceId}?api-key=${encodeURIComponent(key)}` +
      "&format=json&limit=50" +
      (district ? `&filters%5Bdistrict%5D=${encodeURIComponent(district)}` : "") +
      (state ? `&filters%5Bstate%5D=${encodeURIComponent(state)}` : "");
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { records?: Record<string, unknown>[] };
    const records = data.records ?? [];

    for (const rec of records) {
      const ph = pickColumn(rec, isPhKey);
      const n = pickColumn(rec, (k) => k.includes("nitrogen") || k === "n");
      const p = pickColumn(rec, (k) => k.includes("phosph"));
      const k = pickColumn(rec, (kk) => kk.includes("potash") || kk.includes("potassium") || kk === "k");
      const locKey = Object.keys(rec).find((c) =>
        /district|taluk|block|village|location/.test(c.toLowerCase()),
      );
      const dateKey: string | undefined = Object.keys(rec).find((c) =>
        /date|sample/.test(c.toLowerCase()),
      );
      if (ph === null || n === null || p === null || k === null || !locKey) continue;
      return {
        label: String(rec[locKey] ?? "Government soil record").trim(),
        district: district ?? (state ?? null),
        lat: 0,
        lon: 0,
        ph,
        n,
        p,
        k,
        testedOn: dateKey !== undefined
          ? String(rec[dateKey] ?? "").trim() || "—"
          : "—",
        source: "data.gov.in (Government of India open data)",
        distanceKm: null, // dataset has no coordinates — location shown by name
        oc: pickColumn(rec, (kk) => kk.includes("organic")),
        ec: pickColumn(rec, (kk) => kk.includes("conductivity") || kk === "ec"),
        s: pickColumn(rec, (kk) => kk.includes("sulphur") || kk.includes("sulfur")),
      };
    }
  } catch {
    return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Cache + soil-test table access
// ---------------------------------------------------------------------------

const gridKey = (lat: number, lon: number) =>
  `${lat.toFixed(2)},${lon.toFixed(2)}`;

export const getCached = query({
  args: { key: v.string() },
  handler: async (_ctx, { key }) => {
    const row = await _ctx.db
      .query("soilRainCache")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    return row ?? null;
  },
});

export const putCached = mutation({
  args: { key: v.string(), data: v.any(), fetchedAt: v.number() },
  handler: async (ctx, { key, data, fetchedAt }) => {
    const row = await ctx.db
      .query("soilRainCache")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (row) {
      await ctx.db.patch(row._id, { data, fetchedAt });
    } else {
      await ctx.db.insert("soilRainCache", { key, data, fetchedAt });
    }
  },
});

export const listSoilTests = query({
  args: {},
  handler: async (ctx) => await ctx.db.query("soilTests").collect(),
});

/** Officers seed verified soil-test records via the Convex dashboard. */
export const addSoilTest = internalMutation({
  args: {
    label: v.string(),
    district: v.optional(v.string()),
    lat: v.number(),
    lon: v.number(),
    ph: v.number(),
    n: v.number(),
    p: v.number(),
    k: v.number(),
    testedOn: v.string(),
    source: v.string(),
    oc: v.optional(v.number()),
    ec: v.optional(v.number()),
    s: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("soilTests", args);
  },
});

// ---------------------------------------------------------------------------
// Main action
// ---------------------------------------------------------------------------

export const getSoilRain = action({
  args: { lat: v.number(), lon: v.number() },
  handler: async (ctx, { lat, lon }): Promise<SoilRainResponse> => {
    const key = gridKey(lat, lon);
    try {
      const data = await fetchSoilRain(ctx, lat, lon);
      await ctx.runMutation(api.soilRain.putCached, {
        key,
        data,
        fetchedAt: data.fetchedAt,
      });
      return { ok: true, data, fromCache: false };
    } catch (e) {
      const row = await ctx.runQuery(api.soilRain.getCached, { key });
      const cached = row ? (row.data as SoilRainData) : null;
      return {
        ok: false,
        reason: e instanceof Error ? e.message : "fetch_failed",
        cached,
      };
    }
  },
});

async function fetchSoilRain(
  ctx: ActionCtx,
  lat: number,
  lon: number,
): Promise<SoilRainData> {
  // --- Today in local time of the farm (last date of the seasonal series) ---
  const todayIso = new Date().toISOString().slice(0, 10);
  const year = Number(todayIso.slice(0, 4));
  const month1 = Number(todayIso.slice(5, 7));
  const season = seasonFor(month1);
  const todayMD = todayIso.slice(5, 10);

  // Season window start (handles rabi wrapping into the previous year).
  const startYear = season.wrapsYear && month1 <= 2 ? year - 1 : year;
  const windowStart = `${startYear}-${season.startMD}`;
  const windowEnd = todayIso;

  // --- Seasonal rainfall (real observations, ERA5 reanalysis archive) ------
  const seasonalDaily = await fetchArchiveDaily(lat, lon, windowStart, windowEnd);
  if (!seasonalDaily || seasonalDaily.time.length === 0) {
    throw new Error("Rainfall data unavailable for this location");
  }
  const times = seasonalDaily.time;
  const vals = seasonalDaily.precipitation_sum ?? [];
  const seasonalMm = sumRange(times, vals, windowStart, windowEnd);
  const recent7Mm = sumRange(
    times,
    vals,
    times[Math.max(0, times.length - 7)]!,
    windowEnd,
  );

  // --- Normal (1991–2020 climatology) for the SAME elapsed window ----------
  let normalMm: number | null = null;
  try {
    const clim = await fetchArchiveDaily(lat, lon, "1991-01-01", "2020-12-31");
    if (clim && clim.time.length > 0) {
      const cTimes = clim.time;
      const cVals = clim.precipitation_sum ?? [];
      let total = 0;
      let years = 0;
      for (let y = 1991; y <= 2020; y++) {
        const from = `${y}-${season.startMD}`;
        const to = season.wrapsYear ? `${y + 1}-${todayMD}` : `${y}-${todayMD}`;
        total += sumRange(cTimes, cVals, from, to);
        years++;
      }
      normalMm = years > 0 ? Math.round((total / years) * 10) / 10 : null;
    }
  } catch {
    normalMm = null;
  }

  const deviationPct =
    normalMm !== null && normalMm > 0
      ? Math.round(((seasonalMm - normalMm) / normalMm) * 1000) / 10
      : null;

  // --- Location -------------------------------------------------------------
  const place = (await reverseGeocode(lat, lon)) ?? {
    village: null,
    town: null,
    taluk: null,
    district: null,
    state: null,
  };
  // "Village, Taluk, District, State" — dedup repeated names, honest fallback
  // to coordinates when geocoding fails.
  const seen: string[] = [];
  for (const part of [
    place.village ?? place.town,
    place.taluk,
    place.district,
    place.state,
  ]) {
    if (part && !seen.includes(part)) seen.push(part);
  }
  const label =
    seen.join(", ") || `${lat.toFixed(3)}, ${lon.toFixed(3)}`;

  // --- Soil: only real, sourced values -------------------------------------
  const tests = (await ctx.runQuery(api.soilRain.listSoilTests, {})) as {
    label: string;
    district?: string;
    lat: number;
    lon: number;
    ph: number;
    n: number;
    p: number;
    k: number;
    testedOn: string;
    source: string;
    oc?: number;
    ec?: number;
    s?: number;
    _id: unknown;
  }[];

  const withDist = tests.map((t) => ({
    ...t,
    district: t.district ?? null,
    distanceKm: haversineKm(lat, lon, t.lat, t.lon),
  }));
  withDist.sort((a, b) => a.distanceKm - b.distanceKm);
  const nearest = withDist[0] ?? null;

  let soil: SoilRainData["soil"];
  const gov = await fetchGovSoil(place.district, place.state);
  if (gov) {
    soil = { status: "live", data: gov, source: gov.source };
  } else if (
    nearest &&
    nearest.distanceKm !== null &&
    nearest.distanceKm <= TRUST_RADIUS_KM
  ) {
    soil = { status: "test", data: nearest };
  } else {
    soil = {
      status: "unavailable",
      reference: nearest,
      reason: nearest
        ? "nearest_test_far"
        : "no_configured_source",
    };
  }

  return {
    place: { ...place, label },
    rain: {
      seasonKey: season.key,
      windowStart,
      windowEnd,
      seasonalMm,
      normalMm,
      deviationPct,
      recent7Mm,
    },
    soil,
    trustRadiusKm: TRUST_RADIUS_KM,
    fetchedAt: Date.now(),
  };
}
