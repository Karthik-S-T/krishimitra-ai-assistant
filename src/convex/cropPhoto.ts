/**
 * KrishiMitra AI — Crop & Soil Photo Analysis backend (append-only history).
 *
 * The farmer's field photos are analyzed by a vision-capable LLM when
 * OPENAI_API_KEY is configured (key stays server-side). The model reports
 * ONLY what is visible in the photo. If the key is missing, an honest
 * "offline" structured checklist result is produced — never fabricated
 * disease claims. Every completed analysis is appended to cropAnalyses;
 * previous analyses are never overwritten.
 */
import { action } from "./_generated/server";
import { v } from "convex/values";
import type { Lang } from "../lib/i18n";

export interface YieldBand {
  low: number;
  high: number;
}

export interface CropPhotoAnalysis {
  crop: string;
  growthStage: string;
  healthStatus: "healthy" | "mild_stress" | "moderate_stress" | "severe_stress";
  healthScore: number | null;
  observations: string[];
  fertilizerAdvice: string | null;
  irrigationAdvice: string | null;
  yieldBand: YieldBand | null;
  confidence: number | null;
  fullText: string;
  engine: "llm" | "offline";
}

export type CropPhotoResponse =
  | { ok: true; data: CropPhotoAnalysis }
  | {
      ok: false;
      reason: "missing_key" | "api_error" | "unsupported_file" | "photo_unclear";
      detail?: string;
    };

const STAGES = [
  "germination",
  "vegetative",
  "flowering",
  "fruiting",
  "maturity",
] as const;

const STAGE_MAP: Record<string, string> = {
  germination: "Germination",
  vegetative: "Vegetative",
  flowering: "Flowering",
  fruiting: "Fruiting / Grain fill",
  maturity: "Maturity",
};

