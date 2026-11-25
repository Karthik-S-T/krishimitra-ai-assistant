/**
 * KrishiMitra AI — Phase 5: Potential Revenue Estimation API.
 * Mirrors the planned REST surface: POST /api/revenue.
 *
 * Revenue = expected production × expected sale price, always returned as a
 * low/typical/high band and always labelled an estimate — never guaranteed
 * income. Production reuses the Phase 3 yield table so both modules stay
 * consistent.
 */
import { query } from "./_generated/server";
import { v } from "convex/values";
import { YIELD_AVERAGES } from "./yield";

const HA_PER_ACRE = 0.404686;
const KG_PER_QUINTAL = 100;

export interface RevenueResult {
  crop: string;
  areaAcres: number;
  hectares: number;
  pricePerQuintal: number;
  /** Expected production, quintals. */
  productionQuintals: { min: number; typ: number; max: number };
  /** Revenue band, ₹. */
  revenue: { min: number; typ: number; max: number };
  disclaimer: string;
}

export const estimateRevenue = query({
  args: {
    crop: v.string(),
    areaAcres: v.number(),
    pricePerQuintal: v.number(),
  },
  handler: (_ctx, { crop, areaAcres, pricePerQuintal }): RevenueResult => {
    const y = YIELD_AVERAGES[crop];
    if (!y) throw new Error(`Unknown crop: ${crop}`);
    if (areaAcres <= 0) throw new Error("areaAcres must be positive");
    if (pricePerQuintal <= 0) throw new Error("pricePerQuintal must be positive");

    const hectares = areaAcres * HA_PER_ACRE;
    const q = (kgPerHa: number) =>
      Math.round((kgPerHa * hectares) / KG_PER_QUINTAL);

    const production = {
      min: q(y.min),
      typ: q(y.avg),
      max: q(y.max),
    };

    return {
      crop,
      areaAcres,
      hectares: Math.round(hectares * 100) / 100,
      pricePerQuintal,
      productionQuintals: production,
      revenue: {
        min: production.min * pricePerQuintal,
        typ: production.typ * pricePerQuintal,
        max: production.max * pricePerQuintal,
      },
      disclaimer:
        "Estimate only — based on national-average yields and your expected price. Never guaranteed income.",
    };
  },
});
