import { useState } from "react";
import { useLang } from "@/context/LanguageContext";
import { cropName } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import type { FeatureKey } from "@/convex/data/cropProfiles";
import type { CropPrediction, CropRecommendationResult } from "@/convex/lib/cropModel";

const FEATURE_KEYS: FeatureKey[] = [
  "N",
  "P",
  "K",
  "temperature",
  "humidity",
  "ph",
  "rainfall",
];

const SF: Record<FeatureKey, string> = {
  N: "sfN",
  P: "sfP",
  K: "sfK",
  temperature: "sfTemp",
  humidity: "sfHum",
  ph: "sfPh",
  rainfall: "sfRain",
};

const SEASON_LABELS: Record<Lang, Record<"kharif" | "rabi" | "zaid", string>> = {
  kn: { kharif: "ಮಳೆಗಾಲ", rabi: "ಚಳಿಗಾಲ", zaid: "ಬೇಸಿಗೆ" },
  hi: { kharif: "बरसात का मौसम", rabi: "सर्दी का मौसम", zaid: "गर्मी का मौसम" },
  en: { kharif: "Rainy Season", rabi: "Winter Season", zaid: "Summer Season" },
};

const fmt = (v: number) =>
  Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);

interface Props {
  rec: CropRecommendationResult | undefined;
  ready: boolean;
  inputs: Record<FeatureKey, number>;
  season: "kharif" | "rabi" | "zaid";
}

