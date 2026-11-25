/**
 * KrishiMitra AI — Phase 1 runtime crop model.
 *
 * The base Gaussian Naive Bayes model uses the cross-validated crop profiles
 * in ../data/cropProfiles.ts. When coordinates are provided, a regional
 * suitability layer adjusts its scores and adds heuristic tropical crops.
 */
import {
  CROP_PROFILES,
  DATASET_INFO,
  FEATURE_KEYS,
  MODEL_EVALUATION,
  type FeatureKey,
  type CropProfile,
} from "../data/cropProfiles";

type CropSeason = "kharif" | "rabi" | "zaid";

export interface CropModelInput {
  N: number;
  P: number;
  K: number;
  temperature: number;
  humidity: number;
  ph: number;
  rainfall: number;
  latitude?: number;
  longitude?: number;
  season?: CropSeason;
  irrigated?: boolean;
}

export interface CropPrediction {
  crop: string;
  probability: number;
  /** Per-crop Gaussian statistics (the crop's typical ranges). */
  stats: Record<FeatureKey, { mean: number; std: number; min: number; max: number }>;
}

export interface CropRecommendationResult {
  top: CropPrediction[];
  featureStats: Record<
    FeatureKey,
    { mean: number; std: number; min: number; max: number }
  >;
  model: {
    selected: string;
    label: string;
    accuracy: number;
    macroF1: number;
    evalNote: string;
    dataset: { records: number; classes: number; source: string };
    candidates: { name: string; label: string; accuracy: number; macroF1: number }[];
  };
}

const regionalStat = (mean: number, std: number) => ({
  mean,
  std,
  min: mean - 2 * std,
  max: mean + 2 * std,
});

const regionalProfile = (
  N: number,
  P: number,
  K: number,
  temperature: number,
  humidity: number,
  ph: number,
  rainfall: number,
): CropProfile => ({
  count: 0,
  stats: {
    N: regionalStat(N, 20),
    P: regionalStat(P, 14),
    K: regionalStat(K, 18),
    temperature: regionalStat(temperature, 4),
    humidity: regionalStat(humidity, 12),
    ph: regionalStat(ph, 0.8),
    rainfall: regionalStat(rainfall, 45),
  },
});

const REGIONAL_CROP_PROFILES: Record<string, CropProfile> = {
  ragi: regionalProfile(65, 35, 40, 26, 65, 6.5, 170),
  groundnut: regionalProfile(35, 45, 55, 27, 65, 6.3, 185),
  tomato: regionalProfile(100, 60, 65, 25, 65, 6.3, 175),
  turmeric: regionalProfile(120, 55, 140, 25, 75, 6.2, 240),
};

/** All 22 crops represented in the source dataset. */
export const ALL_CROPS = Object.keys(CROP_PROFILES).sort();

export function validateModelInput(args: CropModelInput): string | null {
  for (const key of FEATURE_KEYS) {
    const value = args[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return `${key} must be a finite number`;
    }
  }
  if (args.ph < 0 || args.ph > 14) return "pH must be between 0 and 14";
  if (args.N < 0 || args.P < 0 || args.K < 0) return "N, P and K must be non-negative";
  if (args.humidity < 0 || args.humidity > 100) return "humidity must be between 0 and 100";
  if (args.rainfall < 0) return "rainfall must be non-negative";
  if (
    args.latitude !== undefined &&
    (args.latitude < -90 || args.latitude > 90)
  ) {
    return "latitude must be between -90 and 90";
  }
  if (
    args.longitude !== undefined &&
    (args.longitude < -180 || args.longitude > 180)
  ) {
    return "longitude must be between -180 and 180";
  }
  return null;
}

function logGaussian(x: number, mean: number, variance: number): number {
  const v = Math.max(variance, 1e-9);
  return (
    -0.5 * Math.log(2 * Math.PI * v) - ((x - mean) * (x - mean)) / (2 * v)
  );
}

const within = (value: number, min: number, max: number) =>
  value >= min && value <= max;

