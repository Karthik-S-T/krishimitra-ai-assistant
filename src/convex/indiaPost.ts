/**
 * KrishiMitra AI — Village lookup via the official India Post PIN API.
 *
 * POST https://api.postalpincode.in/pincode/{pin} returns the real post
 * offices for that pincode, each carrying Name (village/locality), Block
 * (taluk), District and State. We group unique office names per
 * State|District|Block (taluk) and cache them permanently in the
 * villageCache table — the API is called at most once per taluk.
 *
 * No village is ever invented: if the API fails or returns nothing, the
 * action reports that honestly and the UI offers GPS/map selection instead.
 */
import { action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getPincodesFor } from "../lib/indiaLocations";

export interface VillageLookup {
  ok: true;
  villages: string[];
  source: string;
}
export type VillageResponse =
  | VillageLookup
  | { ok: false; reason: "no_pins" | "api_error" | "no_offices" | "network" };

export const getVillagesInternal = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const row = await ctx.db
      .query("villageCache")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    return row?.villages ?? null;
  },
});

export const saveVillagesInternal = internalMutation({
  args: { key: v.string(), villages: v.array(v.string()) },
  handler: async (ctx, { key, villages }) => {
    await ctx.db.insert("villageCache", { key, villages, fetchedAt: Date.now() });
  },
});

export interface PlaceHit {
  name: string;
  district: string | null; // admin2
  state: string | null; // admin1
  lat: number;
  lon: number;
}

/**
 * Approximate coordinates for an administrative location via Open-Meteo
 * geocoding (Open-Meteo/GeoNames data). These are APPROXIMATE village/town
 * coordinates — never the exact farm boundary. The district (admin2) is
 * returned so the client can verify the hit matches the farmer's selection.
 */
export const geocodePlace = action({
  args: { name: v.string(), count: v.optional(v.number()) },
  handler: async (_ctx, { name, count }): Promise<PlaceHit[]> => {
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?count=${count ?? 5}&language=en&format=json&name=` +
          encodeURIComponent(name),
        { signal: AbortSignal.timeout(8000) },
      );
      if (!res.ok) return [];
      const data = (await res.json()) as {
        results?: {
          name: string;
          admin2?: string;
          admin1?: string;
          latitude: number;
          longitude: number;
          country?: string;
        }[];
      };
      return (data.results ?? [])
        .filter((r) => !r.country || r.country === "India")
        .map((r) => ({
          name: r.name,
          district: r.admin2 ?? null,
          state: r.admin1 ?? null,
          lat: r.latitude,
          lon: r.longitude,
        }));
    } catch {
      return [];
    }
  },
});

export const getVillages = action({
  args: {
    state: v.string(),
    district: v.string(),
    taluk: v.string(),
  },
  handler: async (ctx, { state, district, taluk }): Promise<VillageResponse> => {
    const key = `${state}|${district}|${taluk}`;

    // 1. Cache first (fast dropdowns, minimal load on the public API).
    const cached = await ctx.runQuery(internal.indiaPost.getVillagesInternal, { key });
    if (cached) return { ok: true, villages: cached, source: "cache" };

    // 2. Real pincodes for this taluk from the shipped LGD-mapped dataset.
    const pins = getPincodesFor(state, district, taluk);
    if (pins.length === 0) return { ok: false, reason: "no_pins" };

    // 3. Official India Post API per pincode (bounded — taluks have few).
    const villages = new Set<string>();
    for (const pin of pins.slice(0, 12)) {
      try {
        const res = await fetch(
          `https://api.postalpincode.in/pincode/${encodeURIComponent(pin)}`,
          { signal: AbortSignal.timeout(8000) },
        );
        if (!res.ok) continue;
        const data = (await res.json()) as {
          Status?: string;
          PostOffice?: { Name?: string; Block?: string; District?: string; State?: string }[];
        }[];
        for (const block of data ?? []) {
          for (const po of block.PostOffice ?? []) {
            if (!po.Name) continue;
            // Keep only offices that really sit in the selected taluk/district
            // (a pincode can straddle two blocks — respect the farmer's pick).
            if (po.Block && po.Block.toLowerCase() !== taluk.toLowerCase()) continue;
            if (po.District && po.District.toLowerCase() !== district.toLowerCase()) continue;
            villages.add(po.Name);
          }
        }
      } catch {
        // individual pincode failure — continue with the rest
      }
    }

    if (villages.size === 0) return { ok: false, reason: "no_offices" };

    const sorted = [...villages].sort((a, b) => a.localeCompare(b));
    await ctx.runMutation(internal.indiaPost.saveVillagesInternal, {
      key,
      villages: sorted,
    });
    return { ok: true, villages: sorted, source: "India Post PIN API" };
  },
});
