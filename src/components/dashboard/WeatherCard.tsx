import { useLang } from "@/context/LanguageContext";
import { condKey, wmoInfo } from "@/lib/weatherCodes";
import type { FarmLocation } from "@/components/dashboard/LocationCard";
import type { WeatherResult } from "@/convex/weather";

interface Props {
  loc: FarmLocation | null;
  weather: WeatherResult | null;
  loading: boolean;
  error: string | null;
  estimated?: boolean;
  onRetry: () => void;
}

const LOCALE: Record<string, string> = { en: "en-IN", kn: "kn-IN", hi: "hi-IN" };

export function WeatherCard({
  loc,
  weather,
  loading,
  error,
  estimated = false,
  onRetry,
}: Props) {
  const { t, lang } = useLang();
  const locale = LOCALE[lang] ?? "en-IN";
  const networkError = /network|timeout/i.test(error ?? "");

  return (
    <div className="nb-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xl">🌦️</span>
        <h2 className="font-display text-base uppercase">{t("wTitle")}</h2>
      </div>

      {!loc ? (
        <p className="text-xs font-medium text-[#5c574b]">
          📍 {t("locDesc")}
        </p>
      ) : loading && !weather ? (
        <p className="text-sm font-semibold text-[#5c574b]">{t("wLoading")}</p>
      ) : error && !networkError ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="nb-border bg-[#d64545] px-3 py-2 text-xs font-bold text-white">
            ⚠ {t("wFailed")}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="nb-press bg-white px-3 py-1.5 text-xs font-bold uppercase"
          >
            {t("wRetry")}
          </button>
        </div>
      ) : weather ? (
        <>
          <div className="nb-border mb-3 bg-[#5fa8e8] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="text-4xl">
                  {wmoInfo(weather.current.weatherCode).emoji}
                </span>
                <div>
                  <p className="font-display text-2xl leading-none">
                    {Math.round(weather.current.temperature)}°C
                  </p>
                  <p className="text-xs font-bold">
                    {t(condKey(wmoInfo(weather.current.weatherCode).group))}
                  </p>
                </div>
              </div>
              {weather.place && (
                <p className="max-w-[45%] text-right text-[11px] font-bold leading-snug">
                  📍 {weather.place}
                </p>
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="nb-border bg-white px-1 py-1.5">
                <p className="text-[10px] font-bold uppercase text-[#5c574b]">
                  {t("humLabel")}
                </p>
                <p className="text-sm font-bold">
                  {Math.round(weather.current.humidity)}%
                </p>
              </div>
              <div className="nb-border bg-white px-1 py-1.5">
                <p className="text-[10px] font-bold uppercase text-[#5c574b]">
                  {t("wRainNow")}
                </p>
                <p className="text-sm font-bold">
                  {weather.current.precipitation.toFixed(1)}
                </p>
              </div>
              <div className="nb-border bg-white px-1 py-1.5">
                <p className="text-[10px] font-bold uppercase text-[#5c574b]">
                  {t("wWind")}
                </p>
                <p className="text-sm font-bold">
                  {Math.round(weather.current.windSpeed)}
                </p>
              </div>
            </div>
          </div>

          <p className="mb-3">
            <span className="nb-chip bg-[#ffc53d] text-[#141414]">
              ⚙ {estimated
                ? lang === "kn"
                  ? "ಪ್ರಾದೇಶಿಕ ಅಂದಾಜು"
                  : lang === "hi"
                    ? "क्षेत्रीय अनुमान"
                    : "Regional estimate"
                : t("wAuto")}
            </span>
          </p>

          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#5c574b]">
            {t("wForecast")}
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {weather.daily.map((d) => (
              <div
                key={d.date}
                className="nb-border bg-white px-1 py-2 text-center"
              >
                <p className="text-[10px] font-bold uppercase">
                  {new Date(d.date).toLocaleDateString(locale, {
                    weekday: "short",
                  })}
                </p>
                <p className="my-1 text-base">
                  {wmoInfo(d.code).emoji}
                </p>
                <p className="text-[11px] font-bold leading-tight">
                  {Math.round(d.tMax)}°
                </p>
                <p className="text-[10px] font-semibold text-[#5c574b]">
                  {Math.round(d.tMin)}°
                </p>
                <p className="mt-1 text-[10px] font-semibold text-[#2f6ea3]">
                  💧{d.precipSum.toFixed(1)}
                </p>
              </div>
            ))}
          </div>
        </>
      ) : networkError ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="nb-border bg-[#ede7d8] px-3 py-2 text-xs font-medium text-[#5c574b]">
            {t("wFailed")}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="nb-press bg-white px-3 py-1.5 text-xs font-bold uppercase"
          >
            {t("wRetry")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
