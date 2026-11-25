import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { evaluateCropSuitability, type SuitabilityResult } from "@/convex/suitability";
import type { FarmWeather } from "@/convex/farmWeather";
import type { SoilRainResponse } from "@/convex/soilRain";
import { Button } from "@/components/ui/button";
import { useLang } from "@/context/LanguageContext";

/**
 * KrishiMitra AI — Phase 7: crop suitability engine (UI).
 *
 * Transparent rule-based evaluation for ALL crops — requirements come from
 * the sourced cropRequirements database (dataset-derived + FAO/ICAR
 * curated); the engine is a pure function imported directly (no ML claims —
 * the project has no labelled suitability dataset). Missing soil/weather
 * values are NEVER treated as zero: they are listed as missing and lower
 * the assessment confidence.
 *
 * Data provenance is shown with chips:
 *   real (live weather / satellite) · user-provided (water, soil test) ·
 *   calculated (rule engine result).
 */

const CROPS = [
  "pomegranate", "tomato", "rice", "maize", "wheat", "cotton", "groundnut",
  "sugarcane", "onion", "potato", "chilli", "grapes", "banana", "mango",
  "orange", "papaya", "coconut", "watermelon", "muskmelon", "chickpea",
  "kidneybeans", "pigeonpeas", "mothbeans", "mungbean", "blackgram", "lentil",
  "coffee", "jute",
] as const;

const CATEGORY_KEY: Record<string, string> = {
  suitable: "suitSuitable",
  moderately_suitable: "suitModerate",
  less_suitable: "suitLess",
};

const withTimeout = <T,>(request: Promise<T>, ms = 6000): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Request timed out")), ms);
    request.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });

interface SoilPrefill {
  ph: number | null;
  N: number | null;
  P: number | null;
  K: number | null;
  source: string | null;
  real: boolean; // from a real soil test (vs user-entered)
}

