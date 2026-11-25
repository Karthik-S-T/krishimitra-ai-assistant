/**
 * KrishiMitra AI — Phase 6 real satellite monitoring.
 *
 * Real data only — Sentinel-2 L2A imagery via:
 *   • Earth Search STAC API (element84, public, no key):
 *       https://earth-search.aws.element84.com/v1/search
 *   • TiTiler (devseed public instance, no key):
 *       POST https://titiler.xyz/stac/statistics  → polygon-clipped band
 *       statistics (FeatureCollection body, assets + expression in query)
 *       GET  https://titiler.xyz/stac/bbox/{minLng},{minLat},{maxLng},{maxLat}.png
 *       → farm-area PNG for RGB / NDVI / EVI / NDWI layers
 *
 * Band formulation (documented per spec — asset_as_band order, b1 = first):
 *   NDVI = (B08 − B04) / (B08 + B04)                      [NIR − Red]
 *   EVI  = 2.5·(B08 − B04) / (B08 + 6·B04 − 7.5·B02 + 1)  [Sentinel-2 coeffs]
 *   NDWI = (B03 − B08) / (B03 + B08)                      [McFeeters 1996]
 *
 * Workflow per spec: boundary → STAC search → cloud filter → newest scenes →
 * statistics computed over the farm polygon only → indices + trend.
 * No values are ever invented: provider failures return honest error states.
 * Results are cached per boundary+params (satelliteCache, 6 h TTL).
 */
import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const STAC_URL = "https://earth-search.aws.element84.com/v1/search";
const TITILER = "https://titiler.xyz";

export interface BandStats {
  mean: number;
  min: number;
  max: number;
  stdev: number;
}

export interface IndexStats {
  stats: BandStats | null;
  formula: string;
  bands: string;
}

export interface SatelliteObservation {
  date: string;
  cloudPct: number;
  ndvi: number | null;
  evi: number | null;
  ndwi: number | null;
}

export interface SatelliteResult {
  ok: true;
  scene: {
    date: string;
    cloudPct: number;
    satellite: string;
    tileId: string;
  };
  indices: {
    ndvi: IndexStats;
    evi: IndexStats;
    ndwi: IndexStats;
  };
  layers: {
    rgb: string;
    ndvi: string;
    evi: string;
    ndwi: string;
  };
  bounds: { south: number; west: number; north: number; east: number };
  boundary: number[][];
  areaSqM: number;
  observations: SatelliteObservation[]; // chronological, NDVI per scene
  trendNote: "sufficient" | "insufficient";
  fetchedAt: number;
  source: string;
}

export type SatelliteResponse =
  | SatelliteResult
  | { ok: false; reason: "no_imagery" | "provider_error" | "bad_boundary"; detail?: string };

// ---------------------------------------------------------------------------

interface StacItem {
  id: string;
  properties: Record<string, unknown>;
  bbox: number[];
}

const enc = (s: string) => encodeURIComponent(s);

async function searchScenes(
  boundary: number[][],
  days: number,
  maxCloud: number,
  limit: number,
): Promise<StacItem[]> {
  const lats = boundary.map((p) => p[0]!);
  const lngs = boundary.map((p) => p[1]!);
  const bbox = [
    Math.min(...lngs).toFixed(4),
    Math.min(...lats).toFixed(4),
    Math.max(...lngs).toFixed(4),
    Math.max(...lats).toFixed(4),
  ].join(",");
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 3600 * 1000);
  const body = {
    collections: ["sentinel-2-l2a"],
    intersects: {
      type: "Polygon",
      coordinates: [
        [...boundary.map((p) => [p[1], p[0]]), [boundary[0]![1], boundary[0]![0]]],
      ],
    },
    datetime: `${start.toISOString().slice(0, 10)}T00:00:00Z/${end.toISOString().slice(0, 10)}T23:59:59Z`,
    query: { "eo:cloud_cover": { lt: maxCloud } },
    sortby: [{ field: "properties.datetime", direction: "desc" }],
    limit,
  };
  const res = await fetch(STAC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`STAC search failed (${res.status})`);
  const d = (await res.json()) as { features?: StacItem[] };
  return d.features ?? [];
}

function itemUrl(item: StacItem): string {
  return `https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items/${item.id}`;
}

function featureCollection(boundary: number[][]) {
  return JSON.stringify({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [...boundary.map((p) => [p[1], p[0]]), [boundary[0]![1], boundary[0]![0]]],
          ],
        },
      },
    ],
  });
}

