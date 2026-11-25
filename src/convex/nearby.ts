/**
 * KrishiMitra AI — Nearby Agriculture Services (real OpenStreetMap data).
 *
 * Queries the community-run Overpass API against OpenStreetMap. Results are
 * real mapped businesses/facilities with their actual tags (name, phone,
 * hours, address) — nothing is invented. If OSM has no data for a category
 * in the area, that category reports zero results honestly.
 */
import { action } from "./_generated/server";
import { v } from "convex/values";

export interface NearbyPlace {
  id: number;
  name: string;
  category: string; // category key from CATEGORIES below
  lat: number;
  lon: number;
  distanceKm: number;
  address: string | null;
  phone: string | null;
  openingHours: string | null;
  tags: Record<string, string>;
}

export type NearbyResponse =
  | { ok: true; places: NearbyPlace[]; source: string; at: number }
  | { ok: false; reason: "network" | "api_error" | "bad_input"; detail?: string };

/** OSM tag filters per category (agriculture-relevant POIs). */
const CATEGORY_QUERIES: Record<string, string> = {
  seeds: `nwr["shop"="agricultural"]["name"];`,
  fertilizer: `nwr["shop"="agrarian"]["name"];`,
  soil_lab: `nwr["amenity"="laboratory"]["name"];nwr["healthcare"="laboratory"]["name"];nwr["laboratory"="soil"]["name"];`,
  agrovet: `nwr["shop"="farm"]["name"];nwr["shop"="garden_centre"]["name"];`,
  equipment: `nwr["shop"="trade"]["name"]["trade"~"agricultural|farm|machinery",i];`,
  apmc: `nwr["amenity"="marketplace"]["name"];`,
  buyers: `nwr["shop"="wholesale"]["name"];nwr["office"="agricultural"]["name"];`,
  bank: `nwr["amenity"="bank"]["name"];`,
  kvk: `nwr["amenity"="research_institute"]["name"];`,
};

const ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

export const CATEGORY_KEYS = Object.keys(CATEGORY_QUERIES);

export const getNearbyServices = action({
  args: { lat: v.number(), lon: v.number(), radiusKm: v.optional(v.number()) },
  handler: async (_ctx, { lat, lon, radiusKm }): Promise<NearbyResponse> => {
    const radius = Math.min(Math.max(radiusKm ?? 25, 2), 50) * 1000;

    const around = `(around:${radius},${lat},${lon})`;
    const q =
      `[out:json][timeout:25];(` +
      Object.values(CATEGORY_QUERIES)
        .map((tpl) => tpl.replace(/nwr\[/g, `nwr${around}[`))
        .join("") +
      `);out center 120;`;

    let lastErr: { reason: "network" | "api_error"; detail?: string } = {
      reason: "network",
    };
    for (const endpoint of ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(q)}`,
          // Overpass can be slow at peak times — fail over quickly instead of
          // leaving the farmer staring at a spinner (12s per endpoint).
          signal: AbortSignal.timeout(12_000),
        });
        if (!res.ok) {
          lastErr = { reason: "api_error", detail: `HTTP ${res.status}` };
          continue; // try the fallback endpoint
        }
        const data = (await res.json()) as {
          elements?: {
            type: string;
            id: number;
            lat?: number;
            lon?: number;
            center?: { lat: number; lon: number };
            tags?: Record<string, string>;
          }[];
          remark?: string;
        };
        if (data.remark && (data.elements ?? []).length === 0) {
          // Overpass runtime error (e.g. timeout) — try the fallback endpoint.
          lastErr = { reason: "api_error", detail: data.remark };
          continue;
        }

        const R = 6371;
        const hav = (aLat: number, aLon: number, bLat: number, bLon: number) => {
          const dLat = ((bLat - aLat) * Math.PI) / 180;
          const dLon = ((bLon - aLon) * Math.PI) / 180;
          const s =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((aLat * Math.PI) / 180) *
              Math.cos((bLat * Math.PI) / 180) *
              Math.sin(dLon / 2) ** 2;
          return 2 * R * Math.asin(Math.sqrt(s));
        };

        const classify = (tags: Record<string, string>): string | null => {
          const shop = tags.shop ?? "";
          const amenity = tags.amenity ?? "";
          const healthcare = tags.healthcare ?? "";
          const office = tags.office ?? "";
          if (amenity === "bank") return "bank";
          if (amenity === "research_institute") return "kvk";
          if (
            amenity === "laboratory" ||
            healthcare === "laboratory" ||
            tags.laboratory === "soil"
          ) return "soil_lab";
          if (amenity === "marketplace") return "apmc";
          if (shop === "wholesale" || office === "agricultural") return "buyers";
          if (shop === "agricultural") return "seeds";
          if (shop === "agrarian") return "fertilizer";
          if (shop === "farm" || shop === "garden_centre") return "agrovet";
          if (shop === "trade") return "equipment";
          return null;
        };

        const raw = (data.elements ?? []).flatMap<NearbyPlace>((el) => {
          const plat = el.lat ?? el.center?.lat;
          const plon = el.lon ?? el.center?.lon;
          if (plat === undefined || plon === undefined) return [];
          const tags = el.tags ?? {};
          const category = classify(tags);
          if (!category || !tags.name) return [];
          const addressBits = [
            tags["addr:street"], tags["addr:suburb"], tags["addr:village"],
            tags["addr:town"], tags["addr:city"], tags["addr:postcode"],
          ].filter(Boolean) as string[];
          const p: NearbyPlace = {
            id: el.id,
            name: tags.name,
            category,
            lat: plat,
            lon: plon,
            distanceKm: Math.round(hav(lat, lon, plat, plon) * 10) / 10,
            address: addressBits.length ? addressBits.join(", ") : null,
            phone: tags.phone ?? tags["contact:phone"] ?? null,
            openingHours: tags.opening_hours ?? null,
            tags,
          };
          return [p];
        });

        const places: NearbyPlace[] = raw
          .sort((a, b) => a.distanceKm - b.distanceKm)
          .slice(0, 40);

        return {
          ok: true,
          places,
          source: "OpenStreetMap contributors (Overpass API)",
          at: Date.now(),
        };
      } catch (e) {
        lastErr = {
          reason: "network",
          detail: e instanceof Error ? e.message : "fetch failed",
        };
      }
    }
    return { ok: false, ...lastErr };
  },
});