export function SuitabilityPanel({
  lat,
  lon,
  district,
  state,
  farmAreaSqM,
  satellite,
}: {
  lat: number | null;
  lon: number | null;
  district: string | null;
  state: string | null;
  farmAreaSqM: number | null;
  satellite: {
    ndviMean?: number | null;
    eviMean?: number | null;
    ndwiMean?: number | null;
  } | null;
}) {
  const { t } = useLang();
  const getFarmWeather = useAction(api.farmWeather.getFarmWeather);
  const getSoilRain = useAction(api.soilRain.getSoilRain);
  const hasConvexUrl = Boolean(import.meta.env.VITE_CONVEX_URL?.trim());

  const [crop, setCrop] = useState<string>("pomegranate");
  const [irrigation, setIrrigation] = useState<"rainfed" | "partial" | "full">("partial");
  const [waterAvailability, setWaterAvailability] = useState<"low" | "medium" | "high">("medium");

  const [weather, setWeather] = useState<FarmWeather | null>(null);
  const [weatherErr, setWeatherErr] = useState(false);

  const [soil, setSoil] = useState<SoilPrefill | null>(null);
  const [soilLoading, setSoilLoading] = useState(false);
  const [soilErr, setSoilErr] = useState(false);
  const [rainfallMm, setRainfallMm] = useState<number | null>(null);

  // farmer's latest saved soil report (user-provided data, if any)
  const latestReport = useQuery(
    api.reports.latestSoilReport,
    hasConvexUrl ? {} : "skip",
  );

  // ---- live weather (real data) -------------------------------------------
  useEffect(() => {
    setWeather(null);
    setWeatherErr(false);
    if (!hasConvexUrl || lat === null || lon === null) return;
    let cancelled = false;
    withTimeout(getFarmWeather({ lat, lon }))
      .then((w) => {
        if (!cancelled) setWeather(w);
      })
      .catch(() => {
        if (!cancelled) setWeatherErr(true);
      });
    return () => {
      cancelled = true;
    };
  }, [lat, lon, getFarmWeather, hasConvexUrl]);

  // ---- soil prefill: saved report first, else nearest real soil test -------
  const fetchSoil = useCallback(async () => {
    if (!hasConvexUrl || lat === null || lon === null) {
      setSoil(null);
      setRainfallMm(null);
      setSoilLoading(false);
      return;
    }
    setSoilLoading(true);
    setSoilErr(false);
    try {
      const res = (await withTimeout(getSoilRain({ lat, lon }))) as SoilRainResponse;
      if (res.ok) {
        setRainfallMm(res.data.rain.seasonalMm);
        if (res.data.soil.status === "test" || res.data.soil.status === "live") {
          const d = res.data.soil.data;
          const src =
            res.data.soil.status === "live"
              ? res.data.soil.source
              : `nearest soil test · ${d.label}${d.distanceKm ? ` (${d.distanceKm} km)` : ""}`;
          setSoil({ ph: d.ph, N: d.n, P: d.p, K: d.k, source: src, real: true });
          return;
        }
      }
      setSoil(null);
    } catch {
      setSoilErr(true);
    } finally {
      setSoilLoading(false);
    }
  }, [lat, lon, getSoilRain, hasConvexUrl]);

  // auto-try prefill once
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (prefilledRef.current || lat === null || lon === null) return;
    prefilledRef.current = true;
    void fetchSoil();
  }, [fetchSoil, lat, lon]);

  // saved soil report overrides nearest-test prefill (it is the farmer's own)
  useEffect(() => {
    if (latestReport) {
      setSoil({
        ph: latestReport.ph,
        N: latestReport.nitrogen,
        P: latestReport.phosphorus,
        K: latestReport.potassium,
        source: `saved soil report (${latestReport.soilDataSource})`,
        real: false,
      });
    }
  }, [latestReport]);

  // ---- evaluate (pure, deterministic) ---------------------------------------
  const result: SuitabilityResult | null = useMemo(
    () =>
      evaluateCropSuitability(crop, {
        lat,
        lon,
        district,
        state,
        temperature: weather?.current.temperature ?? null,
        humidity: weather?.current.humidity ?? null,
        rainfall: rainfallMm,
        ph: soil?.ph ?? null,
        N: soil?.N ?? null,
        P: soil?.P ?? null,
        K: soil?.K ?? null,
        irrigation,
        waterAvailability,
        farmAreaSqM,
        satellite,
      }),
    [crop, lat, lon, district, state, weather, rainfallMm, soil, irrigation, waterAvailability, farmAreaSqM, satellite],
  );

  const chip = (key: string, cls: string) => (
    <span
      key={key}
      className={`border-2 border-[#141414] px-2 py-0.5 text-[10px] font-bold uppercase ${cls}`}
    >
      {t(key)}
    </span>
  );

  const inputCls = "w-full border-2 border-[#141414] bg-white px-2.5 py-1.5 text-sm font-semibold";

  return (
    <div className="space-y-3">
      {/* inputs */}
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block text-xs font-bold uppercase">
          {t("suitCrop")}
          <select value={crop} onChange={(e) => setCrop(e.target.value)} className={`mt-1 ${inputCls}`}>
            {CROPS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-bold uppercase">
          {t("suitWaterLabel")}
          <select
            value={irrigation}
            onChange={(e) => setIrrigation(e.target.value as "rainfed" | "partial" | "full")}
            className={`mt-1 ${inputCls}`}
          >
            <option value="rainfed">{t("suitWaterRainfed")}</option>
            <option value="partial">{t("suitWaterPartial")}</option>
            <option value="full">{t("suitWaterFull")}</option>
          </select>
        </label>
        <label className="block text-xs font-bold uppercase">
          {t("suitWaterLabel")} · level
          <select
            value={waterAvailability}
            onChange={(e) => setWaterAvailability(e.target.value as "low" | "medium" | "high")}
            className={`mt-1 ${inputCls}`}
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </label>
      </div>

      {/* soil prefill status */}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => void fetchSoil()}>
          🧪 {t("suitInputs")}
        </Button>
        {soilLoading && <span className="text-[10px] font-bold uppercase">⏳</span>}
        {soil?.source && (
          <span className="text-[10px] font-semibold text-[#5c574b]">
            🧪 {soil.source} {soil.real ? "· real data" : "· user data"}
          </span>
        )}
        {!soil && !soilLoading && (
          <span className="text-[10px] font-semibold text-[#5c574b]">{t("suitMissing")}: pH / N / P / K</span>
        )}
        {soilErr && <span className="text-[10px] font-semibold text-[#b91c1c]">{t("wfError")}</span>}
        {weatherErr && !weather && (
          <span className="text-[10px] font-semibold text-[#b91c1c]">{t("wfError")}</span>
        )}
        {weather && rainfallMm !== null && (
          <span className="text-[10px] font-semibold text-[#5c574b]">
            🌦️ {Math.round(weather.current.temperature)}°C · 🌧️ {rainfallMm} mm (season)
          </span>
        )}
      </div>

      {result && (
        <>
          {/* category banner */}
          <div
            className={`border-2 border-[#141414] px-3 py-2 nb-shadow-sm ${
              result.category === "suitable"
                ? "bg-[#7fb069]/40"
                : result.category === "moderately_suitable"
                  ? "bg-[#ffc53d]/50"
                  : "bg-[#f87171]/30"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-lg uppercase">
                {result.category ? t(CATEGORY_KEY[result.category]) : t("suitPartial")}
              </p>
              <p className="text-xs font-bold">
                {t("suitConfidence")}: {Math.round(result.confidence * 100)}%
              </p>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#5c574b]">
              {result.crop} · {result.evaluatedCount}/{result.totalCount} rules
            </p>
          </div>

          {/* provenance chips */}
          <div className="flex flex-wrap gap-1.5">
            {chip("suitRealChip", "bg-[#7fb069]/50")}
            {chip("suitUserChip", "bg-white")}
            {chip("suitCalcChip", "bg-[#ffc53d]/50")}
            {chip("suitRuleEngine", "bg-white")}
          </div>

          {/* reasons / attention / limiting / missing */}
          {result.reasons.length > 0 && (
            <div className="border-2 border-[#141414] bg-white p-3 nb-shadow-sm">
              <p className="mb-1.5 font-display text-sm uppercase">{t("suitReasons")}</p>
              <ul className="space-y-1 text-xs font-semibold">
                {result.reasons.map((f, i) => (
                  <li key={i}>✓ {f.message}</li>
                ))}
              </ul>
            </div>
          )}
          {result.attention.length > 0 && (
            <div className="border-2 border-[#141414] bg-[#ffc53d]/30 p-3 nb-shadow-sm">
              <p className="mb-1.5 font-display text-sm uppercase">{t("suitAttention")}</p>
              <ul className="space-y-1 text-xs font-semibold">
                {result.attention.map((f, i) => (
                  <li key={i}>⚠ {f.message}</li>
                ))}
              </ul>
            </div>
          )}
          {result.limiting.length > 0 && (
            <div className="border-2 border-[#141414] bg-[#f87171]/25 p-3 nb-shadow-sm">
              <p className="mb-1.5 font-display text-sm uppercase">{t("suitLimiting")}</p>
              <ul className="space-y-1 text-xs font-semibold">
                {result.limiting.map((f, i) => (
                  <li key={i}>✕ {f.message}</li>
                ))}
              </ul>
            </div>
          )}
          {result.missing.some((m) => /pH|nitrogen|phosphorus|potassium/i.test(m)) && (
            <div className="border-2 border-[#141414] bg-[#ffc53d]/40 px-3 py-2 nb-shadow-sm">
              <p className="text-xs font-bold">🚫 {t("suitIncomplete")}</p>
            </div>
          )}
          {result.missing.length > 0 && (
            <div className="border-2 border-[#141414] bg-white p-3 nb-shadow-sm">
              <p className="mb-1.5 font-display text-sm uppercase">{t("suitMissing")}</p>
              <ul className="space-y-1 text-xs font-semibold text-[#5c574b]">
                {result.missing.map((m, i) => (
                  <li key={i}>• {m}</li>
                ))}
              </ul>
            </div>
          )}

          {result.sources.length > 0 && (
            <p className="text-[11px] font-medium leading-snug text-[#5c574b]">
              {t("suitSources")}: {result.sources.join(" · ")}
            </p>
          )}
          <p className="text-[11px] font-medium leading-snug text-[#5c574b]">{t("suitDisclaimer")}</p>
        </>
      )}
    </div>
  );
}
