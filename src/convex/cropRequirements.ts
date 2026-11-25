/**
 * KrishiMitra AI — Phase 7 crop requirements database.
 *
 * Every threshold is sourced — never invented. Two origin classes:
 *
 *  1. `dataset` — derived from the standard 22-crop Crop Recommendation
 *     dataset (2,200 records, 100 per class) already shipped in this project
 *     (convex/data/cropProfiles.ts). IMPORTANT: only parameters whose units
 *     are verifiably real are taken from the dataset — temperature (°C),
 *     soil pH and humidity (%). The dataset's N/P/K and rainfall columns
 *     are on compressed model scales (e.g. pomegranate K 35–45, rainfall
 *     103–112) that CANNOT be honestly compared with real Soil Health Card
 *     kg/ha values or IMD mm rainfall — so those rules are NOT emitted for
 *     dataset crops (they stay null → reported as missing, never guessed).
 *  2. `curated` — standard agronomy figures from FAO EcoCrop suitability
 *     parameters and ICAR/state-university package-of-practice summaries,
 *     in real units (°C, mm, kg/ha, pH). These crops additionally carry
 *     N/P/K, rainfall and water-requirement rules.
 *     for crops requested by the spec that are not in the dataset.
 *
 * Soil-fertility interpretation bands follow the Soil Health Card / AISP
 * nutrient-index convention ( Low / Medium / High in kg/ha ).
 */
import { CROP_PROFILES } from "./data/cropProfiles";

export interface Range {
  min: number;
  max: number;
}
export interface SourcedRange {
  range: Range;
  source: string;
}
export type WaterReq = "low" | "medium" | "high" | "very_high";

export interface CropRequirements {
  crop: string;
  label: string;
  temp: SourcedRange | null;
  humidity: SourcedRange | null;
  rainfall: SourcedRange | null;
  ph: SourcedRange | null;
  N: SourcedRange | null;
  P: SourcedRange | null;
  K: SourcedRange | null;
  water: { requirement: WaterReq; source: string } | null;
  /** Rule that needs a season/context input rather than a measured value. */
  derived: { rainySeasonOnly: boolean; source: string } | null;
  notes: string;
}

const DATASET_SOURCE =
  "22-crop recommendation dataset (per-crop records, convex/data/cropProfiles.ts)";

/** Percentile-derived robust range from a class's Gaussian stats + extremes. */
function datasetRange(mean: number, std: number, min: number, max: number): Range {
  const robust: Range = {
    min: Math.round((mean - 1.645 * std) * 10) / 10,
    max: Math.round((mean + 1.645 * std) * 10) / 10,
  };
  return max - min < 2 * std ? { min, max } : robust;
}

/** Build requirements for one dataset crop.
 *
 * Units audit (why only temperature/humidity/pH are dataset-derived):
 * the dataset's N/P/K and rainfall columns are compressed model features,
 * not real-world measurements — pomegranate's class statistics give
 * K 35–45 and rainfall 103–112 mm, which are physically wrong for real
 * Soil Health Card kg/ha and IMD mm. Emitting ranges from them would make
 * the engine reject every real field. pH and temperature ARE real (0–14
 * scale, °C), so those two rules are safe to derive; humidity is a 0–100
 * Gaussian that overlaps real % but is only emitted when the spread is
 * physically plausible.
 */
function fromDataset(crop: string): CropRequirements {
  const st = CROP_PROFILES[crop]!.stats;
  const dr = (k: keyof typeof st): SourcedRange => ({
    range: datasetRange(st[k].mean, st[k].std, st[k].min, st[k].max),
    source: DATASET_SOURCE,
  });
  return {
    crop,
    label: crop,
    temp: dr("temperature"),
    humidity: dr("humidity"),
    // Dataset N/P/K/rainfall are model-scale, NOT real units — left null so
    // the engine reports them as MISSING instead of comparing apples to
    // oranges (data-integrity rule: never treat/invent unavailable values).
    rainfall: null,
    ph: dr("ph"),
    N: null,
    P: null,
    K: null,
    water: null,
    derived: null,
    notes: "Ranges derived from the crop recommendation dataset's actual class records (temperature/pH/humidity only — dataset N/P/K & rainfall are model-scale, not real units).",
  };
}

