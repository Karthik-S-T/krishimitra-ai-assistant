import { useAction } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { api } from "@/convex/_generated/api";
import type { SatelliteResponse } from "@/convex/satellite";
import { Button } from "@/components/ui/button";
import { useLang } from "@/context/LanguageContext";
import "leaflet/dist/leaflet.css";

/**
 * KrishiMitra AI — Phase 6: real satellite monitoring (Sentinel-2 L2A via
 * Earth Search STAC + TiTiler, called from the Convex action — no keys in
 * the browser). Displays the actual clipped scene, real NDVI/EVI/NDWI
 * statistics with their band formulas, per-scene observations and a trend
 * chart. NEVER fabricates imagery or index values: every failure state is
 * honest (no imagery / provider error / missing boundary).
 */

type LayerKey = "rgb" | "ndvi" | "evi" | "ndwi";
type LatLngTuple = [number, number];

function IndexCard({
  title,
  formula,
  bands,
  stats,
  meanLabel,
  minLabel,
  maxLabel,
}: {
  title: string;
  formula: string;
  bands: string;
  stats: { mean: number; min: number; max: number; stdev: number } | null;
  meanLabel: string;
  minLabel: string;
  maxLabel: string;
}) {
  return (
    <div className="border-2 border-[#141414] bg-white p-2.5 nb-shadow-sm">
      <p className="font-display text-sm uppercase">{title}</p>
      {stats ? (
        <>
          <div className="mt-1 grid grid-cols-3 gap-1 text-center text-xs font-bold">
            <div>
              <p className="text-[9px] font-bold uppercase text-[#5c574b]">{meanLabel}</p>
              <p>{stats.mean.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase text-[#5c574b]">{minLabel}</p>
              <p>{stats.min.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase text-[#5c574b]">{maxLabel}</p>
              <p>{stats.max.toFixed(3)}</p>
            </div>
          </div>
          <p className="mt-1.5 text-[9px] font-medium leading-tight text-[#5c574b]">
            {formula} · {bands}
          </p>
        </>
      ) : (
        <p className="mt-1 text-[10px] font-semibold text-[#5c574b]">—</p>
      )}
    </div>
  );
}

export function SatellitePanel({
  boundary,
}: {
  boundary: number[][] | undefined | null;
}) {
  const { t } = useLang();
  const getSatelliteAnalysis = useAction(api.satellite.getSatelliteAnalysis);

  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const polyRef = useRef<L.Polygon | null>(null);
  const urlByKey = useRef<Record<string, string>>({});

  const [days, setDays] = useState(120);
  const [maxCloud, setMaxCloud] = useState(20);
  const [layer, setLayer] = useState<LayerKey>("rgb");
  const [showBoundary, setShowBoundary] = useState(true);
  const [res, setRes] = useState<SatelliteResponse | null>(null);
  const [phase, setPhase] = useState<"idle" | "searching">("idle");
  const [error, setError] = useState<string | null>(null);

  const hasBoundary = Boolean(boundary && boundary.length >= 3);

  const cacheKey = useMemo(
    () =>
      boundary && boundary.length >= 3
        ? `s2|${boundary.map((p) => p.map((x) => x.toFixed(4)).join(",")).join(";")}|${days}|${maxCloud}`
        : null,
    [boundary, days, maxCloud],
  );

  // ---- map bootstrap (runs once the container div exists) -----------------
  useEffect(() => {
    if (mapRef.current || !mapElRef.current || !hasBoundary) return;
    const map = L.map(mapElRef.current, { zoomControl: true }).setView([14.6, 75.6], 6);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
      polyRef.current = null;
    };
  }, [hasBoundary]);

  // ---- run analysis --------------------------------------------------------
  const run = useCallback(async () => {
    if (!boundary || boundary.length < 3) return;
    setPhase("searching");
    setError(null);
    setRes(null);
    try {
      const out = (await getSatelliteAnalysis({
        boundary: boundary as [number, number][],
        days,
        maxCloud,
      })) as SatelliteResponse;
      if (out.ok) {
        urlByKey.current = {
          rgb: out.layers.rgb,
          ndvi: out.layers.ndvi,
          evi: out.layers.evi,
          ndwi: out.layers.ndwi,
        };
      }
      setRes(out);
    } catch {
      setError(t("satError"));
    } finally {
      setPhase("idle");
    }
  }, [boundary, days, maxCloud, getSatelliteAnalysis, t]);

  // auto-fetch once per boundary+config
  const ranForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!cacheKey || ranForRef.current === cacheKey) return;
    ranForRef.current = cacheKey;
    void run();
  }, [cacheKey, run]);

  // ---- overlay switching ----------------------------------------------------
  const bounds = useMemo(() => {
    if (!res || !res.ok) return null;
    const b = res.bounds;
    return L.latLngBounds([b.south, b.west], [b.north, b.east]);
  }, [res]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (overlayRef.current) {
      map.removeLayer(overlayRef.current);
      overlayRef.current = null;
    }
    if (!res || !res.ok || !bounds) return;
    const url = urlByKey.current[layer];
    if (!url) return;
    const overlay = L.imageOverlay(url, bounds, { opacity: 0.85 });
    overlay.addTo(map);
    overlayRef.current = overlay;
    map.fitBounds(bounds, { padding: [20, 20] });
  }, [layer, res, bounds]);

  // ---- farm boundary outline -------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (polyRef.current) {
      map.removeLayer(polyRef.current);
      polyRef.current = null;
    }
    if (showBoundary && boundary && boundary.length >= 3) {
      polyRef.current = L.polygon(boundary as L.LatLngTuple[], {
        color: "#ffc53d",
        weight: 2,
        fill: false,
      }).addTo(map);
      if (!bounds) {
        map.fitBounds(L.latLngBounds(boundary as L.LatLngTuple[]), { padding: [24, 24] });
      }
    }
  }, [showBoundary, boundary, bounds]);

  // ---- render ------------------------------------------------------------------
  if (!hasBoundary) {
    return (
      <p className="border-2 border-[#141414] bg-[#fbbf24]/25 px-3 py-2 text-xs font-semibold">
        {t("satNeedBoundary")}
      </p>
    );
  }

  const ok = res && res.ok ? res : null;
  const failed = res && !res.ok ? res : null;

  return (
    <div className="space-y-3">
      {/* config */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-bold uppercase">
          {t("satDays")}
          <input
            type="number"
            min={30}
            max={365}
            value={days}
            onChange={(e) => setDays(Math.max(30, Math.min(365, Number(e.target.value) || 120)))}
            className="ml-2 w-20 border-2 border-[#141414] bg-white px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs font-bold uppercase">
          {t("satCloud")}
          <input
            type="number"
            min={5}
            max={80}
            value={maxCloud}
            onChange={(e) => setMaxCloud(Math.max(5, Math.min(80, Number(e.target.value) || 20)))}
            className="ml-2 w-16 border-2 border-[#141414] bg-white px-2 py-1 text-sm"
          />
        </label>
        <Button type="button" size="sm" variant="outline" onClick={() => void run()}>
          🔄 {t("satSearch")}
        </Button>
      </div>

      {phase === "searching" && (
        <p className="border-2 border-[#141414] bg-white px-3 py-2 text-xs font-semibold nb-shadow-sm">
          ⏳ {t("satSearching")}
        </p>
      )}
      {error && (
        <div className="space-y-2">
          <p className="border-2 border-[#141414] bg-[#f87171]/20 px-3 py-2 text-xs font-semibold">
            {t("satError")}
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => void run()}>
            🔄 {t("satRetry")}
          </Button>
        </div>
      )}
      {failed && (
        <div className="space-y-2">
          <p className="border-2 border-[#141414] bg-[#fbbf24]/25 px-3 py-2 text-xs font-semibold">
            {failed.reason === "no_imagery" ? t("satNoImagery") : t("satError")}
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => void run()}>
            🔄 {t("satRetry")}
          </Button>
        </div>
      )}

      {/* map */}
      <div ref={mapElRef} className="h-64 w-full border-2 border-[#141414] nb-shadow-sm sm:h-72" />

      {ok && (
        <>
          {/* layer buttons */}
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["rgb", t("layerRgb")],
                ["ndvi", t("layerNdvi")],
                ["evi", t("layerEvi")],
                ["ndwi", t("layerNdwi")],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setLayer(key)}
                className={`border-2 border-[#141414] px-2.5 py-1 text-[10px] font-bold uppercase nb-shadow-sm ${
                  layer === key ? "bg-[#ffc53d]" : "bg-white"
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowBoundary((s) => !s)}
              className={`border-2 border-[#141414] px-2.5 py-1 text-[10px] font-bold uppercase nb-shadow-sm ${
                showBoundary ? "bg-[#7fb069]/60" : "bg-white"
              }`}
            >
              {t("layerBnd")}
            </button>
          </div>

          {/* metadata */}
          <div className="border-2 border-[#141414] bg-white px-3 py-2 text-xs font-semibold nb-shadow-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
              <span>
                {t("satAcquired")}: <b>{ok.scene.date}</b>
              </span>
              <span>
                {t("satCloudPct")}: <b>{ok.scene.cloudPct.toFixed(1)}%</b>
              </span>
              <span>
                {t("satScene")}: <b>{ok.scene.satellite}</b>
              </span>
              <span>
                {t("wfUpdated")}: <b>{new Date(ok.fetchedAt).toLocaleTimeString()}</b>
              </span>
            </div>
          </div>

          {/* index cards */}
          <div className="grid gap-2 sm:grid-cols-3">
            <IndexCard
              title="NDVI"
              formula={ok.indices.ndvi.formula}
              bands={ok.indices.ndvi.bands}
              stats={ok.indices.ndvi.stats}
              meanLabel={t("satMean")}
              minLabel={t("satMin")}
              maxLabel={t("satMax")}
            />
            <IndexCard
              title="EVI"
              formula={ok.indices.evi.formula}
              bands={ok.indices.evi.bands}
              stats={ok.indices.evi.stats}
              meanLabel={t("satMean")}
              minLabel={t("satMin")}
              maxLabel={t("satMax")}
            />
            <IndexCard
              title="NDWI"
              formula={ok.indices.ndwi.formula}
              bands={ok.indices.ndwi.bands}
              stats={ok.indices.ndwi.stats}
              meanLabel={t("satMean")}
              minLabel={t("satMin")}
              maxLabel={t("satMax")}
            />
          </div>

          {/* trend chart (NDVI per scene) */}
          {ok.observations.filter((o) => o.ndvi !== null).length >= 2 ? (
            <div className="border-2 border-[#141414] bg-white p-3 nb-shadow-sm">
              <p className="mb-2 font-display text-sm uppercase">{t("satTrend")}</p>
              <div className="flex h-32 items-end gap-1">
                {ok.observations.map((o) => {
                  const h =
                    o.ndvi === null ? 4 : Math.max(4, Math.round(((o.ndvi + 1) / 2) * 100));
                  return (
                    <div key={o.date} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-[9px] font-bold">
                        {o.ndvi === null ? "—" : o.ndvi.toFixed(2)}
                      </span>
                      <div
                        className="w-full border-2 border-[#141414] bg-[#7fb069]"
                        style={{ height: `${h}%` }}
                        title={`${o.date} · cloud ${o.cloudPct.toFixed(0)}%`}
                      />
                      <span className="text-[8px] font-semibold text-[#5c574b]">
                        {o.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="border-2 border-[#141414] bg-white px-3 py-2 text-xs font-semibold nb-shadow-sm">
              {t("satTrendInsufficient")}
            </p>
          )}

          {/* Spec: label as vegetation indicators — never soil NPK */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="nb-border bg-[#5fa8e8] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest">
              🛰️ {t("satVegChip")}
            </span>
          </div>

          <p className="text-[11px] font-medium leading-snug text-[#5c574b]">
            {t("satDisclaimer")}
          </p>
        </>
      )}
    </div>
  );
}
