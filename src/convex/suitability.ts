/**
 * KrishiMitra AI — Phase 7 crop suitability engine.
 *
 * Transparent rule-based evaluation (NOT machine learning — the project has
 * no labelled suitability dataset, so per the spec no ML is claimed). Loads
 * sourced per-crop requirements from cropRequirements.ts and returns:
 *   - category: suitable | moderately_suitable | less_suitable
 *   - satisfied / limiting factors, each quoting its threshold + source
 *   - missing inputs (never treated as zero)
 *   - confidence = share of rules that could actually be evaluated
 */
import {
  getRequirements,
  phBand,
  type CropRequirements,
  type SourcedRange,
  type WaterReq,
} from "./cropRequirements";

export type SuitabilityCategory = "suitable" | "moderately_suitable" | "less_suitable";

export interface SuitabilityInput {
  lat?: number | null;
  lon?: number | null;
  district?: string | null;
  state?: string | null;
  temperature?: number | null;
  rainfall?: number | null;
  humidity?: number | null;
  ph?: number | null;
  N?: number | null;
  P?: number | null;
  K?: number | null;
  soilType?: string | null;
  organicCarbon?: number | null;
  irrigation?: "rainfed" | "partial" | "full" | null;
  waterAvailability?: "low" | "medium" | "high" | null;
  farmAreaSqM?: number | null;
  satellite?: {
    ndviMean?: number | null;
    eviMean?: number | null;
    ndwiMean?: number | null;
  } | null;
}

export interface Factor {
  rule: string; // "temperature" | "rainfall" | ...
  status: "pass" | "fail" | "warn";
  message: string; // pre-localized sentence
}

export interface SuitabilityResult {
  crop: string;
  category: SuitabilityCategory | null; // null only if zero rules evaluated
  reasons: Factor[]; // satisfied (pass) factors
  attention: Factor[]; // warn (manageable) factors
  limiting: Factor[]; // fail factors
  missing: string[]; // pre-localized missing-input sentences
  /** True when a soil rule (pH/N/P/K) is required by this crop but the
   * value was unavailable. The assessment is then explicitly marked
   * incomplete — never silently produced from zero-filled soil. */
  soilIncomplete: boolean;
  confidence: number; // 0–1: evaluated rules / evaluable rules
  evaluatedCount: number;
  totalCount: number;
  sources: string[]; // unique threshold sources used
}

const WATER_RANK: Record<WaterReq, number> = {
  low: 0,
  medium: 1,
  high: 2,
  very_high: 3,
};

const WATER_SUPPLY: Record<"rainfed" | "partial" | "full", number> = {
  rainfed: 0,
  partial: 1,
  full: 2,
};

function inRange(x: number, r: Range2): boolean {
  return x >= r.min && x <= r.max;
}
interface Range2 {
  min: number;
  max: number;
}

/** How far outside a range a value is, as a share of the range width (0..∞). */
function outsideScore(x: number, r: Range2): number {
  if (x < r.min) return (r.min - x) / Math.max(r.max - r.min, 1e-9);
  if (x > r.max) return (x - r.max) / Math.max(r.max - r.min, 1e-9);
  return 0;
}

/** Convert one (value, requirement) pair into a factor. */
function evaluateRange(
  rule: string,
  value: number,
  req: SourcedRange,
): Factor {
  const rangeTxt = `${req.range.min}–${req.range.max}`;
  if (inRange(value, req.range)) {
    return {
      rule,
      status: "pass",
      message: `within the required range ${rangeTxt} (requirement source: ${req.source})`,
    };
  }
  const out = outsideScore(value, req.range);
  return {
    rule,
    status: out <= 0.35 ? "warn" : "fail",
    message: `${out <= 0.35 ? "slightly outside" : "outside"} the required range ${rangeTxt} (measured: ${value}) — requirement source: ${req.source}`,
  };
}

const WATER_SUP_TXT: Record<"rainfed" | "partial" | "full", string> = {
  rainfed: "rainfed (no irrigation)",
  partial: "partial irrigation",
  full: "full irrigation",
};