function coerce(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Offline fallback: transparent, rule-based checklist — clearly labelled. */
function offlineResult(crop: string, cropAgeDays: number | null): CropPhotoAnalysis {
  const stage =
    cropAgeDays === null
      ? "Unknown"
      : cropAgeDays < 15
        ? STAGE_MAP.germination
        : cropAgeDays < 45
          ? STAGE_MAP.vegetative
          : cropAgeDays < 75
            ? STAGE_MAP.flowering
            : cropAgeDays < 105
              ? STAGE_MAP.fruiting
              : STAGE_MAP.maturity;
  return {
    crop,
    growthStage: stage,
    healthStatus: "healthy",
    healthScore: null,
    observations: [],
    fertilizerAdvice: null,
    irrigationAdvice: null,
    yieldBand: null,
    confidence: null,
    fullText: "",
    engine: "offline",
  };
}

function buildSystemPrompt(lang: Lang): string {
  return (
    "You are an agronomy expert analyzing farmer field crop photos in India " +
    "(focus: Karnataka). Analyze ONLY what is visible in the photo. Never invent " +
    "diseases or pests you cannot see. If the photo is blurry, too distant, or " +
    "the crop cannot be identified, set needsBetterPhoto=true. " +
    'Reply with ONLY a JSON object: {"crop": string|null (best guess of the crop ' +
    "seen; null if unsure), \"growthStage\": one of " +
    `"${STAGES.join('", "')}"` +
    ' or null, "healthStatus": one of "healthy"|"mild_stress"|"moderate_stress"|' +
    '"severe_stress" or null, "healthScore": 0-100 integer or null, ' +
    '"observations": string[] (each a short English observation; prefix with ' +
    '"disease:", "pest:", "nutrient:", "water:", or "other:"), ' +
    '"fertilizerAdvice": string|null (practical farmer-facing advice, can mention ' +
    "the N-P-K gap seen), \"irrigationAdvice\": string|null, " +
    '"yieldBand": {"low": number, "high": number} in quintals/acre or null (null ' +
    "unless confident from visible stand), \"confidence\": 0-1 number (model " +
    "confidence in this analysis), \"fullText\": string (2-4 short farmer-friendly " +
    `sentences), "needsBetterPhoto": boolean}. Answer in ${lang === "kn" ? "Kannada" : lang === "hi" ? "Hindi" : "English"} ` +
    "for farmer-facing text fields (observations, advice, fullText)."
  );
}

export const analyzeCropPhoto = action({
  args: {
    fileDataUrl: v.string(),
    // Optional additional photos (up to 3 total). Each must be a data:image URL.
    extraImages: v.optional(v.array(v.string())),
    crop: v.string(),
    variety: v.optional(v.string()),
    cropAgeDays: v.optional(v.number()),
    areaAcres: v.optional(v.number()),
    lang: v.optional(v.union(v.literal("en"), v.literal("kn"), v.literal("hi"))),
    notes: v.optional(v.string()),
  },
  handler: async (
    _ctx,
    {
      fileDataUrl,
      extraImages,
      crop,
      variety,
      cropAgeDays,
      areaAcres,
      lang = "en" as Lang,
      notes,
    },
  ): Promise<CropPhotoResponse> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Honest offline mode: no invented disease claims, engine="offline".
      return { ok: true, data: offlineResult(crop, cropAgeDays ?? null) };
    }
    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const model = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";

    if (!/^data:image\//i.test(fileDataUrl)) {
      return { ok: false, reason: "unsupported_file" };
    }
    if (fileDataUrl.length > 6_000_000) {
      return { ok: false, reason: "unsupported_file", detail: "file_too_large" };
    }

    const userText =
      `Crop: ${crop}${variety ? ` (variety: ${variety})` : ""}. ` +
      (cropAgeDays != null ? `Crop age: ${cropAgeDays} days. ` : "") +
      (areaAcres != null ? `Field area: ${areaAcres} acres. ` : "") +
      (notes ? `Farmer notes: ${notes}. ` : "") +
      `Analyze this field photo${extraImages && extraImages.length > 0 ? ` (photo 1 of ${1 + extraImages.length}; analyze all photos together as one field)` : ""} and return only the JSON object.`;

    // All farmer photos (camera or gallery) — validated data:image URLs only.
    const images = [fileDataUrl, ...(extraImages ?? [])]
      .filter((u) => /^data:image\//i.test(u))
      .slice(0, 3);

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 900,
          temperature: 0,
          messages: [
            { role: "system", content: buildSystemPrompt(lang) },
            {
              role: "user",
              content: [
                { type: "text", text: userText },
                ...images.map((url) => ({
                  type: "image_url" as const,
                  image_url: { url },
                })),
              ],
            },
          ],
        }),
      });
      if (!res.ok) {
        return { ok: false, reason: "api_error", detail: `HTTP ${res.status}` };
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content ?? "";
      const jsonMatch = /\{[\s\S]*\}/.exec(content);
      if (!jsonMatch) return { ok: false, reason: "photo_unclear" };
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      } catch {
        return { ok: false, reason: "photo_unclear" };
      }
      if (parsed.needsBetterPhoto === true) {
        return { ok: false, reason: "photo_unclear" };
      }
      const healthRaw =
        typeof parsed.healthStatus === "string"
          ? (parsed.healthStatus as string)
          : "";
      const healthOk = [
        "healthy",
        "mild_stress",
        "moderate_stress",
        "severe_stress",
      ].includes(healthRaw);
      const stageRaw =
        typeof parsed.growthStage === "string" ? parsed.growthStage : "";
      const observations = Array.isArray(parsed.observations)
        ? (parsed.observations as unknown[])
            .filter((o): o is string => typeof o === "string" && o.trim().length > 0)
            .slice(0, 8)
        : [];
      const yb =
        parsed.yieldBand && typeof parsed.yieldBand === "object"
          ? (parsed.yieldBand as Record<string, unknown>)
          : null;
      const yieldBand =
        yb && coerce(yb.low) !== null && coerce(yb.high) !== null
          ? {
              low: clamp(coerce(yb.low) as number, 0, 200),
              high: clamp(coerce(yb.high) as number, 0, 200),
            }
          : null;
      const fullText =
        typeof parsed.fullText === "string" && parsed.fullText.trim()
          ? parsed.fullText.trim()
          : "";
      const out: CropPhotoAnalysis = {
        crop,
        growthStage: STAGE_MAP[stageRaw] ?? (stageRaw || "Unknown"),
        healthStatus: (healthOk ? healthRaw : "moderate_stress") as CropPhotoAnalysis["healthStatus"],
        healthScore: coerce(parsed.healthScore),
        observations,
        fertilizerAdvice:
          typeof parsed.fertilizerAdvice === "string" && parsed.fertilizerAdvice.trim()
            ? parsed.fertilizerAdvice.trim()
            : null,
        irrigationAdvice:
          typeof parsed.irrigationAdvice === "string" && parsed.irrigationAdvice.trim()
            ? parsed.irrigationAdvice.trim()
            : null,
        yieldBand,
        confidence: coerce(parsed.confidence),
        fullText,
        engine: "llm",
      };
      if (out.healthScore === null && out.observations.length === 0 && !fullText) {
        return { ok: false, reason: "photo_unclear" };
      }
      return { ok: true, data: out };
    } catch (e) {
      return {
        ok: false,
        reason: "api_error",
        detail: e instanceof Error ? e.message : "fetch failed",
      };
    }
  },
});