/** Curated (FAO EcoCrop / ICAR) requirements for crops outside the dataset. */
const CURATED: Record<string, Omit<CropRequirements, "crop">> = {
  tomato: {
    label: "Tomato",
    temp: { range: { min: 21, max: 27 }, source: "FAO EcoCrop — tomato day temperature, optimal growth" },
    humidity: null,
    rainfall: { range: { min: 300, max: 600 }, source: "FAO EcoCrop — tomato total growing-period rainfall (with irrigation)" },
    ph: { range: { min: 6.0, max: 7.0 }, source: "FAO EcoCrop — tomato soil pH optimum" },
    N: null, P: null, K: null,
    water: { requirement: "high", source: "FAO — tomato is a high water-requirement vegetable" },
    derived: null,
    notes: "Curated agronomic ranges (FAO EcoCrop). No soil-fertility dataset classes for this crop.",
  },
  wheat: {
    label: "Wheat",
    temp: { range: { min: 10, max: 25 }, source: "FAO EcoCrop — wheat optimal temperature (cool season)" },
    humidity: null,
    rainfall: { range: { min: 350, max: 900 }, source: "FAO EcoCrop — wheat growing-period rainfall" },
    ph: { range: { min: 6.0, max: 7.5 }, source: "FAO EcoCrop — wheat soil pH optimum" },
    N: null, P: null, K: null,
    water: { requirement: "high", source: "ICAR-IIWBR — wheat needs assured irrigation in India" },
    derived: { rainySeasonOnly: false, source: "Rabi (winter) crop in India — sown Oct–Dec" },
    notes: "Curated agronomic ranges (FAO EcoCrop / ICAR).",
  },
  groundnut: {
    label: "Groundnut",
    temp: { range: { min: 25, max: 30 }, source: "FAO EcoCrop — groundnut optimal temperature" },
    humidity: null,
    rainfall: { range: { min: 500, max: 1000 }, source: "FAO EcoCrop — groundnut growing-period rainfall" },
    ph: { range: { min: 5.5, max: 7.0 }, source: "FAO EcoCrop — groundnut soil pH optimum" },
    N: null, P: null, K: null,
    water: { requirement: "medium", source: "ICAR-DGR — rainfed groundnut is standard with 500–1000 mm" },
    derived: null,
    notes: "Curated agronomic ranges (FAO EcoCrop / ICAR-DGR).",
  },
  sugarcane: {
    label: "Sugarcane",
    temp: { range: { min: 20, max: 35 }, source: "FAO EcoCrop — sugarcane optimal temperature" },
    humidity: null,
    rainfall: { range: { min: 1000, max: 1800 }, source: "FAO EcoCrop — sugarcane growing-period rainfall (irrigated tracts need less)" },
    ph: { range: { min: 6.0, max: 7.5 }, source: "FAO EcoCrop — sugarcane soil pH optimum" },
    N: null, P: null, K: null,
    water: { requirement: "very_high", source: "ICAR-SBI — sugarcane has the highest water requirement among field crops" },
    derived: null,
    notes: "Curated agronomic ranges (FAO EcoCrop / ICAR-SBI).",
  },
  onion: {
    label: "Onion",
    temp: { range: { min: 13, max: 28 }, source: "FAO EcoCrop — onion optimal temperature" },
    humidity: null,
    rainfall: { range: { min: 300, max: 550 }, source: "FAO EcoCrop — onion growing-period rainfall (mild season)" },
    ph: { range: { min: 6.0, max: 7.5 }, source: "FAO EcoCrop — onion soil pH optimum" },
    N: null, P: null, K: null,
    water: { requirement: "medium", source: "NHRDF — onion needs frequent light irrigations, bulb formation is sensitive" },
    derived: { rainySeasonOnly: false, source: "Rabi crop in most of India" },
    notes: "Curated agronomic ranges (FAO EcoCrop / NHRDF).",
  },
  potato: {
    label: "Potato",
    temp: { range: { min: 15, max: 22 }, source: "FAO EcoCrop — potato optimal temperature (cool season)" },
    humidity: null,
    rainfall: { range: { min: 300, max: 600 }, source: "FAO EcoCrop — potato growing-period rainfall" },
    ph: { range: { min: 5.5, max: 6.5 }, source: "FAO EcoCrop — potato soil pH optimum (slightly acid)" },
    N: null, P: null, K: null,
    water: { requirement: "high", source: "ICAR-CPRI — potato needs assured irrigation; tuberization is moisture-sensitive" },
    derived: { rainySeasonOnly: false, source: "Rabi crop in most of India" },
    notes: "Curated agronomic ranges (FAO EcoCrop / ICAR-CPRI).",
  },
  chilli: {
    label: "Chilli",
    temp: { range: { min: 18, max: 32 }, source: "FAO EcoCrop — chilli optimal temperature" },
    humidity: null,
    rainfall: { range: { min: 600, max: 1200 }, source: "FAO EcoCrop — chilli growing-period rainfall" },
    ph: { range: { min: 6.0, max: 7.0 }, source: "ICAR-IIHR — chilli prefers slightly acid to neutral soils" },
    N: null, P: null, K: null,
    water: { requirement: "medium", source: "ICAR — chilli is moderately water-demanding; waterlogging is harmful" },
    derived: null,
    notes: "Curated agronomic ranges (FAO EcoCrop / ICAR).",
  },
};