/**
 * Polygon-clipped index statistics via TiTiler /stac/statistics.
 * b1/b2/b3 refer to the assets in the given order (asset_as_band).
 * Returns null when the provider cannot compute stats — never a guess.
 */
async function indexStats(
  item: StacItem,
  assets: string[],
  expression: string,
  boundary: number[][],
): Promise<BandStats | null> {
  const url =
    `${TITILER}/stac/statistics?url=${enc(itemUrl(item))}` +
    assets.map((a) => `&assets=${a}`).join("") +
    `&expression=${enc(expression)}` +
    `&asset_as_band=true`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/geo+json" },
      body: featureCollection(boundary),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as {
      features?: { properties?: { statistics?: Record<string, {
        min?: number; max?: number; mean?: number; std?: number;
      }> } }[];
    };
    const stats = d.features?.[0]?.properties?.statistics ?? {};
    const key = Object.keys(stats)[0];
    if (!key || typeof stats[key]?.mean !== "number") return null;
    const s = stats[key]!;
    return {
      mean: Math.round(s.mean! * 1000) / 1000,
      min: Math.round((s.min ?? 0) * 1000) / 1000,
      max: Math.round((s.max ?? 0) * 1000) / 1000,
      stdev: Math.round((s.std ?? 0) * 1000) / 1000,
    };
  } catch {
    return null;
  }
}

/** Farm-area PNG layer URL (RGB true colour or a coloured index). */
function layerUrl(item: StacItem, opts: {
  assets: string[];
  expression?: string;
  rescale?: string;
  colormap?: string;
  bounds: { south: number; west: number; north: number; east: number };
}): string {
  const b = opts.bounds;
  let url =
    `${TITILER}/stac/bbox/${b.west.toFixed(5)},${b.south.toFixed(5)},${b.east.toFixed(5)},${b.north.toFixed(5)}.png` +
    `?url=${enc(itemUrl(item))}` +
    opts.assets.map((a) => `&assets=${a}`).join("") +
    `&max_size=768`;
  if (opts.expression) url += `&expression=${enc(opts.expression)}&asset_as_band=true`;
  if (opts.rescale) url += `&rescale=${enc(opts.rescale)}`;
  if (opts.colormap) url += `&colormaps=${opts.colormap}`;
  return url;
}

function polygonAreaSqM(boundary: number[][]): number {
  const ring: number[][] = [...boundary.map((p) => [p[1]!, p[0]!])];
  ring.push([boundary[0]![1]!, boundary[0]![0]!]);
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[i + 1]!;
    total +=
      (((x2 - x1) * Math.PI) / 180) *
      (2 + Math.sin((y1 * Math.PI) / 180) + Math.sin((y2 * Math.PI) / 180));
  }
  return Math.abs((total * 6378137 * 6378137) / 2);
}