function regionalWeight(crop: string, args: CropModelInput): number {
  const { latitude, longitude } = args;
  const hasLocation = latitude !== undefined && longitude !== undefined;
  const tropicalIndia =
    hasLocation &&
    latitude > 0 &&
    latitude < 24 &&
    longitude >= 68 &&
    longitude <= 97;

  if (
    crop === "apple" &&
    latitude !== undefined &&
    latitude < 28 &&
    args.temperature >= 18
  ) {
    return 0;
  }

  if (crop === "grapes" && tropicalIndia) {
    return args.irrigated || args.temperature < 18 ? 1.2 : 0.2;
  }

  if (crop === "coconut") {
    return args.humidity >= 70 && args.rainfall >= 1000 ? 1.8 : 0.2;
  }

  if (!tropicalIndia) return 1;

  const phFit = (low: number, high: number) => within(args.ph, low, high);
  const rainFit = (low: number, high: number) => within(args.rainfall, low, high);
  const tempFit = (low: number, high: number) =>
    within(args.temperature, low, high);
  const nutrientFit = (
    nRange: [number, number],
    pRange: [number, number],
    kRange: [number, number],
  ) =>
    within(args.N, ...nRange) &&
    within(args.P, ...pRange) &&
    within(args.K, ...kRange);
  const adjusted = (base: number, conditions: boolean[]) =>
    conditions.reduce((weight, matches) => weight * (matches ? 1.12 : 0.85), base);

  switch (crop) {
    case "ragi":
      return adjusted(1.7, [
        tempFit(18, 35),
        phFit(5.5, 7.8),
        rainFit(350, 1200),
        nutrientFit([0, 100], [10, 80], [10, 120]),
      ]);
    case "maize":
      return adjusted(1.35, [
        tempFit(18, 35),
        phFit(5.5, 7.8),
        rainFit(500, 1300),
        nutrientFit([40, 130], [25, 80], [10, 120]),
      ]);
    case "pomegranate":
      return adjusted(1.65, [
        tempFit(20, 38),
        phFit(5.5, 8),
        rainFit(350, 1000),
        nutrientFit([0, 80], [0, 55], [15, 110]),
      ]);
    case "groundnut":
      return adjusted(1.45, [
        tempFit(20, 34),
        phFit(5.5, 7.5),
        rainFit(400, 1000),
        nutrientFit([0, 70], [20, 90], [20, 130]),
      ]);
    case "chickpea":
      return adjusted(1.3, [
        !args.season || args.season === "rabi",
        tempFit(15, 30),
        phFit(6, 8),
        rainFit(300, 850),
        nutrientFit([15, 90], [40, 100], [45, 120]),
      ]);
    case "cotton":
      return adjusted(1.3, [
        !args.season || args.season === "kharif",
        tempFit(20, 36),
        phFit(6, 8),
        rainFit(500, 1100),
        nutrientFit([75, 160], [25, 75], [10, 55]),
      ]);
    case "tomato":
      return adjusted(1.35, [
        tempFit(18, 32),
        phFit(5.5, 7.5),
        rainFit(400, 1000),
        nutrientFit([50, 150], [30, 100], [30, 120]),
      ]);
    case "banana":
      return adjusted(1.3, [
        tempFit(22, 36),
        phFit(5.5, 7.5),
        args.rainfall >= 800 || args.irrigated === true,
        args.humidity >= 60,
        nutrientFit([70, 150], [45, 110], [30, 80]),
      ]);
    case "turmeric":
      return adjusted(1.4, [
        tempFit(20, 33),
        phFit(5.5, 7.5),
        args.rainfall >= 800 || args.irrigated === true,
        args.humidity >= 60,
        nutrientFit([70, 170], [25, 90], [80, 190]),
      ]);
    case "rice":
      return (args.rainfall >= 1000 || args.irrigated === true ? 1.7 : 0.25) *
        (phFit(5, 7.8) ? 1.15 : 0.8) *
        (args.humidity >= 70 ? 1.15 : 0.85);
    default:
      return 1;
  }
}

/**
 * Gaussian Naive Bayes with balanced base priors, followed by optional
 * location-aware suitability weighting.
 */
export function classifyCrop(args: CropModelInput): CropRecommendationResult {
  const tropicalIndia =
    args.latitude !== undefined &&
    args.longitude !== undefined &&
    args.latitude > 0 &&
    args.latitude < 24 &&
    args.longitude >= 68 &&
    args.longitude <= 97;
  const profiles = tropicalIndia
    ? { ...CROP_PROFILES, ...REGIONAL_CROP_PROFILES }
    : CROP_PROFILES;
  // The training rainfall feature is on a roughly 0–300 mm scale; annual
  // regional totals are converted to a comparable seasonal amount for NB.
  const rainfallIsAnnual = args.rainfall > 300;
  const rainfallForModel = rainfallIsAnnual ? args.rainfall / 4 : args.rainfall;
  const posteriors = new Map<string, number>();
  let maxLog = -Infinity;
  for (const [crop, profile] of Object.entries(profiles)) {
    let logp = 0; // equal priors
    for (const key of FEATURE_KEYS) {
      const st = profile.stats[key];
      const value = key === "rainfall" ? rainfallForModel : args[key];
      const featureLogp = logGaussian(value, st.mean, st.std * st.std);
      logp += key === "rainfall" && rainfallIsAnnual
        ? featureLogp * 0.25
        : featureLogp;
    }
    const weight = regionalWeight(crop, args);
    if (weight === 0) {
      logp = -Infinity;
    } else {
      logp += Math.log(weight);
    }
    posteriors.set(crop, logp);
    maxLog = Math.max(maxLog, logp);
  }

  let sum = 0;
  for (const [crop, logp] of posteriors) {
    const e = Math.exp(logp - maxLog);
    posteriors.set(crop, e);
    sum += e;
  }

  const top = [...posteriors.entries()]
    .map(([crop, p]) => ({
      crop,
      probability: p / sum,
      stats: profiles[crop]!.stats,
    }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 3);

  const best = top[0]!.crop;
  return {
    top,
    featureStats: profiles[best]!.stats,
    model: {
      selected: MODEL_EVALUATION.selected,
      label: tropicalIndia
        ? "Gaussian Naive Bayes + regional suitability"
        : "Gaussian Naive Bayes",
      accuracy: MODEL_EVALUATION.candidates[0].accuracy,
      macroF1: MODEL_EVALUATION.candidates[0].macroF1,
      evalNote: tropicalIndia
        ? `${MODEL_EVALUATION.evalNote}; regional crop candidates are heuristic and not part of this evaluation`
        : MODEL_EVALUATION.evalNote,
      dataset: {
        records: DATASET_INFO.records,
        classes: DATASET_INFO.classes,
        source: DATASET_INFO.source,
      },
      candidates: MODEL_EVALUATION.candidates.map((c) => ({
        name: c.name,
        label: c.label,
        accuracy: c.accuracy,
        macroF1: c.macroF1,
      })),
    },
  };
}
