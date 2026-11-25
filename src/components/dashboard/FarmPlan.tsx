import { useAction, useConvex } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLang } from "@/context/LanguageContext";
import { cropName } from "@/lib/i18n";
import { ALL_CROPS } from "@/convex/lib/cropModel";
import type { CropRecommendationResult } from "@/convex/lib/cropModel";
import type { SoilValues } from "@/components/dashboard/SoilForm";
import type { FertilizerResult } from "@/convex/fertilizer";
import type { YieldResult } from "@/convex/yield";
import type { MandiResponse } from "@/convex/market";
import type { RevenueResult } from "@/convex/revenue";
import { CROP_PROFILES } from "@/convex/data/cropProfiles";
import { PriceForecast } from "@/components/dashboard/PriceForecast";

interface Props {
  rec: CropRecommendationResult | null;
  soil: SoilValues;
  area: string;
  /** Initial tab — the Market module card deep-links to the forecast tab. */
  defaultTab?: string;
}

const fmt = (v: number) =>
  Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);
const inr = (v: number) => `₹${v.toLocaleString("en-IN")}`;

const STATUS_CLASS: Record<string, string> = {
  low: "bg-[#d64545] text-white",
  ok: "bg-[#2fa35c] text-white",
  high: "bg-[#ffc53d] text-[#141414]",
};

const HA_PER_ACRE = 0.404686;
const LOCAL_SCHEDULES: Record<string, { n: number; p: number; k: number }> = {
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
  wheat: { n: 120, p: 60, k: 40 },
  tomato: { n: 100, p: 60, k: 60 },
  groundnut: { n: 25, p: 50, k: 45 },
  sugarcane: { n: 150, p: 60, k: 60 },
  onion: { n: 100, p: 50, k: 50 },
  potato: { n: 120, p: 80, k: 100 },
  chilli: { n: 100, p: 50, k: 50 },
};

const LOCAL_YIELD_KG_HA: Record<string, { min: number; avg: number; max: number }> = {
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
  coconut: { min: 8400, avg: 14000, max: 28000 },
  cotton: { min: 300, avg: 500, max: 800 },
  jute: { min: 1500, avg: 2000, max: 2800 },
  coffee: { min: 500, avg: 900, max: 1500 },
  wheat: { min: 1800, avg: 3200, max: 4800 },
  tomato: { min: 18000, avg: 28000, max: 42000 },
  groundnut: { min: 900, avg: 1400, max: 2200 },
  sugarcane: { min: 55000, avg: 70000, max: 90000 },
  onion: { min: 10000, avg: 18000, max: 28000 },
  potato: { min: 15000, avg: 25000, max: 38000 },
  chilli: { min: 900, avg: 1500, max: 2400 },
};

const LOCAL_PRICE_PER_QUINTAL: Record<string, number> = {
  rice: 2300,
  maize: 2200,
  chickpea: 5600,
  kidneybeans: 6200,
  pigeonpeas: 7200,
  mothbeans: 5200,
  mungbean: 7800,
  blackgram: 6900,
  lentil: 6400,
  pomegranate: 5200,
  banana: 1800,
  mango: 4500,
  grapes: 6000,
  watermelon: 1500,
  muskmelon: 2600,
  apple: 8500,
  orange: 3200,
  papaya: 2200,
  coconut: 2800,
  cotton: 7200,
  jute: 5000,
  coffee: 22000,
  wheat: 2425,
  tomato: 2200,
  groundnut: 6200,
  sugarcane: 350,
  onion: 2400,
  potato: 1600,
  chilli: 11000,
};

const round1 = (value: number) => Math.round(value * 10) / 10;

function localMandi(crop: string): MandiResponse {
  const modal = LOCAL_PRICE_PER_QUINTAL[crop] ?? 3000;
  const spread = Math.max(100, Math.round(modal * 0.08));
  const today = new Date().toISOString().slice(0, 10);
  return {
    available: true,
    commodity: `${cropName(crop, "en")} · indicative`,
    state: "Karnataka",
    latestDate: today,
    price: { min: modal - spread, avg: modal, max: modal + spread },
    markets: [
      { market: "Bengaluru APMC (demo estimate)", district: "Bengaluru", modal },
      { market: "Yeshwanthpur Market (demo estimate)", district: "Bengaluru Urban", modal: Math.round(modal * 1.02) },
      { market: "Mysuru APMC (demo estimate)", district: "Mysuru", modal: Math.round(modal * 0.98) },
    ],
    trend: { direction: "flat", pct: 0, prevDate: null },
  };
}

