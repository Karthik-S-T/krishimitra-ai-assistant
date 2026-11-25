import { useEffect, useState } from "react";
import { useLang } from "@/context/LanguageContext";
import type { SoilRainData, SoilTestInfo } from "@/convex/soilRain";
import type { FarmLocation } from "@/components/dashboard/LocationCard";

export type SoilRainDisplayData = Omit<SoilRainData, "soil"> & {
  soil:
    | SoilRainData["soil"]
    | {
        status: "regional-estimate";
        data: SoilTestInfo;
        reference?: SoilTestInfo | null;
      };
  rainSource?: string;
};

interface Props {
  loc: FarmLocation | null;
  data: SoilRainDisplayData | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  /** Open the Soil Health Card entry UI (SoilForm manual/SHC section). */
  onEnterSoilData: () => void;
  onUseRainfall: (mm: number) => void;
  onUseSoil: (v: {
    N: number;
    P: number;
    K: number;
    ph: number;
    testedOn: string;
    source: string;
    distanceKm: number | null;
    oc: number | null;
    ec: number | null;
    s: number | null;
  }) => void;
}

const fmtTime = (ms: number) =>
  new Date(ms).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export function SoilRainCard({
  loc,
  data,
  loading,
  error,
  onRefresh,
  onEnterSoilData,
  onUseRainfall,
  onUseSoil,
}: Props) {
  const { t, lang } = useLang();
  const [applied, setApplied] = useState(false);
  useEffect(() => {
    if (!applied) return;
    const id = window.setTimeout(() => setApplied(false), 2500);
    return () => window.clearTimeout(id);
  }, [applied]);

  const seasonName = (key: string) =>
    key === "kharif"
      ? t("srSeasonKharif")
      : key === "rabi"
        ? t("srSeasonRabi")
        : t("srSeasonZaid");

  const dev = data?.rain.deviationPct ?? null;
  const networkError = /network|timeout/i.test(error ?? "");
  const devColor =
    dev === null
      ? "bg-[#ede7d8]"
      : dev <= -20
        ? "bg-[#d64545] text-white"
        : dev >= 20
          ? "bg-[#5fa8e8] text-[#141414]"
          : "bg-[#2fa35c] text-white";

  return (
    <div className="nb-card p-5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧪</span>
          <h2 className="font-display text-base uppercase">{t("srTitle")}</h2>
        </div>
        {loc && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="nb-press bg-[#ffc53d] px-2.5 py-1 text-[10px] font-bold uppercase"
          >
            {loading ? t("srRefreshing") : `⟳ ${t("srRefresh")}`}
          </button>
        )}
      </div>
      <p className="mb-4 text-xs font-medium text-[#5c574b]">{t("srSub")}</p>

      {!loc ? (
        <p className="nb-border bg-[#ede7d8] px-3 py-3 text-xs font-semibold">
          📍 {t("srNeedLoc")}
        </p>
      ) : loading && !data ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="nb-border h-8 animate-pulse bg-[#ede7d8]" />
          ))}
        </div>
      ) : !data ? (
        networkError ? (
          <p className="nb-border bg-[#ede7d8] px-3 py-3 text-xs font-semibold text-[#5c574b]">
            {t("srSub")}
          </p>
        ) : (
          <div className="nb-border bg-[#d64545] p-3 text-white">
            <p className="text-xs font-bold">⚠ {t("srFailTitle")}</p>
            {error && (
              <p className="mt-1 text-[10px] font-semibold text-white/80">{error}</p>
            )}
          </div>
        )
      ) : (
        <div className="space-y-4">
          {/* Error / cached notice */}
          {error && !networkError && (
            <div className="nb-border bg-[#ffc53d] px-3 py-2">
              <p className="text-[11px] font-bold">⚠ {t("srFailTitle")}</p>
              <p className="text-[10px] font-semibold">
                {t("srCached")} {fmtTime(data.fetchedAt)}
              </p>
            </div>
          )}

          {/* Location */}
          <div className="nb-border bg-[#ede7d8] px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#5c574b]">
              {t("srLocLabel")}
            </p>
            <p className="text-sm font-bold">📍 {data.place.label}</p>
          </div>

          {/* Soil */}
          <div className="space-y-2">
            {/* Data status chip — always honest about provenance */}
            {data.soil.status !== "unavailable" && (
              <p>
                <span
                  className={`nb-border inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                    data.soil.status === "regional-estimate"
                      ? "bg-[#ffc53d] text-[#141414]"
                      : "bg-[#2fa35c] text-white"
                  }`}
                >
                  {data.soil.status === "regional-estimate"
                    ? lang === "kn"
                      ? "ಪ್ರಾದೇಶಿಕ ಅಂದಾಜು · ಪರೀಕ್ಷಿತವಲ್ಲ"
                      : lang === "hi"
                        ? "क्षेत्रीय अनुमान · जांचा नहीं गया"
                        : "Regional estimate · not tested"
                    : t("srStatusMeasured")}
                </span>
              </p>
            )}
            {data.soil.status === "unavailable" ? (
              <>
                <div className="nb-border bg-[#ffc53d] px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest">
                    {t("srStatusChip")}
                  </p>
                  <p className="text-xs font-bold">🚫 {t("srStatusUnavailable")}</p>
                  <p className="mt-1 text-[10px] font-semibold">
                    {t("srSoilUnavailableSub")}
                  </p>
                  <button
                    type="button"
                    onClick={onEnterSoilData}
                    className="nb-press mt-2 w-full bg-[#2fa35c] px-3 py-2 text-[11px] font-bold uppercase text-white"
                  >
                    📄 {t("srEnterShcBtn")}
                  </button>
                </div>
                {/* Honest "Unavailable" tiles — never estimated values */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="nb-border bg-white px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#5c574b]">
                      N · {t("perHa")}
                    </p>
                    <p className="text-sm font-bold text-[#5c574b]">
                      — {t("srUnavailableWord")}
                    </p>
                  </div>
                  <div className="nb-border bg-white px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#5c574b]">
                      P · {t("perHa")}
                    </p>
                    <p className="text-sm font-bold text-[#5c574b]">
                      — {t("srUnavailableWord")}
                    </p>
                  </div>
                  <div className="nb-border bg-white px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#5c574b]">
                      K · {t("perHa")}
                    </p>
                    <p className="text-sm font-bold text-[#5c574b]">
                      — {t("srUnavailableWord")}
                    </p>
                  </div>
                  <div className="nb-border bg-white px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#5c574b]">
                      pH
                    </p>
                    <p className="text-sm font-bold text-[#5c574b]">
                      — {t("srUnavailableWord")}
                    </p>
                  </div>
                </div>
                {/* Distant record: reference ONLY — never the farm's soil data */}
                {data.soil.reference && (
                  <div className="nb-border bg-[#ede7d8] px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#5c574b]">
                      {t("srNearbyRef")}
                    </p>
                    <p className="text-xs font-bold">{data.soil.reference.label}</p>
                    <p className="text-[11px] font-semibold">
                      {data.soil.reference.distanceKm !== null
                        ? t("srTooFar", { km: data.soil.reference.distanceKm })
                        : t("srOutsideRange")}
                    </p>
                    <span className="nb-border mt-1 inline-block bg-[#ffc53d] px-2 py-0.5 text-[9px] font-bold uppercase">
                      ⚠ {t("srOutsideRange")}
                    </span>
                    <p className="mt-1 text-[10px] font-semibold leading-snug text-[#b45309]">
                      ⚠ {t("srRefNotUsed")}
                    </p>
                  </div>
                )}
              </>
            ) : (
              (() => {
                const s = data.soil.data;
                return (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="nb-border bg-white px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#5c574b]">
                          pH
                        </p>
                        <p className="text-lg font-bold">{s.ph}</p>
                      </div>
                      <div className="nb-border bg-white px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#5c574b]">
                          N · {t("perHa")}
                        </p>
                        <p className="text-lg font-bold">{s.n}</p>
                      </div>
                      <div className="nb-border bg-white px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#5c574b]">
                          P · {t("perHa")}
                        </p>
                        <p className="text-lg font-bold">{s.p}</p>
                      </div>
                      <div className="nb-border bg-white px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#5c574b]">
                          K · {t("perHa")}
                        </p>
                        <p className="text-lg font-bold">{s.k}</p>
                      </div>
                    </div>
                    {(s.oc != null || s.ec != null || s.s != null) && (
                      <div className="grid grid-cols-3 gap-2">
                        {s.oc != null && (
                          <div className="nb-border bg-[#ede7d8] px-2 py-1.5">
                            <p className="text-[9px] font-bold uppercase text-[#5c574b]">OC %</p>
                            <p className="text-sm font-bold">{s.oc}</p>
                          </div>
                        )}
                        {s.ec != null && (
                          <div className="nb-border bg-[#ede7d8] px-2 py-1.5">
                            <p className="text-[9px] font-bold uppercase text-[#5c574b]">EC dS/m</p>
                            <p className="text-sm font-bold">{s.ec}</p>
                          </div>
                        )}
                        {s.s != null && (
                          <div className="nb-border bg-[#ede7d8] px-2 py-1.5">
                            <p className="text-[9px] font-bold uppercase text-[#5c574b]">S ppm</p>
                            <p className="text-sm font-bold">{s.s}</p>
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-[10px] font-medium text-[#5c574b]">
                      💡 {t("srNHelp")} · {t("srPHelp")} · {t("srKHelp")}
                    </p>
                    <p className="text-[10px] font-medium text-[#5c574b]">
                      💡 {t("srPhHelp")}
                    </p>
                    <div className="nb-border bg-[#ede7d8] px-3 py-2 text-[11px] font-semibold">
                      {s.distanceKm !== null && (
                        <p>
                          📍 {t("srDistanceAway", { km: s.distanceKm })} ·{" "}
                          {t("srTestedOn")}: {s.testedOn}
                        </p>
                      )}
                      <p className="mt-0.5">
                        <span className="nb-border mr-1 inline-block bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase">
                          {t("srStatusMeasured")}
                        </span>
                        {t("srSoilSource")}: {s.source}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          onUseSoil({
                            N: s.n,
                            P: s.p,
                            K: s.k,
                            ph: s.ph,
                            testedOn: s.testedOn,
                            source: s.source,
                            distanceKm: s.distanceKm,
                            oc: s.oc ?? null,
                            ec: s.ec ?? null,
                            s: s.s ?? null,
                          });
                          setApplied(true);
                        }}
                        className="nb-press mt-2 bg-[#2fa35c] px-3 py-1 text-[10px] font-bold uppercase text-white"
                      >
                        {applied ? t("srApplied") : t("srUseSoil")}
                      </button>
                    </div>
                  </>
                );
              })()
            )}
            {data.soil.status === "regional-estimate" && data.soil.reference && (
              <div className="nb-border bg-[#ede7d8] px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#5c574b]">
                  {t("srNearbyRef")}
                </p>
                <p className="text-xs font-bold">{data.soil.reference.label}</p>
                <p className="text-[11px] font-semibold">
                  {data.soil.reference.distanceKm !== null
                    ? t("srTooFar", { km: data.soil.reference.distanceKm })
                    : t("srOutsideRange")}
                </p>
                <p className="mt-1 text-[10px] font-semibold leading-snug text-[#b45309]">
                  ⚠ {t("srRefNotUsed")}
                </p>
              </div>
            )}
          </div>

          {/* Rainfall */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#5c574b]">
              🌧 {t("srRainSection")}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="nb-border bg-white px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#5c574b]">
                  {t("srRainSeasonal")}
                </p>
                <p className="text-lg font-bold">
                  {Math.round(data.rain.seasonalMm)}{" "}
                  <span className="text-xs font-semibold">mm</span>
                </p>
                <p className="text-[10px] font-semibold text-[#5c574b]">
                  {seasonName(data.rain.seasonKey)}
                </p>
              </div>
              <div className="nb-border bg-white px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#5c574b]">
                  {t("srRainNormal")}
                </p>
                <p className="text-lg font-bold">
                  {data.rain.normalMm !== null ? (
                    <>
                      {Math.round(data.rain.normalMm)}{" "}
                      <span className="text-xs font-semibold">mm</span>
                    </>
                  ) : (
                    <span className="text-sm font-bold text-[#5c574b]">
                      {t("srDataNA")}
                    </span>
                  )}
                </p>
                <p className="text-[10px] font-semibold text-[#5c574b]">
                  1991–2020
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`nb-border px-3 py-1.5 text-xs font-bold ${devColor}`}>
                {t("srRainDev")}:{" "}
                {dev !== null
                  ? dev <= -20
                    ? t("srDeficit", { pct: Math.abs(dev) })
                    : dev >= 20
                      ? t("srExcess", { pct: dev })
                      : t("srNearNormal")
                  : t("srDataNA")}
              </span>
              <span className="nb-border bg-[#ede7d8] px-3 py-1.5 text-xs font-bold">
                {t("srRecent")}: {Math.round(data.rain.recent7Mm)} mm
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                onUseRainfall(data.rain.seasonalMm);
                setApplied(true);
              }}
              className="nb-press w-full bg-[#5fa8e8] px-3 py-2 text-[11px] font-bold uppercase"
            >
              {applied ? `✓ ${t("srApplied")}` : `⬇ ${t("srUseRain")}`}
            </button>
          </div>

          {/* Footer */}
          <div className="nb-border bg-[#ede7d8] px-3 py-2 text-[10px] font-semibold">
            <p>
              {t("srLastUpdated")}: {fmtTime(data.fetchedAt)}
            </p>
            <p className="mt-0.5">
              {t("srDataSource")}: {data.rainSource ?? t("srRainSource")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
