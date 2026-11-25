/**
 * KrishiMitra AI — Phase 2: Fertilizer Recommendation API.
 * Mirrors the planned REST surface: POST /api/fertilizer.
 *
 * Combines two grounded sources:
 *  1. Indicative state-extension fertilizer schedules (N : P2O5 : K2O kg/ha)
 *     for all 22 crops in the recommendation model.
 *  2. The crop dataset's per-crop soil N/P/K ranges (cropProfiles.ts) to
 *     interpret the farmer's Soil Health Card values (low / adequate / high).
 *
 * Also converts the dose into standard fertilizer products:
 *   DAP (18-46-0) covers P2O5, urea (46-0-0) covers remaining N,
 *   MOP (0-0-60) covers K2O.
 */
import { query } from "./_generated/server";
import { v } from "convex/values";
import { CROP_PROFILES, type FeatureKey } from "./data/cropProfiles";

/** Indicative state-extension schedules: N : P2O5 : K2O (kg/ha per season). */
const SCHEDULES: Record<string, { n: number; p: number; k: number }> = {
  rice: { n: 100, p: 50, k: 50 },
  maize: { n: 120, p: 60, k: 40 },
  chickpea: { n: 20, p: 40, k: 20 },
  kidneybeans: { n: 20, p: 40, k: 20 },
  pigeonpeas: { n: 20, p: 50, k: 20 },
  mothbeans: { n: 20, p: 40, k: 20 },
  mungbean: { n: 20, p: 40, k: 20 },
  blackgram: { n: 20, p: 40, k: 20 },
  lentil: { n: 20, p: 40, k: 20 },
  pomegranate: { n: 250, p: 100, k: 100 },
  banana: { n: 175, p: 55, k: 275 },
  mango: { n: 75, p: 25, k: 75 },
  grapes: { n: 200, p: 150, k: 200 },
  watermelon: { n: 60, p: 30, k: 30 },
  muskmelon: { n: 60, p: 30, k: 30 },
  apple: { n: 160, p: 100, k: 160 },
  orange: { n: 150, p: 50, k: 50 },
  papaya: { n: 200, p: 200, k: 400 },
  coconut: { n: 90, p: 55, k: 210 },
  cotton: { n: 120, p: 60, k: 60 },
  jute: { n: 80, p: 40, k: 40 },
  coffee: { n: 80, p: 50, k: 80 },
};

const HA_PER_ACRE = 0.404686;

export type SoilStatus = "low" | "ok" | "high";

export interface FertilizerResult {
  crop: string;
  /** Indicative schedule, kg/ha. */
  schedulePerHa: { n: number; p: number; k: number };
  /** Schedule converted to the farmer's area basis, kg/acre (1 decimal). */
  perAcre: { n: number; p: number; k: number };
  /** Soil Health Card interpretation vs the crop's dataset range. */
  status: Record<"N" | "P" | "K", SoilStatus>;
  /** Dataset typical ranges for the crop's soil N/P/K. */
  typicalRange: Record<"N" | "P" | "K", { min: number; max: number }>;
  /** Straight fertilizer products for the entered area (kg, 1 decimal). */
  products: {
    ureaKg: number;
    dapKg: number;
    mopKg: number;
    ureaBags: number;
    dapBags: number;
    mopBags: number;
  };
  /** Applied adjustment hints when a nutrient is far outside range. */
  hints: string[];
  source: string;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

export const recommendFertilizer = query({
  args: {
    crop: v.string(),
    N: v.number(),
    P: v.number(),
    K: v.number(),
    areaAcres: v.number(),
  },
  handler: (_ctx, { crop, N, P, K, areaAcres }): FertilizerResult => {
    const sched = SCHEDULES[crop];
    const profile = CROP_PROFILES[crop];
    if (!sched || !profile) throw new Error(`Unknown crop: ${crop}`);
    if (areaAcres <= 0) throw new Error("areaAcres must be positive");
    if (N < 0 || P < 0 || K < 0) throw new Error("N, P and K must be non-negative");

    const statusOf = (value: number, key: FeatureKey): SoilStatus => {
      const st = profile.stats[key];
      if (value < st.min) return "low";
      if (value > st.max) return "high";
      return "ok";
    };

    const perAcre = {
      n: round1(sched.n * HA_PER_ACRE),
      p: round1(sched.p * HA_PER_ACRE),
      k: round1(sched.k * HA_PER_ACRE),
    };

    // DAP supplies the full P2O5 requirement (46% P2O5, 18% N);
    // urea covers the remaining N (46% N); MOP covers K2O (60% K2O).
    const dapKg = perAcre.p / 0.46;
    const nFromDap = dapKg * 0.18;
    const ureaKg = Math.max(0, (perAcre.n - nFromDap) / 0.46);
    const mopKg = perAcre.k / 0.6;

    const hints: string[] = [];
    if (statusOf(N, "N") === "high") hints.push("N");
    if (statusOf(P, "P") === "high") hints.push("P");
    if (statusOf(K, "K") === "high") hints.push("K");

    return {
      crop,
      schedulePerHa: sched,
      perAcre,
      status: { N: statusOf(N, "N"), P: statusOf(P, "P"), K: statusOf(K, "K") },
      typicalRange: {
        N: { min: profile.stats.N.min, max: profile.stats.N.max },
        P: { min: profile.stats.P.min, max: profile.stats.P.max },
        K: { min: profile.stats.K.min, max: profile.stats.K.max },
      },
      products: {
        ureaKg: round1(ureaKg),
        dapKg: round1(dapKg),
        mopKg: round1(mopKg),
        ureaBags: Math.ceil(ureaKg / 50),
        dapBags: Math.ceil(dapKg / 50),
        mopBags: Math.ceil(mopKg / 50),
      },
      hints,
      source: "Indicative state-extension schedules + crop dataset soil ranges",
    };
  },
});