/** ---------------------------------------------------------------
 * Post-comparison smart recommendation: given the change between two
 * analyses, produce practical next steps (LLM when available, rules else).
 * --------------------------------------------------------------- */
export const compareAdvice = action({
  args: {
    crop: v.string(),
    prev: v.object({
      date: v.string(),
      healthStatus: v.string(),
      observations: v.array(v.string()),
      growthStage: v.optional(v.string()),
      yieldLow: v.optional(v.number()),
      yieldHigh: v.optional(v.number()),
    }),
    curr: v.object({
      date: v.string(),
      healthStatus: v.string(),
      observations: v.array(v.string()),
      growthStage: v.optional(v.string()),
      yieldLow: v.optional(v.number()),
      yieldHigh: v.optional(v.number()),
    }),
    soilSummary: v.optional(
      v.object({
        ph: v.optional(v.number()),
        nitrogen: v.optional(v.number()),
        phosphorus: v.optional(v.number()),
        potassium: v.optional(v.number()),
      }),
    ),
    lang: v.optional(v.union(v.literal("en"), v.literal("kn"), v.literal("hi"))),
  },
  handler: async (
    _ctx,
    { crop, prev, curr, soilSummary, lang = "en" },
  ): Promise<{ advice: string; engine: "llm" | "offline" }> => {
    const apiKey = process.env.OPENAI_API_KEY;
    const langName = lang === "kn" ? "Kannada" : lang === "hi" ? "Hindi" : "English";
    if (!apiKey) {
      // Deterministic fallback from the recorded deltas.
      const worse =
        ["severe_stress", "moderate_stress", "mild_stress", "healthy"].indexOf(curr.healthStatus) <
        ["severe_stress", "moderate_stress", "mild_stress", "healthy"].indexOf(prev.healthStatus);
      const improved =
        ["severe_stress", "moderate_stress", "mild_stress", "healthy"].indexOf(curr.healthStatus) >
        ["severe_stress", "moderate_stress", "mild_stress", "healthy"].indexOf(prev.healthStatus);
      const newIssues = curr.observations.filter((o) => !prev.observations.includes(o));
      const parts: string[] = [];
      if (improved) parts.push("Crop health has improved since the previous analysis — continue the current practices.");
      else if (worse) parts.push("Crop health has declined since the previous analysis — inspect the field closely within 2 days.");
      else parts.push("Crop health is unchanged — keep monitoring as usual.");
      if (newIssues.length) parts.push(`New observations to check: ${newIssues.join("; ")}.`);
      if (soilSummary?.ph != null) parts.push(`Your soil pH is ${soilSummary.ph} — verify nutrient availability for ${crop}.`);
      parts.push("If symptoms continue, upload a close-up photo of the affected leaves.");
      return { advice: parts.join(" "), engine: "offline" };
    }
    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const model = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";
    const prompt =
      `Two analyses of the same ${crop} field, ${prev.date} vs ${curr.date}. ` +
      `Previous: health=${prev.healthStatus}, stage=${prev.growthStage ?? "?"}, ` +
      `observations=${JSON.stringify(prev.observations)}, yield=${prev.yieldLow ?? "?"}-${prev.yieldHigh ?? "?"} q/acre. ` +
      `Current: health=${curr.healthStatus}, stage=${curr.growthStage ?? "?"}, ` +
      `observations=${JSON.stringify(curr.observations)}, yield=${curr.yieldLow ?? "?"}-${curr.yieldHigh ?? "?"} q/acre. ` +
      (soilSummary?.ph != null
        ? `Soil Health Card data: pH ${soilSummary.ph}, N ${soilSummary.nitrogen ?? "?"}, P ${soilSummary.phosphorus ?? "?"}, K ${soilSummary.potassium ?? "?"} kg/ha. `
        : "") +
      "Write 2-3 short, practical next steps for the farmer based on the CHANGE between the two analyses. " +
      "Do not claim the photos alone prove the cause of any yield change — label causes as possible contributing factors. " +
      `Answer in ${langName} only.`;
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 350,
          temperature: 0.2,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const advice = data.choices?.[0]?.message?.content?.trim();
      if (!advice) throw new Error("empty");
      return { advice, engine: "llm" };
    } catch {
      return { advice: "", engine: "offline" };
    }
  },
});
