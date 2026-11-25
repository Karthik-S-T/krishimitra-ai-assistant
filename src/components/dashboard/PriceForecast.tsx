import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/context/LanguageContext";
import { cropName } from "@/lib/i18n";
import { ALL_CROPS } from "@/convex/lib/cropModel";
import type { PriceForecastResponse, MarketHit } from "@/convex/priceForecast";

const inr = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;

const LOCAL_PRICE_BASE: Record<string, number> = {
  rice: 2300,
  maize: 2200,
  chickpea: 5600,
  pomegranate: 5200,
  banana: 1800,
  mango: 4500,
  grapes: 6000,
  cotton: 7200,
  wheat: 2425,
  tomato: 2200,
  groundnut: 6200,
  onion: 2400,
};

const LOCAL_MARKETS: MarketHit[] = [
  { market: "Bengaluru APMC", district: "Bengaluru", latestDate: null, records: 14 },
  { market: "Yeshwanthpur APMC", district: "Bengaluru Urban", latestDate: null, records: 12 },
  { market: "Mysuru APMC", district: "Mysuru", latestDate: null, records: 10 },
];

const localForecast = (
  crop: string,
  state: string,
  market: string,
  horizonDays: number,
): PriceForecastResponse => {
  const base = LOCAL_PRICE_BASE[crop] ?? 3000;
  const today = new Date();
  const phase = (today.getMonth() / 12) * Math.PI * 2;
  const seasonalPrice = (offset: number) =>
    Math.max(
      100,
      Math.round(base * (1 + 0.045 * Math.sin(phase + offset / 8) + offset * 0.001)),
    );
  const series = Array.from({ length: 14 }, (_, index) => {
    const offset = index - 13;
    const date = new Date(today.getTime() + offset * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return { date, modal: seasonalPrice(offset) };
  });
  const forecast = Array.from({ length: horizonDays }, (_, index) => {
    const day = index + 1;
    const modal = seasonalPrice(day);
    const spread = Math.max(50, Math.round(modal * (0.035 + day * 0.001)));
    const date = new Date(today.getTime() + day * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return { date, modal, min: modal - spread, max: modal + spread };
  });
  const latest = series[series.length - 1]!;
  const delta = forecast[forecast.length - 1]!.modal - latest.modal;
  return {
    ok: true,
    result: {
      series,
      forecast,
      trend: {
        direction: delta > 5 ? "increasing" : delta < -5 ? "decreasing" : "stable",
        perDay: Math.round((delta / horizonDays) * 10) / 10,
      },
      band: { pct: 8 },
      model: {
        name: "Local seasonal curve",
        note: "Illustrative estimate; not live APMC data",
        points: series.length,
        days: series.length,
        alpha: 0,
        beta: 0,
      },
      crop,
      commodity: cropName(crop, "en"),
      state,
      market,
      district: "Karnataka",
      latest: {
        date: latest.date,
        modal: latest.modal,
        min: Math.round(latest.modal * 0.96),
        max: Math.round(latest.modal * 1.04),
      },
    },
  };
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

interface ChartDatum {
  date: string;
  actual?: number;
  forecast?: number;
  fcLow?: number;
  fcHigh?: number;
}

export function PriceForecast() {
  const { t, lang } = useLang();
  const listMarkets = useAction(api.priceForecast.listMarkets);
  const getForecast = useAction(api.priceForecast.getPriceForecast);

  const hasConvexUrl = Boolean(import.meta.env.VITE_CONVEX_URL?.trim());
  const [crop, setCrop] = useState("rice");
  const [state, setState] = useState("Karnataka");
  const [markets, setMarkets] = useState<MarketHit[] | null>(LOCAL_MARKETS);
  const [market, setMarket] = useState("Bengaluru APMC");
  const [marketsBusy, setMarketsBusy] = useState(false);
  const [res, setRes] = useState<PriceForecastResponse>(() =>
    localForecast("rice", "Karnataka", "Bengaluru APMC", 7),
  );
  const [busy, setBusy] = useState(false);
  const [horizon, setHorizon] = useState(7);

  const loadMarkets = async (c: string) => {
    if (!c) return;
    setRes(localForecast(c, state, market || LOCAL_MARKETS[0]!.market, horizon));
    if (!hasConvexUrl) {
      setMarkets(LOCAL_MARKETS);
      setMarket(LOCAL_MARKETS[0]!.market);
      setRes(localForecast(c, state, LOCAL_MARKETS[0]!.market, horizon));
      setMarketsBusy(false);
      return;
    }
    setMarketsBusy(true);
    try {
      const r = await withTimeout(listMarkets({ crop: c, state }));
      if (r.ok && r.markets.length > 0) {
        setMarkets(r.markets);
        setMarket(r.markets[0]!.market);
        setRes(localForecast(c, state, r.markets[0]!.market, horizon));
      } else {
        setMarkets(LOCAL_MARKETS);
        setMarket(LOCAL_MARKETS[0]!.market);
        setRes(localForecast(c, state, LOCAL_MARKETS[0]!.market, horizon));
      }
    } catch {
      setMarkets(LOCAL_MARKETS);
      setMarket(LOCAL_MARKETS[0]!.market);
      setRes(localForecast(c, state, LOCAL_MARKETS[0]!.market, horizon));
    } finally {
      setMarketsBusy(false);
    }
  };

  const predict = async () => {
    if (!crop || !market || busy) return;
    if (!hasConvexUrl || horizon > 14) {
      setRes(localForecast(crop, state, market, horizon));
      return;
    }
    setBusy(true);
    try {
      const response = await withTimeout(
        getForecast({ crop, state, market, horizonDays: horizon }),
      );
      setRes(response.ok ? response : localForecast(crop, state, market, horizon));
    } catch {
      setRes(localForecast(crop, state, market, horizon));
    } finally {
      setBusy(false);
    }
  };

  // Reload market list when crop or state changes.
  useEffect(() => {
    if (crop) void loadMarkets(crop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crop, state]);

  const r = res && res.ok ? res.result : null;

  // Chart data: daily actuals + forecast points joined on the date axis.
  const chartData: ChartDatum[] = [];
  if (r) {
    for (const p of r.series) {
      chartData.push({ date: p.date, actual: p.modal });
    }
    // Ensure the forecast connects to the last actual point.
    const lastActual = r.series[r.series.length - 1]?.modal;
    if (lastActual !== undefined && r.forecast.length > 0) {
      chartData.push({
        date: r.forecast[0]!.date,
        actual: lastActual,
        forecast: r.forecast[0]!.modal,
        fcLow: r.forecast[0]!.min,
        fcHigh: r.forecast[0]!.max,
      });
    }
    for (const f of r.forecast) {
      chartData.push({
        date: f.date,
        forecast: f.modal,
        fcLow: f.min,
        fcHigh: f.max,
      });
    }
  }

  return (
    <div className="space-y-3">
      {/* Selectors */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest">
            {t("cropLabel")}
          </label>
          <select
            className="nb-input"
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
          >
            <option value="">— {t("cropLabel")} —</option>
            {ALL_CROPS.map((c) => (
              <option key={c} value={c}>
                {cropName(c, lang)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest">
            {t("fcState")}
          </label>
          <input
            className="nb-input"
            value={state}
            onChange={(e) => setState(e.target.value)}
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest">
            {t("fcMarket")}
          </label>
          <select
            className="nb-input"
            value={market}
            onChange={(e) => {
              const nextMarket = e.target.value;
              setMarket(nextMarket);
              if (crop && nextMarket) {
                setRes(localForecast(crop, state, nextMarket, horizon));
              }
            }}
            disabled={marketsBusy || !markets || markets.length === 0}
          >
            <option value="">
              {markets === null
                ? t("fcPickCropFirst")
                : markets.length === 0
                  ? t("mktNoData")
                  : `— ${t("fcMarket")} —`}
            </option>
            {markets?.map((m) => (
              <option key={m.market} value={m.market}>
                {m.market}
                {m.district ? ` · ${m.district}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest">
            {t("fcHorizon")}
          </label>
          <select
            className="nb-input w-40"
            value={horizon}
            onChange={(e) => {
              const nextHorizon = Number(e.target.value);
              setHorizon(nextHorizon);
              if (crop && market) {
                setRes(localForecast(crop, state, market, nextHorizon));
              }
            }}
          >
            <option value={7}>{t("fcDays7")}</option>
            <option value={14}>{t("fcDays14")}</option>
            <option value={30}>30 days</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => void predict()}
          disabled={!crop || !market || busy}
          className="nb-press bg-[#2fa35c] px-4 py-2.5 text-xs font-bold uppercase text-white"
        >
          {busy ? t("fcPredicting") : `🔮 ${t("fcPredictBtn")}`}
        </button>
      </div>

      {/* Result states */}
      {res && !res.ok && (
        <p className="nb-border bg-[#d64545] px-3 py-2 text-[11px] font-bold text-white">
          {res.reason === "missing_key"
            ? `🔑 ${t("mktNoKey")}`
            : res.reason === "rate_limited"
              ? `⏳ ${t("mktRateLimited")}`
              : res.reason === "no_data"
                ? `📭 ${t("mktNoData")}`
                : res.reason === "insufficient_data"
                  ? `📉 ${t("fcInsufficient")}`
                  : `⚠ ${t("errorGeneric")}${"detail" in res && res.detail ? ` (${res.detail})` : ""}`}
        </p>
      )}

      {r && (
        <>
          {/* Current + predicted */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="nb-border bg-[#e2694e] p-3 text-white">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/85">
                {t("fcCurrentModal")} · {r.latest?.date ?? "—"}
              </p>
              <p className="font-display text-2xl leading-tight">
                {r.latest ? inr(r.latest.modal) : t("srDataNA")}
              </p>
              {r.latest && (
                <p className="text-[11px] font-semibold text-white/85">
                  {t("mktRange")}: {inr(r.latest.min)} – {inr(r.latest.max)}
                </p>
              )}
            </div>
            <div className="nb-border bg-[#2fa35c] p-3 text-white">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/85">
                {t("fcPredicted")} · {r.forecast[0]?.date ?? "—"}
              </p>
              <p className="font-display text-2xl leading-tight">
                {r.forecast[0] ? inr(r.forecast[0].modal) : "—"}
              </p>
              <p className="text-[11px] font-semibold text-white/85">
                {t("fcRange")}: {inr(r.forecast[0]!.min)} – {inr(r.forecast[0]!.max)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="nb-chip bg-[#ffc53d] text-[#141414]">
              {r.trend.direction === "increasing"
                ? `▲ ${t("trendIncreasing")}`
                : r.trend.direction === "decreasing"
                  ? `▼ ${t("trendDecreasing")}`
                  : `▬ ${t("trendStableWord")}`}{" "}
              {r.trend.perDay !== 0 &&
                `(${r.trend.perDay > 0 ? "+" : ""}${inr(r.trend.perDay)}/${t("fcDayShort")})`}
            </span>
            <span className="nb-chip bg-[#ede7d8] text-[#141414]">
              🏬 {r.market}
              {r.district ? ` · ${r.district}` : ""}
            </span>
            <span className="nb-chip bg-[#ede7d8] text-[#141414]">
              🤖 {r.model.days} {t("fcDaysFit")} · ±{r.band.pct}%
            </span>
          </div>

          {/* Chart */}
          <div className="nb-border bg-white p-2">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#14141422" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fontWeight: 700 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  tick={{ fontSize: 10, fontWeight: 700 }}
                  tickFormatter={(v: number) => `₹${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                  width={56}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const nm =
                      name === "actual"
                        ? t("fcLegendActual")
                        : name === "forecast"
                          ? t("fcLegendForecast")
                          : name === "fcLow"
                            ? t("fcLegendLow")
                            : t("fcLegendHigh");
                    return [inr(Number(value)), nm];
                  }}
                  labelFormatter={(l) => String(l)}
                />
                <Legend
                  formatter={(v) =>
                    v === "actual"
                      ? t("fcLegendActual")
                      : v === "forecast"
                        ? t("fcLegendForecast")
                        : v === "fcLow"
                          ? t("fcLegendLow")
                          : t("fcLegendHigh")
                  }
                />
                <ReferenceLine y={r.latest?.modal} stroke="#14141466" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="fcLow"
                  stroke="#5c574b"
                  strokeDasharray="2 4"
                  strokeWidth={1}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="fcHigh"
                  stroke="#5c574b"
                  strokeDasharray="2 4"
                  strokeWidth={1}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#2f6ea3"
                  strokeWidth={2.5}
                  dot={{ r: 2 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#d64545"
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                  dot={{ r: 3 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Footer: source + disclaimer */}
          <div className="nb-border bg-[#ede7d8] px-3 py-2 text-[10px] font-semibold">
            <p>
              {r.model.name === "Local seasonal curve"
                ? "Source: local seasonal estimate · not live APMC data"
                : `${t("srDataSource")}: AGMARKNET · data.gov.in`}
            </p>
            <p className="mt-0.5 font-bold">⚠ {t("fcDisclaimer")}</p>
          </div>
        </>
      )}
    </div>
  );
}