/**
 * Evaluate one crop against the available inputs.
 * Deterministic, explainable, and honest about what could not be checked.
 */
export function evaluateCropSuitability(
  crop: string,
  input: SuitabilityInput,
): SuitabilityResult {
  const req: CropRequirements | null = getRequirements(crop);
  if (!req) {
    return {
      crop,
      category: null,
      reasons: [],
      attention: [],
      limiting: [],
      missing: [],
      soilIncomplete: false,
      confidence: 0,
      evaluatedCount: 0,
      totalCount: 0,
      sources: [],
    };
  }

  const reasons: Factor[] = [];
  const attention: Factor[] = [];
  const limiting: Factor[] = [];
  const missing: string[] = [];
  const sources: string[] = [];
  let evaluated = 0;

  // ---- climate ------------------------------------------------------------
  if (req.temp) {
    sources.push(req.temp.source);
    if (typeof input.temperature === "number") {
      evaluated++;
      const f = evaluateRange("temperature", input.temperature, req.temp);
      (f.status === "pass" ? reasons : f.status === "warn" ? attention : limiting).push(f);
    } else {
      missing.push("Temperature is unavailable — the temperature requirement could not be checked.");
    }
  }
  if (req.humidity) {
    sources.push(req.humidity.source);
    if (typeof input.humidity === "number") {
      evaluated++;
      const f = evaluateRange("humidity", input.humidity, req.humidity);
      (f.status === "pass" ? reasons : f.status === "warn" ? attention : limiting).push(f);
    } else {
      missing.push("Humidity is unavailable — the humidity requirement could not be checked.");
    }
  }
  if (req.rainfall) {
    sources.push(req.rainfall.source);
    if (typeof input.rainfall === "number") {
      evaluated++;
      const f = evaluateRange("rainfall", input.rainfall, req.rainfall);
      if (f.status !== "pass" && input.irrigation === "full") {
        // Irrigation can compensate rainfall — downgrade to attention.
        attention.push({
          rule: "rainfall",
          status: "warn",
          message: `rainfall is ${f.message.includes("slightly") ? "slightly outside" : "outside"} the typical range ${req.rainfall.range.min}–${req.rainfall.range.max}, but full irrigation is available — manageable with irrigation management`,
        });
      } else {
        (f.status === "pass" ? reasons : f.status === "warn" ? attention : limiting).push(f);
      }
    } else {
      missing.push("Rainfall is unavailable — the rainfall requirement could not be checked.");
    }
  }

  // ---- soil ---------------------------------------------------------------
  if (req.ph) {
    sources.push(req.ph.source);
    if (typeof input.ph === "number") {
      evaluated++;
      const f = evaluateRange("soil pH", input.ph, req.ph);
      (f.status === "pass" ? reasons : f.status === "warn" ? attention : limiting).push(f);
    } else {
      missing.push("Soil pH is unavailable — suitability cannot fully evaluate soil acidity requirements.");
    }
  }
  for (const [key, label] of [
    ["N", "Nitrogen (N)"],
    ["P", "Phosphorus (P)"],
    ["K", "Potassium (K)"],
  ] as const) {
    const r = req[key];
    if (!r) continue;
    sources.push(r.source);
    const v = input[key];
    if (typeof v === "number") {
      evaluated++;
      const f = evaluateRange(label, v, r);
      // Fertility levels can be amended — treat out-of-range N/P/K as
      // "attention" rather than a hard fail (fertilizer can correct it).
      (f.status === "fail" ? attention : reasons).push({
        ...f,
        status: f.status === "fail" ? "warn" : "pass",
      });
    } else {
      missing.push(`${label} is unavailable — soil fertility could not be checked for this nutrient.`);
    }
  }

  // ---- water --------------------------------------------------------------
  if (req.water) {
    sources.push(req.water.source);
    if (input.irrigation) {
      evaluated++;
      const need = WATER_RANK[req.water.requirement];
      const supply = WATER_RANK_watersupply(input.irrigation, input.waterAvailability);
      if (supply >= need) {
        reasons.push({
          rule: "water",
          status: "pass",
          message: `water availability (${WATER_SUP_TXT[input.irrigation]}) is sufficient for a ${req.water.requirement.replace("_", " ")} water-requirement crop (requirement source: ${req.water.source})`,
        });
      } else if (supply === need - 1) {
        attention.push({
          rule: "water",
          status: "warn",
          message: `water availability (${WATER_SUP_TXT[input.irrigation]}) may require careful irrigation management for a ${req.water.requirement.replace("_", " ")} water-requirement crop (requirement source: ${req.water.source})`,
        });
      } else {
        limiting.push({
          rule: "water",
          status: "fail",
          message: `water availability (${WATER_SUP_TXT[input.irrigation]}) is likely insufficient for a ${req.water.requirement.replace("_", " ")} water-requirement crop (requirement source: ${req.water.source})`,
        });
      }
    } else {
      missing.push("Irrigation/water availability is unavailable — the water requirement could not be checked.");
    }
  }

  // ---- satellite context (indicator only, never a pass/fail rule) ---------
  const sat = input.satellite;
  if (sat && typeof sat.ndviMean === "number") {
    if (sat.ndviMean < 0.2) {
      attention.push({
        rule: "vegetation",
        status: "warn",
        message: `recent satellite NDVI is low (${sat.ndviMean.toFixed(2)}) — the field may have sparse vegetation (indicator only, not a soil measurement)`,
      });
    } else if (sat.ndviMean > 0.55) {
      reasons.push({
        rule: "vegetation",
        status: "pass",
        message: `recent satellite NDVI is healthy (${sat.ndviMean.toFixed(2)}) — indicator of active vegetation (indicator only, not a soil measurement)`,
      });
    }
  }

  // ---- category -----------------------------------------------------------
  const totalCount = evaluated + missing.length;
  const failCount = limiting.length;
  const warnCount = attention.filter((f) => f.rule !== "vegetation").length;

  // A required soil rule (pH/N/P/K) that could not be evaluated makes the
  // assessment explicitly INCOMPLETE — soil is a primary suitability factor
  // and the spec forbids filling it with zeros or distant-lab proxies.
  const SOIL_RULES = new Set(["soil pH", "Nitrogen (N)", "Phosphorus (P)", "Potassium (K)"]);
  const soilIncomplete = missing.some((m) =>
    [...SOIL_RULES].some((r) => m.startsWith(r)),
  );

  let category: SuitabilityCategory | null;
  if (evaluated === 0) {
    category = null;
  } else if (failCount >= 2 || (failCount >= 1 && evaluated <= 3)) {
    category = "less_suitable";
  } else if (failCount === 1) {
    category = "moderately_suitable";
  } else if (warnCount >= 2) {
    category = "moderately_suitable";
  } else if (warnCount === 1) {
    category = "suitable";
  } else {
    category = "suitable";
  }

  return {
    crop,
    category,
    reasons,
    attention,
    limiting,
    missing,
    soilIncomplete,
    confidence: totalCount > 0 ? Math.round((evaluated / totalCount) * 100) / 100 : 0,
    evaluatedCount: evaluated,
    totalCount,
    sources: [...new Set(sources)],
  };
}

/** Water supply rank: irrigation method + optional availability level. */
function WATER_RANK_watersupply(
  irrigation: "rainfed" | "partial" | "full",
  availability: "low" | "medium" | "high" | null | undefined,
): number {
  const base = WATER_SUPPLY[irrigation];
  if (availability === "low" && base > 0) return base - 1;
  if (availability === "high" && base < 2) return base + 1;
  return base;
}

/** Pomegranate module: same engine, dedicated explanation shape for the UI. */
export function evaluatePomegranate(input: SuitabilityInput): SuitabilityResult {
  return evaluateCropSuitability("pomegranate", input);
}