export const getSatelliteAnalysis = action({
  args: {
    boundary: v.array(v.array(v.number())), // [[lat, lng], ...]
    days: v.optional(v.number()), // search window (default 120)
    maxCloud: v.optional(v.number()), // default 20
  },
  handler: async (ctx, { boundary, days = 120, maxCloud = 20 }): Promise<SatelliteResponse> => {
    if (boundary.length < 3) return { ok: false, reason: "bad_boundary" };

    const key = `s2|${boundary.map((p) => p.map((x) => x.toFixed(4)).join(",")).join(";")}|${days}|${maxCloud}`;
    try {
      const cached = (await ctx.runQuery(api.satellite.getCached, { key })) as {
        data: SatelliteResult;
        fetchedAt: number;
      } | null;
      if (cached && Date.now() - cached.fetchedAt < 6 * 3600 * 1000) {
        return cached.data;
      }
    } catch {
      // cache unavailable — continue with the live fetch
    }

    try {
      const items = await searchScenes(boundary, days, maxCloud, 10);
      if (items.length === 0) return { ok: false, reason: "no_imagery" };

      const lats = boundary.map((p) => p[0]!);
      const lngs = boundary.map((p) => p[1]!);
      const bounds = {
        south: Math.min(...lats),
        west: Math.min(...lngs),
        north: Math.max(...lats),
        east: Math.max(...lngs),
      };
      const areaSqM = polygonAreaSqM(boundary);

      const observations: SatelliteObservation[] = [];
      let chosen: SatelliteResult | null = null;

      for (const item of items.slice(0, 5)) {
        const cloud = typeof item.properties["eo:cloud_cover"] === "number"
          ? (item.properties["eo:cloud_cover"] as number)
          : 100;
        const date = String(item.properties.datetime ?? "").slice(0, 10);

        // Full 3-index stats for the newest viable scene; NDVI-only for the
        // rest (keeps provider load and latency reasonable).
        const need: boolean = chosen === null;
        const ndvi: BandStats | null = await indexStats(item, ["nir", "red"], "(b1-b2)/(b1+b2)", boundary);
        let evi: BandStats | null = null;
        let ndwi: BandStats | null = null;
        if (need && ndvi) {
          // L2A assets store DN (reflectance × 10000). NDVI/NDWI are ratio
          // indices so the scale cancels, but EVI's +1 soil term needs true
          // reflectance: 2.5·(N−R)/(N+6R−7.5B+10000) in DN space.
          [evi, ndwi] = await Promise.all([
            indexStats(item, ["nir", "red", "blue"], "2.5*(b1-b2)/(b1+6*b2-7.5*b3+10000)", boundary),
            indexStats(item, ["green", "nir"], "(b1-b2)/(b1+b2)", boundary),
          ]);
        }

        if (ndvi || evi || ndwi) {
          observations.push({ date, cloudPct: cloud, ndvi: ndvi?.mean ?? null, evi: evi?.mean ?? null, ndwi: ndwi?.mean ?? null });
        }
        if (!chosen && ndvi && evi && ndwi) {
          chosen = {
            ok: true,
            scene: {
              date,
              cloudPct: Math.round(cloud * 10) / 10,
              satellite: "Sentinel-2 L2A (Copernicus / AWS Open Data)",
              tileId: item.id,
            },
            indices: {
              ndvi: {
                stats: ndvi,
                formula: "NDVI = (NIR − Red) / (NIR + Red)",
                bands: "Sentinel-2 B08 (NIR) & B04 (Red)",
              },
              evi: {
                stats: evi,
                formula: "EVI = 2.5·(NIR − Red) / (NIR + 6·Red − 7.5·Blue + 1)",
                bands: "Sentinel-2 B08, B04, B02",
              },
              ndwi: {
                stats: ndwi,
                formula: "NDWI = (Green − NIR) / (Green + NIR) — McFeeters (1996)",
                bands: "Sentinel-2 B03 (Green) & B08 (NIR)",
              },
            },
            layers: {
              rgb: layerUrl(item, { assets: ["red", "green", "blue"], bounds }),
              ndvi: layerUrl(item, { assets: ["nir", "red"], expression: "(b1-b2)/(b1+b2)", rescale: "-1,1", colormap: "rdylgn", bounds }),
              evi: layerUrl(item, { assets: ["nir", "red", "blue"], expression: "2.5*(b1-b2)/(b1+6*b2-7.5*b3+10000)", rescale: "0,1", colormap: "rdylgn", bounds }),
              ndwi: layerUrl(item, { assets: ["green", "nir"], expression: "(b1-b2)/(b1+b2)", rescale: "-1,1", colormap: "blues", bounds }),
            },
            bounds,
            boundary,
            areaSqM,
            observations: [],
            trendNote: "insufficient",
            fetchedAt: Date.now(),
            source: "Copernicus Sentinel-2 L2A via Earth Search STAC + TiTiler statistics",
          };
        }
      }

      if (!chosen) {
        return { ok: false, reason: "provider_error", detail: "scenes found but statistics failed" };
      }

      const obs = observations
        .filter((o) => o.ndvi !== null)
        .sort((a, b) => a.date.localeCompare(b.date));
      chosen.observations = obs;
      chosen.trendNote = obs.length >= 2 ? "sufficient" : "insufficient";

      await ctx.runMutation(api.satellite.putCached, {
        key,
        data: chosen,
        fetchedAt: chosen.fetchedAt,
      });
      return chosen;
    } catch (e) {
      return {
        ok: false,
        reason: "provider_error",
        detail: e instanceof Error ? e.message : "unknown",
      };
    }
  },
});

// ---- cache ----------------------------------------------------------------

export const getCached = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    return await ctx.db
      .query("satelliteCache")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
  },
});

export const putCached = mutation({
  args: { key: v.string(), data: v.any(), fetchedAt: v.number() },
  handler: async (ctx, { key, data, fetchedAt }) => {
    const row = await ctx.db
      .query("satelliteCache")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (row) await ctx.db.patch(row._id, { data, fetchedAt });
    else await ctx.db.insert("satelliteCache", { key, data, fetchedAt });
  },
});