export function Results({ rec, ready, inputs, season }: Props) {
  const { t, lang } = useLang();
  const [detailsIdx, setDetailsIdx] = useState<number | null>(null);

  if (!ready) {
    return (
      <div className="nb-card flex flex-col items-center p-10 text-center">
        <span className="mb-4 text-5xl">🌾</span>
        <h2 className="font-display text-lg uppercase">{t("emptyTitle")}</h2>
        <p className="mt-2 max-w-sm text-sm font-medium text-[#5c574b]">
          {t("emptySub")}
        </p>
      </div>
    );
  }

  if (!rec) {
    return (
      <div className="nb-card flex flex-col items-center p-10 text-center">
        <span className="mb-3 animate-pulse text-4xl">🤖</span>
        <p className="text-sm font-bold uppercase">{t("loading")}</p>
      </div>
    );
  }

  const top = rec.top[0]!;
  const alts = rec.top.slice(1);
  const unusual = top.probability < 0.4;

  // Why this crop: the 3 features whose input is closest to the crop's
  // typical range (smallest |z-score| relative to the class distribution).
  const reasons = FEATURE_KEYS.map((f) => {
    const st = top.stats[f];
    const z = Math.abs((inputs[f] - st.mean) / Math.max(st.std, 1e-6));
    return { f, st, z };
  })
    .sort((a, b) => a.z - b.z)
    .slice(0, 3);

  // ---- Explainable AI ------------------------------------------------
  // Factor scores are DERIVED, not random: the Gaussian likelihood of the
  // farmer's input under the recommended crop's class distribution gives a
  // 0–1 compatibility per factor (e^(-z²/2) — 1 when the input sits at the
  // crop's typical value, falling off as it moves into the crop's tails).
  const factorOf = (z: number) => Math.exp(-0.5 * z * z);
  const zOf = (crop: CropPrediction) =>
    FEATURE_KEYS.map((f) => ({
      f,
      z: Math.abs((inputs[f] - crop.stats[f].mean) / Math.max(crop.stats[f].std, 1e-6)),
    }));
  const pct = (x: number) => Math.round(x * 100);
  const factors = [
    {
      key: "soil",
      label: t("xaSoil"),
      score: Math.round(
        (factorOf(zOf(top).find((x) => x.f === "ph")!.z) +
          factorOf(zOf(top).find((x) => x.f === "N")!.z) +
          factorOf(zOf(top).find((x) => x.f === "P")!.z) +
          factorOf(zOf(top).find((x) => x.f === "K")!.z)) / 4,
      ),
    },
    {
      key: "weather",
      label: t("xaWeather"),
      score: Math.round(
        (factorOf(zOf(top).find((x) => x.f === "temperature")!.z) +
          factorOf(zOf(top).find((x) => x.f === "humidity")!.z)) / 2,
      ),
    },
    {
      key: "water",
      label: t("xaWater"),
      score: pct(factorOf(zOf(top).find((x) => x.f === "rainfall")!.z)),
    },
    {
      key: "market",
      label: t("xaMarket"),
      score: null, // no live market factor in the model — shown qualitatively
    },
  ];

  // Qualitative verdict per factor from the score (only derived numbers used).
  const verdictOf = (score: number): { sym: string; key: string } =>
    score >= 60 ? { sym: "✓", key: "xaSuitable" } : score >= 35 ? { sym: "⚠️", key: "xaModerate" } : { sym: "✕", key: "xaNotSuitable" };

  // Why-not-others: the factor holding each alternative back (largest z).
  const whyNot = alts.map((a) => {
    const zs = zOf(a).sort((x, y) => y.z - x.z);
    const worst = zs[0]!;
    return {
      crop: a.crop,
      probability: a.probability,
      factor: t(SF[worst.f]),
      verdict: verdictOf(pct(factorOf(worst.z))),
    };
  });

  const details = detailsIdx != null ? rec.top[detailsIdx] : null;

  return (
    <div className="space-y-5">
      {/* Top pick */}
      <div className="nb-shadow-lg border-2 border-[#141414] bg-[#2fa35c] p-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <span className="nb-chip bg-[#ffc53d] text-[#141414]">
            🏆 {t("topPick")}
          </span>
          <span className="nb-chip bg-white text-[#141414]">
            {rec.model.label} · {(rec.model.accuracy * 100).toFixed(1)}% CV
          </span>
        </div>
        <p className="font-display mt-4 text-4xl uppercase leading-none sm:text-5xl">
          {cropName(top.crop, lang)}
        </p>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[11px] font-bold uppercase tracking-widest">
            <span>{t("confidence")}</span>
            <span>{Math.round(top.probability * 100)}%</span>
          </div>
          <div className="nb-bar">
            <div style={{ width: `${Math.max(4, top.probability * 100)}%` }} />
          </div>
          <p className="mt-1 text-[10px] font-semibold text-white/80">
            🗓 {t("seasonForChip")}: {SEASON_LABELS[lang][season]} ·{" "}
            {t("modelNotGuarantee")}
          </p>
        </div>
        {unusual && (
          <p className="nb-border mt-3 bg-[#d64545] px-3 py-2 text-[11px] font-bold">
            ⚠ {t("unusualWarn")}
          </p>
        )}
      </div>

      {/* Why this crop */}
      <div className="nb-card p-5">
        <h3 className="font-display mb-1 text-sm uppercase">
          🧠 {t("whyTitle")}
        </h3>
        <ul className="space-y-2">
          {reasons.map(({ f, st }) => (
            <li
              key={f}
              className="nb-border flex flex-wrap items-center justify-between gap-2 bg-[#ede7d8] px-3 py-2 text-xs font-bold"
            >
              <span>{t(SF[f])}</span>
              <span className="font-medium text-[#5c574b]">
                {t("whyItem", {
                  value: fmt(inputs[f]),
                  min: fmt(st.min),
                  max: fmt(st.max),
                })}
              </span>
            </li>
          ))}
        </ul>

        {/* Factor compatibility — every number is derived from the Gaussian
            model, never random (see comment above). */}
        <div className="mt-4 space-y-3">
          <p className="font-display text-xs uppercase">{t("xaFactors")}</p>
          {factors.map((f) => (
            <div key={f.key}>
              <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase">
                <span>
                  {f.score != null ? verdictOf(f.score).sym : "ℹ️"} {f.label}
                </span>
                <span className="text-[#5c574b]">
                  {f.score != null
                    ? `${f.score}% · ${t(verdictOf(f.score).key)}`
                    : t("xaQualitative")}
                </span>
              </div>
              {f.score != null ? (
                <div className="nb-bar">
                  <div style={{ width: `${Math.max(3, f.score)}%` }} />
                </div>
              ) : (
                <p className="text-[11px] font-semibold text-[#5c574b]">
                  {t("xaMarketNote")}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Alternatives */}
      <div className="nb-card p-5">
        <h3 className="font-display mb-1 text-sm uppercase">{t("altCrops")}</h3>
        <p className="mb-3 text-[11px] font-semibold text-[#5c574b]">
          {t("xaWhyNotIntro")}
        </p>
        <div className="space-y-3">
          {alts.map((a, i) => (
            <div key={a.crop} className="nb-border bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-bold uppercase">
                  {cropName(a.crop, lang)}
                </p>
                <button
                  type="button"
                  onClick={() => setDetailsIdx(i + 1)}
                  className="nb-press bg-[#ffc53d] px-2.5 py-1 text-[10px] font-bold uppercase text-[#141414]"
                >
                  {t("viewDetails")}
                </button>
              </div>
              <div className="nb-bar">
                <div
                  style={{
                    width: `${Math.max(4, a.probability * 100)}%`,
                    background: "#ffc53d",
                  }}
                />
              </div>
              {(() => {
                const wn = whyNot[i];
                return wn ? (
                  <p className="mt-2 text-[11px] font-semibold text-[#5c574b]">
                    {wn.verdict.sym} {t("xaLimiting")}: {wn.factor} —{" "}
                    {t(wn.verdict.key)}
                  </p>
                ) : null;
              })()}
            </div>
          ))}
        </div>
      </div>

      {/* Crop details dialog */}
      {details && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#141414]/60 p-4"
          onClick={() => setDetailsIdx(null)}
        >
          <div
            className="nb-card max-h-[85vh] w-full max-w-md overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-[#141414] bg-[#5fa8e8] px-4 py-3">
              <p className="font-display text-sm uppercase">
                {t("detailsTitle", { crop: cropName(details.crop, lang) })}
              </p>
              <button
                type="button"
                onClick={() => setDetailsIdx(null)}
                className="nb-press bg-white px-2 py-0.5 text-xs font-bold"
              >
                ✕
              </button>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-[#141414] bg-[#ede7d8] text-left uppercase">
                  <th className="px-3 py-2 font-bold">—</th>
                  <th className="px-3 py-2 font-bold">{t("colYour")}</th>
                  <th className="px-3 py-2 font-bold">{t("colMin")}</th>
                  <th className="px-3 py-2 font-bold">{t("colTyp")}</th>
                  <th className="px-3 py-2 font-bold">{t("colMax")}</th>
                </tr>
              </thead>
              <tbody>
                {FEATURE_KEYS.map((f) => (
                  <tr
                    key={f}
                    className="border-b border-[#141414]/20 last:border-0"
                  >
                    <td className="px-3 py-2 font-bold">{t(SF[f])}</td>
                    <td className="px-3 py-2 font-bold">{fmt(inputs[f])}</td>
                    <td className="px-3 py-2 font-semibold">
                      {fmt(details.stats[f].min)}
                    </td>
                    <td className="px-3 py-2 font-semibold">
                      {fmt(details.stats[f].mean)}
                    </td>
                    <td className="px-3 py-2 font-semibold">
                      {fmt(details.stats[f].max)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t-2 border-[#141414] bg-[#ffc53d] px-4 py-2 text-[10px] font-bold uppercase">
              {t("disclaimer")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