function localFertilizer(
  crop: string,
  N: number,
  P: number,
  K: number,
): FertilizerResult {
  const schedule = LOCAL_SCHEDULES[crop] ?? { n: 80, p: 40, k: 40 };
  const profile = CROP_PROFILES[crop];
  const statusOf = (value: number, nutrient: "N" | "P" | "K") => {
    const range = profile?.stats[nutrient];
    if (!range) return "ok" as const;
    return value < range.min ? "low" as const : value > range.max ? "high" as const : "ok" as const;
  };
  const perAcre = {
    n: round1(schedule.n * HA_PER_ACRE),
    p: round1(schedule.p * HA_PER_ACRE),
    k: round1(schedule.k * HA_PER_ACRE),
  };
  const dapKg = perAcre.p / 0.46;
  const ureaKg = Math.max(0, (perAcre.n - dapKg * 0.18) / 0.46);
  const mopKg = perAcre.k / 0.6;
  const status = { N: statusOf(N, "N"), P: statusOf(P, "P"), K: statusOf(K, "K") };
  return {
    crop,
    schedulePerHa: schedule,
    perAcre,
    status,
    typicalRange: {
      N: { min: profile?.stats.N.min ?? 20, max: profile?.stats.N.max ?? 80 },
      P: { min: profile?.stats.P.min ?? 10, max: profile?.stats.P.max ?? 50 },
      K: { min: profile?.stats.K.min ?? 20, max: profile?.stats.K.max ?? 100 },
    },
    products: {
      ureaKg: round1(ureaKg),
      dapKg: round1(dapKg),
      mopKg: round1(mopKg),
      ureaBags: Math.ceil(ureaKg / 50),
      dapBags: Math.ceil(dapKg / 50),
      mopBags: Math.ceil(mopKg / 50),
    },
    hints: (["N", "P", "K"] as const).filter((key) => status[key] === "high"),
    source: "Local indicative extension schedule; verify with a soil test and local agronomist",
  };
}

function localYield(
  crop: string,
  areaAcres: number,
  topProbability?: number,
): YieldResult {
  const baseline = LOCAL_YIELD_KG_HA[crop] ?? { min: 1000, avg: 2000, max: 3500 };
  const hectares = areaAcres * HA_PER_ACRE;
  const probability = topProbability == null
    ? null
    : Math.min(1, Math.max(0, topProbability));
  const typical = baseline.avg * (probability == null ? 1 : 0.75 + 0.5 * probability);
  const toQuintals = (kgPerHa: number) => Math.round((kgPerHa * hectares) / 100);
  return {
    crop,
    areaAcres,
    hectares: round1(hectares),
    yieldPerHa: baseline,
    productionQuintals: {
      min: toQuintals(baseline.min),
      typ: toQuintals(typical),
      max: toQuintals(baseline.max),
    },
    conditionAdjusted: probability != null,
    source: "Local indicative yield baseline",
  };
}

function localRevenue(
  crop: string,
  areaAcres: number,
  pricePerQuintal: number,
  topProbability?: number,
): RevenueResult {
  const production = localYield(crop, areaAcres, topProbability).productionQuintals;
  return {
    crop,
    areaAcres,
    hectares: round1(areaAcres * HA_PER_ACRE),
    pricePerQuintal,
    productionQuintals: production,
    revenue: {
      min: production.min * pricePerQuintal,
      typ: production.typ * pricePerQuintal,
      max: production.max * pricePerQuintal,
    },
    disclaimer: "Indicative local estimate only; prices and yields vary by crop, season and market.",
  };
}

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