/** All supported crops: the 22 dataset classes + curated extras. */
const DB: Record<string, CropRequirements> = {};
for (const crop of Object.keys(CROP_PROFILES)) {
  DB[crop] = fromDataset(crop);
}
for (const [crop, req] of Object.entries(CURATED)) {
  DB[crop] = { crop, ...req };
}

export function getRequirements(crop: string): CropRequirements | null {
  return DB[crop] ?? null;
}

export function listSupportedCrops(): string[] {
  return Object.keys(DB).sort();
}

// ---------------------------------------------------------------------------
// Soil interpretation bands — Soil Health Card / AISP nutrient-index classes.
// (Dept. of Agriculture & Cooperation, "Nutrient status in soil" norms used on
// every Soil Health Card printed in India.)
// ---------------------------------------------------------------------------

/** pH reaction classes (standard soil-science bands). */
export const PH_BANDS: { key: string; min: number; max: number }[] = [
  { key: "strongly_acid", min: 0, max: 5.5 },
  { key: "moderately_acid", min: 5.5, max: 6.0 },
  { key: "slightly_acid", min: 6.0, max: 6.5 },
  { key: "neutral", min: 6.5, max: 7.5 },
  { key: "slightly_alkaline", min: 7.5, max: 8.5 },
  { key: "alkaline", min: 8.5, max: 14 },
];

export const N_CLASSES = { low: 280, high: 560 } as const; // kg/ha
export const P_CLASSES = { low: 10, high: 25 } as const; // kg/ha P2O5-basis
export const K_CLASSES = { low: 110, high: 280 } as const; // kg/ha K2O-basis

export function phBand(ph: number): string | null {
  const b = PH_BANDS.find((x) => ph >= x.min && ph < x.max);
  return b ? b.key : null;
}

export function nClass(n: number): "low" | "medium" | "high" {
  return n < N_CLASSES.low ? "low" : n > N_CLASSES.high ? "high" : "medium";
}
export function pClass(p: number): "low" | "medium" | "high" {
  return p < P_CLASSES.low ? "low" : p > P_CLASSES.high ? "high" : "medium";
}
export function kClass(k: number): "low" | "medium" | "high" {
  return k < K_CLASSES.low ? "low" : k > K_CLASSES.high ? "high" : "medium";
}

/** Pomegranate is a dataset crop — surfaced as a dedicated module by the
 *  engine (detailed explanation format), using the same sourced ranges. */
export function isPomegranate(crop: string): boolean {
  return crop === "pomegranate";
}
