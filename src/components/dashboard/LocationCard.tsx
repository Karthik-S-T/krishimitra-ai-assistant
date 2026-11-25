import { useAction } from "convex/react";
import { useState, type Dispatch, type SetStateAction } from "react";
import { api } from "@/convex/_generated/api";
import type { GeocodeHit } from "@/convex/weather";
import { useLang } from "@/context/LanguageContext";
import { KARNATAKA_DISTRICTS } from "@/lib/districts";
import { ManualLocationCard } from "@/components/dashboard/ManualLocationCard";
import type { ManualLocation } from "@/components/dashboard/ManualLocationCard";

export interface FarmLocation {
  label: string;
  lat: number;
  lon: number;
  source: "gps" | "manual" | "search";
}

interface Props {
  loc: FarmLocation | null;
  setLoc: Dispatch<SetStateAction<FarmLocation | null>>;
}

export function LocationCard({ loc, setLoc }: Props) {
  const { t } = useLang();
  const geocodeSearch = useAction(api.weather.geocodeSearch);
  const [gpsState, setGpsState] = useState<"idle" | "locating" | "denied" | "error">("idle");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeocodeHit[] | null>(null);
  const [searching, setSearching] = useState(false);

  /** Manual State→District→Taluk→Village → approximate coords feed the same
   * pipeline (weather/soil/rain) as GPS, labelled source "manual". If the
   * village could not be geocoded, fall back to the district headquarters
   * coordinates (still approximate — never claimed as the exact farm). */
  const applyManual = (m: ManualLocation) => {
    let lat = m.approxLat;
    let lon = m.approxLon;
    if ((lat == null || lon == null) && m.state === "Karnataka") {
      const d = KARNATAKA_DISTRICTS.find((x) => x.name === m.district);
      if (d) {
        lat = d.lat;
        lon = d.lon;
      }
    }
    if (lat != null && lon != null) {
      setLoc({
        label: `${m.village}, ${m.taluk}, ${m.district}`,
        lat,
        lon,
        source: "manual",
      });
    }
  };

  const detect = () => {
    if (!("geolocation" in navigator)) {
      setGpsState("error");
      return;
    }
    setGpsState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsState("idle");
        setLoc({
          label: `${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          source: "gps",
        });
      },
      (err) => {
        setGpsState(err.code === err.PERMISSION_DENIED ? "denied" : "error");
      },
      { timeout: 10000, maximumAge: 300000 },
    );
  };

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      setHits(await geocodeSearch({ name: q }));
    } catch {
      setHits([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="nb-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xl">📍</span>
        <h2 className="font-display text-base uppercase">{t("locTitle")}</h2>
      </div>
      <p className="mb-4 text-xs font-medium text-[#5c574b]">{t("locDesc")}</p>

      {loc ? (
        <div className="nb-border bg-[#2fa35c] p-3 text-white">
          <p className="text-sm font-bold">✅ {loc.label}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-white/80">
            {t("selectedCoords")}: {loc.lat.toFixed(4)}, {loc.lon.toFixed(4)}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoc(null);
              setGpsState("idle");
              setHits(null);
              setQuery("");
            }}
            className="nb-press mt-3 bg-white px-3 py-1 text-[11px] font-bold uppercase text-[#141414]"
          >
            {t("changeLoc")}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Easy default: State → District → Taluk → Village (real data) */}
          <ManualLocationCard onConfirm={applyManual} />

          <div className="flex items-center gap-3">
            <span className="h-[2px] flex-1 bg-[#141414]/20" />
            <span className="text-[11px] font-bold uppercase text-[#5c574b]">
              {t("orPick")}
            </span>
            <span className="h-[2px] flex-1 bg-[#141414]/20" />
          </div>

          <button
            type="button"
            onClick={detect}
            disabled={gpsState === "locating"}
            className="nb-press w-full bg-[#ffc53d] px-4 py-3 text-sm font-bold uppercase"
          >
            {gpsState === "locating" ? t("detecting") : `🛰️ ${t("detectBtn")}`}
          </button>
          {gpsState === "denied" && (
            <p className="nb-border bg-[#d64545] px-3 py-2 text-xs font-bold text-white">
              ⚠ {t("gpsDenied")}
            </p>
          )}
          {gpsState === "error" && (
            <p className="nb-border bg-[#d64545] px-3 py-2 text-xs font-bold text-white">
              ⚠ {t("errorGeneric")}
            </p>
          )}

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest">
              {t("districtLabel")}
            </label>
            <select
              className="nb-input"
              value=""
              onChange={(e) => {
                const d = KARNATAKA_DISTRICTS.find((x) => x.name === e.target.value);
                if (!d) return;
                setLoc({
                  label: `${d.name}, Karnataka`,
                  lat: d.lat,
                  lon: d.lon,
                  source: "manual",
                });
              }}
            >
              <option value="" disabled>
                — {t("districtLabel")} —
              </option>
              {KARNATAKA_DISTRICTS.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest">
              {t("searchLabel")}
            </label>
            <div className="flex gap-2">
              <input
                className="nb-input flex-1"
                value={query}
                placeholder={t("searchPlaceholder")}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void search();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => void search()}
                disabled={searching}
                className="nb-press bg-[#141414] px-4 text-xs font-bold uppercase text-white"
              >
                {searching ? "…" : "🔍"}
              </button>
            </div>
            {hits && hits.length === 0 && (
              <p className="mt-2 text-xs font-semibold text-[#5c574b]">
                {t("locSearchNo")}
              </p>
            )}
            {hits && hits.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {hits.map((h) => (
                  <button
                    key={`${h.name}-${h.latitude}-${h.longitude}`}
                    type="button"
                    onClick={() =>
                      setLoc({
                        label: [h.name, h.admin1].filter(Boolean).join(", "),
                        lat: h.latitude,
                        lon: h.longitude,
                        source: "search",
                      })
                    }
                    className="nb-press flex w-full items-center justify-between bg-white px-3 py-2 text-left text-xs font-bold"
                  >
                    <span>
                      {h.name}
                      {h.admin1 ? (
                        <span className="ml-1 font-medium text-[#5c574b]">
                          · {h.admin1}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[10px] uppercase text-[#5c574b]">
                      {h.country}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