function Row({
  label,
  value,
  extra,
}: {
  label: string;
  value: string;
  extra?: string;
}) {
  return (
    <div className="nb-border flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 text-xs font-bold">
      <span>{label}</span>
      <span className="text-right">
        {value}
        {extra ? (
          <span className="ml-1 font-medium text-[#5c574b]">{extra}</span>
        ) : null}
      </span>
    </div>
  );
}

export function FarmPlan({ rec, soil, area, defaultTab = "fert" }: Props) {
  const { t, lang } = useLang();
  const getMandiPrices = useAction(api.market.getMandiPrices);
  const convex = useConvex();
  const hasConvexUrl = Boolean(import.meta.env.VITE_CONVEX_URL?.trim());

  const [chosen, setChosen] = useState<string | null>(null);
  const crop = chosen ?? rec?.top[0]?.crop ?? null;

  const [mandi, setMandi] = useState<MandiResponse | null>(null);
  const [mandiBusy, setMandiBusy] = useState(false);
  const [price, setPrice] = useState("");

  useEffect(() => {
    setMandi(null);
  }, [crop]);

  const n = Number(soil.N);
  const p = Number(soil.P);
  const k = Number(soil.K);
  const areaAcres = Number(area);
  const localMarketPrice = LOCAL_PRICE_PER_QUINTAL[crop ?? ""] ?? 3000;
  const enteredPrice = Number(price);
  const priceNum = Number.isFinite(enteredPrice) && enteredPrice > 0
    ? enteredPrice
    : localMarketPrice;

  const soilReady =
    [soil.N, soil.P, soil.K].every((value) => value.trim() !== "") &&
    [n, p, k].every((value) => Number.isFinite(value) && value >= 0);
  const areaReady = Number.isFinite(areaAcres) && areaAcres > 0;
  const priceReady = Number.isFinite(priceNum) && priceNum > 0;

  const localFert = useMemo(
    () => crop && soilReady && areaReady ? localFertilizer(crop, n, p, k) : null,
    [crop, soilReady, areaReady, n, p, k],
  );
  const localYld = useMemo(
    () => crop && areaReady
      ? localYield(crop, areaAcres, rec?.top[0]?.probability)
      : null,
    [crop, areaReady, areaAcres, rec],
  );
  const localRev = useMemo(
    () => crop && areaReady && priceReady
      ? localRevenue(crop, areaAcres, priceNum, rec?.top[0]?.probability)
      : null,
    [crop, areaReady, areaAcres, priceReady, priceNum, rec],
  );
  const [remoteFert, setRemoteFert] = useState<FertilizerResult | null>(null);
  const [remoteYld, setRemoteYld] = useState<YieldResult | null>(null);
  const [remoteRev, setRemoteRev] = useState<RevenueResult | null>(null);

  useEffect(() => {
    let active = true;
    setRemoteFert(null);
    setRemoteYld(null);
    setRemoteRev(null);
    if (!hasConvexUrl || !crop || !areaReady) return () => { active = false; };

    if (soilReady) {
      void withTimeout(
        Promise.resolve().then(() =>
          convex.query(api.fertilizer.recommendFertilizer, {
            crop,
            N: n,
            P: p,
            K: k,
            areaAcres,
          }),
        ),
      )
        .then((result) => { if (active) setRemoteFert(result); })
        .catch(() => undefined);
    }

    void withTimeout(
      Promise.resolve().then(() =>
        convex.query(api.yield.estimateYield, {
          crop,
          areaAcres,
          topProbability: rec?.top[0]?.probability,
        }),
      ),
    )
      .then((result) => { if (active) setRemoteYld(result); })
      .catch(() => undefined);

    if (priceReady) {
      void withTimeout(
        Promise.resolve().then(() =>
          convex.query(api.revenue.estimateRevenue, {
            crop,
            areaAcres,
            pricePerQuintal: priceNum,
          }),
        ),
      )
        .then((result) => { if (active) setRemoteRev(result); })
        .catch(() => undefined);
    }
    return () => { active = false; };
  }, [
    convex,
    hasConvexUrl,
    crop,
    soilReady,
    areaReady,
    priceReady,
    n,
    p,
    k,
    areaAcres,
    priceNum,
    rec,
  ]);

  const fert = remoteFert ?? localFert;
  const yld = remoteYld ?? localYld;
  const rev = remoteRev ?? localRev;
  const displayedMandi = mandi?.available ? mandi : crop ? localMandi(crop) : null;

  const loadMandi = async () => {
    if (!crop || mandiBusy) return;
    setMandiBusy(true);
    try {
      if (!hasConvexUrl) {
        setMandi(localMandi(crop));
        return;
      }
      const result = await withTimeout(getMandiPrices({ crop }));
      setMandi(result.available ? result : localMandi(crop));
    } catch {
      setMandi(localMandi(crop));
    } finally {
      setMandiBusy(false);
    }
  };

  return (
    <div className="nb-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xl">🗺️</span>
        <h2 className="font-display text-base uppercase">{t("planTitle")}</h2>
      </div>
      <p className="mb-4 text-xs font-medium text-[#5c574b]">{t("planSub")}</p>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest">
            {t("cropLabel")}
          </label>
          <select
            className="nb-input"
            value={crop ?? ""}
            onChange={(e) => setChosen(e.target.value)}
          >
            <option value="" disabled>
              — {t("cropLabel")} —
            </option>
            {ALL_CROPS.map((c) => (
              <option key={c} value={c}>
                {cropName(c, lang)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest">
            {t("areaLabel")}
          </label>
          <div className="nb-input bg-[#ede7d8]">
            {area ? `${area} ${t("acresUnit")}` : "—"}
          </div>
        </div>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="mb-4 grid h-auto w-full grid-cols-5 gap-1 rounded-none border-2 border-[#141414] bg-white p-1">
          {(
            [
              ["fert", "tabFert"],
              ["yield", "tabYield"],
              ["market", "tabMarket"],
              ["revenue", "tabRevenue"],
              ["forecast", "tabForecast"],
            ] as const
          ).map(([id, key]) => (
            <TabsTrigger
              key={id}
              value={id}
              className="rounded-none px-1 py-1.5 text-[10px] font-bold uppercase data-[state=active]:bg-[#ffc53d] data-[state=active]:text-[#141414] sm:text-[11px]"
            >
              {t(key)}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ---------------- Fertilizer ---------------- */}
        <TabsContent value="fert" className="mt-0 space-y-3">
          {!crop || !soilReady || !areaReady ? (
            <p className="nb-border bg-[#ede7d8] px-3 py-2 text-[11px] font-bold">
              ✏️ {t("planFillHint")}
            </p>
          ) : !fert ? (
            <p className="text-sm font-bold uppercase">{t("loading")}</p>
          ) : (
            <>
              {!remoteFert && (
                <p className="nb-chip bg-[#FEF3C7] text-[#854D0E]">
                  Indicative local fertilizer estimate · verify with a soil test
                </p>
              )}
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#5c574b]">
                {t("fertStatusTitle", { crop: cropName(crop, lang) })}
              </p>
              {(
                [
                  ["N", "sfN", n],
                  ["P", "sfP", p],
                  ["K", "sfK", k],
                ] as const
              ).map(([key, label, value]) => (
                <div
                  key={key}
                  className="nb-border flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 text-xs font-bold"
                >
                  <span>{t(label)}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-[#5c574b]">
                      {fmt(value)} ({t("whyItem", {
                        value: "",
                        min: fmt(fert.typicalRange[key].min),
                        max: fmt(fert.typicalRange[key].max),
                      }).replace(" — ", " ")})
                    </span>
                    <span className={`nb-chip ${STATUS_CLASS[fert.status[key]]}`}>
                      {t(`st${fert.status[key].charAt(0).toUpperCase()}${fert.status[key].slice(1)}`)}
                    </span>
                  </span>
                </div>
              ))}

              <p className="pt-1 text-[11px] font-bold uppercase tracking-widest text-[#5c574b]">
                {t("fertDoseTitle")} — {t("perAcre")}
              </p>
              <Row
                label="N : P₂O₅ : K₂O"
                value={`${fert.perAcre.n} : ${fert.perAcre.p} : ${fert.perAcre.k} kg`}
                extra={`(${fert.schedulePerHa.n} : ${fert.schedulePerHa.p} : ${fert.schedulePerHa.k} ${t("perHa")})`}
              />
              <Row
                label="Urea"
                value={`${fmt(fert.products.ureaKg)} kg`}
                extra={`≈ ${fert.products.ureaBags} × 50 kg`}
              />
              <Row
                label="DAP"
                value={`${fmt(fert.products.dapKg)} kg`}
                extra={`≈ ${fert.products.dapBags} × 50 kg`}
              />
              <Row
                label="MOP"
                value={`${fmt(fert.products.mopKg)} kg`}
                extra={`≈ ${fert.products.mopBags} × 50 kg`}
              />
              <p className="nb-border bg-[#ffc53d] px-3 py-2 text-[10px] font-bold uppercase">
                ⚠ {t("fertDisclaimer")}
              </p>
            </>
          )}
        </TabsContent>

        {/* ---------------- Yield ---------------- */}
        <TabsContent value="yield" className="mt-0 space-y-3">
          {!crop || !areaReady ? (
            <p className="nb-border bg-[#ede7d8] px-3 py-2 text-[11px] font-bold">
              ✏️ {t("planFillHint")}
            </p>
          ) : !yld ? (
            <p className="text-sm font-bold uppercase">{t("loading")}</p>
          ) : (
            <>
              {!remoteYld && (
                <p className="nb-chip bg-[#FEF3C7] text-[#854D0E]">
                  Indicative local yield estimate
                </p>
              )}
              <Row
                label={t("yldPerHaTitle")}
                value={`${fmt(yld.yieldPerHa.min)} – ${fmt(yld.yieldPerHa.max)}`}
                extra={`≈ ${fmt(yld.yieldPerHa.avg)}`}
              />
              <Row
                label={t("yldProductionTitle")}
                value={`${yld.productionQuintals.typ} q`}
                extra={`${yld.productionQuintals.min} – ${yld.productionQuintals.max} q`}
              />
              {yld.conditionAdjusted && (
                <span className="nb-chip bg-[#5fa8e8] text-[#141414]">
                  ⚙ {t("yldAdjustedChip")}
                </span>
              )}
              <p className="nb-border bg-[#ede7d8] px-3 py-2 text-[10px] font-bold uppercase">
                ℹ {t("yldDisclaimer")}
              </p>
            </>
          )}
        </TabsContent>

        {/* ---------------- Market ---------------- */}
        <TabsContent value="market" className="mt-0 space-y-3">
          {!crop ? (
            <p className="nb-border bg-[#ede7d8] px-3 py-2 text-[11px] font-bold">
              ✏️ {t("planFillHint")}
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void loadMandi()}
                disabled={mandiBusy}
                className="nb-press w-full bg-[#141414] px-4 py-2.5 text-xs font-bold uppercase text-white"
              >
                {mandiBusy ? t("mktLoading") : `📈 ${t("mktLoad")}`}
              </button>

              {displayedMandi?.available && !mandi?.available && (
                <p className="nb-border bg-[#FEF3C7] px-3 py-2 text-[10px] font-semibold text-[#854D0E]">
                  Indicative Karnataka APMC estimate · verify current rates before selling.
                </p>
              )}
              {displayedMandi == null ? null : !displayedMandi.available ? (
                <p className="nb-border bg-[#d64545] px-3 py-2 text-[11px] font-bold text-white">
                  {displayedMandi.reason === "missing_key"
                    ? `🔑 ${t("mktNoKey")}`
                    : displayedMandi.reason === "no_data"
                      ? `📭 ${t("mktNoData")}`
                      : displayedMandi.reason === "rate_limited"
                        ? `⏳ ${t("mktRateLimited")}`
                        : `⚠ ${t("errorGeneric")}${displayedMandi.detail ? ` (${displayedMandi.detail})` : ""}`}
                </p>
              ) : (
                <>
                  <div className="nb-border bg-[#e2694e] p-3 text-white">
                    <p className="text-[10px] font-bold uppercase tracking-widest">
                      {t("mktModal")} · {displayedMandi.commodity}
                    </p>
                    <p className="font-display text-2xl leading-tight">
                      {inr(displayedMandi.price.avg)}
                    </p>
                    <p className="text-[11px] font-semibold text-white/85">
                      {t("mktRange")}: {inr(displayedMandi.price.min)} – {inr(displayedMandi.price.max)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="nb-chip bg-white text-[#141414]">
                        {t("mktLatest")}: {displayedMandi.latestDate}
                      </span>
                      {displayedMandi.trend && (
                        <span className="nb-chip bg-[#ffc53d] text-[#141414]">
                          {displayedMandi.trend.direction === "up"
                            ? `▲ ${t("trendUp", { pct: displayedMandi.trend.pct ?? 0 })}`
                            : displayedMandi.trend.direction === "down"
                              ? `▼ ${t("trendDown", { pct: Math.abs(displayedMandi.trend.pct ?? 0) })}`
                              : `▬ ${t("trendFlat")}`}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#5c574b]">
                    {t("mktTop")}
                  </p>
                  {displayedMandi.markets.map((m) => (
                    <Row
                      key={`${m.market}-${m.modal}`}
                      label={`🏪 ${m.market}${m.district ? `, ${m.district}` : ""}`}
                      value={inr(m.modal)}
                    />
                  ))}
                  <p className="nb-border bg-[#ede7d8] px-3 py-2 text-[10px] font-bold uppercase">
                    ℹ {t("mktDisclaimer")}
                  </p>
                </>
              )}
            </>
          )}
        </TabsContent>

        {/* ---------------- Revenue ---------------- */}
        <TabsContent value="revenue" className="mt-0 space-y-3">
          {!crop || !areaReady ? (
            <p className="nb-border bg-[#ede7d8] px-3 py-2 text-[11px] font-bold">
              ✏️ {t("planFillHint")}
            </p>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest">
                  {t("priceLabel")}
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    className="nb-input flex-1"
                    value={price || String(localMarketPrice)}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                  {displayedMandi?.available && (
                    <button
                      type="button"
                      onClick={() => setPrice(String(displayedMandi.price.avg))}
                      className="nb-press bg-[#5fa8e8] px-3 text-[10px] font-bold uppercase text-[#141414]"
                    >
                      {t("useMarket")}
                    </button>
                  )}
                </div>
              </div>

              {!priceReady ? (
                <p className="nb-border bg-[#ede7d8] px-3 py-2 text-[11px] font-bold">
                  ✏️ {t("priceLabel")}
                </p>
              ) : !rev ? (
                <p className="text-sm font-bold uppercase">{t("loading")}</p>
              ) : (
                <>
                  {!remoteRev && (
                    <p className="nb-chip bg-[#FEF3C7] text-[#854D0E]">
                      Indicative local revenue at {inr(priceNum)} / quintal
                    </p>
                  )}
                  <Row
                    label={t("revProduction")}
                    value={`${rev.productionQuintals.typ} q`}
                    extra={`${rev.productionQuintals.min} – ${rev.productionQuintals.max} q`}
                  />
                  <div className="nb-shadow-lg border-2 border-[#141414] bg-[#a9744f] p-4 text-white">
                    <p className="text-[10px] font-bold uppercase tracking-widest">
                      💰 {t("revTitle")}
                    </p>
                    <p className="font-display text-2xl leading-tight">
                      {inr(rev.revenue.typ)}
                    </p>
                    <p className="text-[11px] font-semibold text-white/85">
                      {t("revLow")} {inr(rev.revenue.min)} · {t("revHigh")}{" "}
                      {inr(rev.revenue.max)}
                    </p>
                  </div>
                  <p className="nb-border bg-[#ffc53d] px-3 py-2 text-[10px] font-bold uppercase">
                    ⚠ {t("revDisclaimer")}
                  </p>
                </>
              )}
            </>
          )}
        </TabsContent>
        {/* ---------------- Price Forecast ---------------- */}
        <TabsContent value="forecast" className="mt-0">
          <PriceForecast />
        </TabsContent>
      </Tabs>
    </div>
  );
}
