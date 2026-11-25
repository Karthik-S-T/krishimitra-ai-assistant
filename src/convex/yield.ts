/**
 * KrishiMitra AI — Phase 3: Yield Prediction / Production Planning API.
 * Mirrors the planned REST surface: POST /api/yield.
 *
 * Grounded baseline: indicative national-average yields for each of the 22
 * model crops (min / typical / max). When the farmer has a crop
 * recommendation, the typical estimate is adjusted by how well the field
 * conditions match the crop's ideal profile (the model's top probability).
 * The dedicated district-level regression model can refine these numbers
 * later without changing this API surface.
 */
import { query } from "./_generated/server";
import { v } from "convex/values";

/** Indicative national-average yields, kg/ha: (min, typical, max). */
export const YIELD_AVERAGES: Record<
  string,
  { min: number; avg: number; max: number }
> = {
  rice: { min: 2500, avg: 4200, max: 6000 },
  maize: { min: 2000, avg: 3300, max: 5500 },
  chickpea: { min: 800, avg: 1150, max: 1800 },
  kidneybeans: { min: 600, avg: 900, max: 1500 },
  pigeonpeas: { min: 700, avg: 1050, max: 1800 },
  mothbeans: { min: 300, avg: 500, max: 900 },
  mungbean: { min: 400, avg: 600, max: 1200 },
  blackgram: { min: 500, avg: 750, max: 1300 },
  lentil: { min: 800, avg: 1100, max: 1800 },
  pomegranate: { min: 12000, avg: 22000, max: 32000 },
  banana: { min: 25000, avg: 37000, max: 60000 },
  mango: { min: 4000, avg: 8000, max: 12000 },
  grapes: { min: 15000, avg: 25000, max: 35000 },
  watermelon: { min: 15000, avg: 25000, max: 40000 },
  muskmelon: { min: 10000, avg: 16000, max: 25000 },
  apple: { min: 7000, avg: 11000, max: 16000 },
  orange: { min: 7000, avg: 11000, max: 18000 },
  papaya: { min: 25000, avg: 43000, max: 65000 },
  coconut: { min: 8400, avg: 14000, max: 28000 }, // kg/ha with husk (≈ nuts × 1.4 kg)
  cotton: { min: 300, avg: 500, max: 800 }, // lint
  jute: { min: 1500, avg: 2000, max: 2800 },
  coffee: { min: 500, avg: 900, max: 1500 }, // clean coffee
};

const HA_PER_ACRE = 0.404686;
const KG_PER_QUINTAL = 100;

export interface YieldResult {
  crop: string;
  areaAcres: number;
  hectares: number;
  /** Raw yield band, kg/ha. */
  yieldPerHa: { min: number; avg: number; max: number };
  /** Expected production for the area, quintals (1 quintal = 100 kg). */
  productionQuintals: { min: number; typ: number; max: number };
  /** Whether the typical estimate was adjusted by the crop match score. */
  conditionAdjusted: boolean;
  source: string;
}

export const estimateYield = query({
  args: {
    crop: v.string(),
    areaAcres: v.number(),
    /** Top crop-match probability from the recommendation (0–1), optional. */
    topProbability: v.optional(v.number()),
  },
  handler: (_ctx, { crop, areaAcres, topProbability }): YieldResult => {
    const y = YIELD_AVERAGES[crop];
    if (!y) throw new Error(`Unknown crop: ${crop}`);
    if (areaAcres <= 0) throw new Error("areaAcres must be positive");

    const hectares = areaAcres * HA_PER_ACRE;
    // Condition adjustment: 0.75× … 1.25× the typical yield depending on
    // how well the farmer's conditions match the crop's ideal profile.
    const prob =
      topProbability != null
        ? Math.min(1, Math.max(0, topProbability))
        : null;
    const factor = prob != null ? 0.75 + 0.5 * prob : 1;
    const typYield = y.avg * factor;

    const q = (kgPerHa: number) =>
      Math.round((kgPerHa * hectares) / KG_PER_QUINTAL);

    return {
      crop,
      areaAcres,
      hectares: Math.round(hectares * 100) / 100,
      yieldPerHa: y,
      productionQuintals: {
        min: q(y.min),
        typ: q(typYield),
        max: q(y.max),
      },
      conditionAdjusted: prob != null,
      source: "National-average yield baseline (indicative)",
    };
  },
});
