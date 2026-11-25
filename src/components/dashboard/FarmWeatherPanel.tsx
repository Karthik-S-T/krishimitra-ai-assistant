import { useAction } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { FarmWeather } from "@/convex/farmWeather";
import { Button } from "@/components/ui/button";
import { useLang } from "@/context/LanguageContext";

/**
 * KrishiMitra AI — Phase 5: live farm weather (Open-Meteo, via the Convex
 * action so no keys/calls happen in the browser). REAL data only — every
 * value comes from the provider; failures show an error state, never fake
 * numbers. Uses the saved farm coordinates (not a city default).
 */

const WMO_ICON: Record<number, string> = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌦️",
  61: "🌧️", 63: "🌧️", 65: "🌧️",
  66: "🌧️", 67: "🌧️",
  71: "🌨️", 73: "🌨️", 75: "🌨️", 77: "🌨️",
  80: "🌦️", 81: "🌧️", 82: "🌧️",
  85: "🌨️", 86: "🌨️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};

const DIR_TXT = (deg: number): string => {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-2 border-[#141414] bg-white px-2.5 py-2 nb-shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#5c574b]">{label}</p>
      <p className="mt-0.5 font-display text-sm">{value}</p>
    </div>
  );
}

export function FarmWeatherPanel({
  lat,
  lon,
}: {
  lat: number | null;
  lon: number | null;
}) {
  const { t } = useLang();
  const getFarmWeather = useAction(api.farmWeather.getFarmWeather);
  const [data, setData] = useState<FarmWeather | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchWeather = useCallback(async () => {
    if (lat === null || lon === null) return;
    setLoading(true);
    setError(false);
    try {
      const res = await getFarmWeather({ lat, lon });
      setData(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [lat, lon, getFarmWeather]);

  useEffect(() => {
    setData(null);
    setError(false);
    if (lat !== null && lon !== null) void fetchWeather();
  }, [lat, lon, fetchWeather]);

  if (lat === null || lon === null) {
    return (
      <p className="border-2 border-[#141414] bg-[#fbbf24]/25 px-3 py-2 text-xs font-semibold">
        {t("wfNeedLoc")}
      </p>
    );
  }

  if (loading) {
    return (
      <p className="border-2 border-[#141414] bg-white px-3 py-2 text-xs font-semibold nb-shadow-sm">
        ⏳ {t("wfLoading")}
      </p>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-2">
        <p className="border-2 border-[#141414] bg-[#f87171]/20 px-3 py-2 text-xs font-semibold">
          {t("wfError")}
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => void fetchWeather()}>
          🔄 {t("wfRetry")}
        </Button>
      </div>
    );
  }

  const c = data.current;
  const icon = WMO_ICON[c.weatherCode] ?? "🌡️";

  return (
    <div className="space-y-3">
      {/* Current */}
      <div className="border-2 border-[#141414] bg-white p-3 nb-shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-2xl">{Math.round(c.temperature)}°C</p>
            <p className="text-xs font-semibold text-[#5c574b]">
              {t("wfFeels")}: {Math.round(c.feelsLike)}°C
            </p>
          </div>
          <span className="text-4xl">{icon}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="💧 Humidity" value={`${Math.round(c.humidity)}%`} />
          <Stat label="🌧️ Rain" value={`${c.precipitation.toFixed(1)} mm`} />
          <Stat label="☔ Rain chance" value={`${Math.round(c.rainProbability)}%`} />
          <Stat
            label="💨 Wind"
            value={`${Math.round(c.windSpeed)} km/h ${DIR_TXT(c.windDirection)}`}
          />
        </div>
        <p className="mt-2 text-[10px] font-medium text-[#5c574b]">
          {t("wfUpdated")}: {new Date(data.fetchedAt).toLocaleTimeString()} · {data.source}
        </p>
      </div>

      {/* Hourly (next 12 h) */}
      <div>
        <p className="mb-1.5 font-display text-sm uppercase">{t("wfHourly")}</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {data.hourly.slice(0, 12).map((h) => (
            <div
              key={h.time}
              className="min-w-[76px] shrink-0 border-2 border-[#141414] bg-white px-2 py-2 text-center nb-shadow-sm"
            >
              <p className="text-[10px] font-bold uppercase text-[#5c574b]">
                {new Date(h.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="my-1 text-xl leading-none">{WMO_ICON[h.code] ?? "🌡️"}</p>
              <p className="font-display text-sm">{Math.round(h.temperature)}°C</p>
              <p className="text-[10px] font-semibold text-[#1d4ed8]">☔{h.precipProb}%</p>
              <p className="text-[10px] font-medium text-[#5c574b]">{h.precipMm.toFixed(1)}mm</p>
            </div>
          ))}
        </div>
      </div>

      {/* Daily (7 days) */}
      <div>
        <p className="mb-1.5 font-display text-sm uppercase">{t("wfDaily")}</p>
        <div className="space-y-1.5">
          {data.daily.map((d) => (
            <div
              key={d.date}
              className="flex items-center gap-3 border-2 border-[#141414] bg-white px-3 py-2 nb-shadow-sm"
            >
              <span className="w-12 text-xs font-bold uppercase">
                {new Date(d.date).toLocaleDateString([], { weekday: "short" })}
              </span>
              <span className="text-xl leading-none">{WMO_ICON[d.code] ?? "🌡️"}</span>
              <span className="font-display text-sm">
                {Math.round(d.tMin)}° / {Math.round(d.tMax)}°C
              </span>
              <span className="ml-auto text-right text-[10px] font-semibold leading-tight">
                <span className="block text-[#1d4ed8]">☔ {d.precipProb}%</span>
                <span className="block text-[#5c574b]">🌧️ {d.precipSum.toFixed(1)} mm</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
