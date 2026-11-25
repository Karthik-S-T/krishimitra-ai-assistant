import { useAction, useMutation, useQuery } from "convex/react";
import {
  Camera,
  FileCheck2,
  IndianRupee,
  LifeBuoy,
  LogIn,
  LogOut,
  MapPin,
  Sprout,
  Wheat,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

import { ChatDock } from "@/components/dashboard/ChatDock";
import type { ChatContextInfo } from "@/components/dashboard/ChatDock";
import { LocationCard } from "@/components/dashboard/LocationCard";
import type { FarmLocation } from "@/components/dashboard/LocationCard";
import { Results } from "@/components/dashboard/Results";
import { FarmPlan } from "@/components/dashboard/FarmPlan";
import { SoilForm } from "@/components/dashboard/SoilForm";
import type { SoilValues, SoilMeta } from "@/components/dashboard/SoilForm";
import { SoilRainCard } from "@/components/dashboard/SoilRainCard";
import type { SoilRainDisplayData } from "@/components/dashboard/SoilRainCard";
import { WeatherCard } from "@/components/dashboard/WeatherCard";
import { LangSwitcher } from "@/components/LangSwitcher";
import { GuestBanner } from "@/components/GuestBanner";
import { AlertBell } from "@/components/AlertBell";
import { ModuleCards } from "@/components/ModuleCards";
import { HowItWorks } from "@/components/HowItWorks";
import { DigitalFarmCard } from "@/components/DigitalFarmCard";
import { FarmCalendarCard } from "@/components/FarmCalendarCard";
import { AgricultureUpdates } from "@/components/AgricultureUpdates";
import { IconBadge } from "@/components/IconBadge";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/context/LanguageContext";
import { api } from "@/convex/_generated/api";
import type { FeatureKey } from "@/convex/data/cropProfiles";
import type { CropRecommendationResult } from "@/convex/lib/cropModel";
import { classifyCrop } from "@/convex/lib/cropModel";
import type { WeatherResult } from "@/convex/weather";

const num = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const EMPTY_SOIL: SoilValues = { N: "", P: "", K: "", ph: "" };
const EMPTY_INPUTS: Record<FeatureKey, number> = {
  N: 0,
  P: 0,
  K: 0,
  temperature: 0,
  humidity: 0,
  ph: 0,
  rainfall: 0,
};

type Season = "kharif" | "rabi" | "zaid";
type FarmerSeason = "Rainy Season" | "Winter Season" | "Summer Season";

interface OpenMeteoCurrentResponse {
  current?: {
    temperature_2m?: number | null;
    relative_humidity_2m?: number | null;
    precipitation?: number | null;
    weather_code?: number | null;
    wind_speed_10m?: number | null;
  };
  daily?: {
    time?: string[];
    precipitation_sum?: (number | null)[];
    weather_code?: (number | null)[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
  };
}

interface RegionalLiveBundle {
  weather: WeatherResult;
  soilRain: SoilRainDisplayData;
  estimated: boolean;
}

const seasonKeyForMonth = (month: number): Season => {
  if (month >= 6 && month <= 10) return "kharif";
  if (month === 11 || month === 12 || month <= 2) return "rabi";
  return "zaid";
};

const roundMm = (value: number) => Math.round(value * 10) / 10;

const regionalAnnualRainfall = (target: FarmLocation | null): number => {
  const place = target?.label.toLowerCase() ?? "";
  if (/udupi|dakshina kannada|mangaluru/.test(place)) return 1800;
  if (/uttara kannada|karwar/.test(place)) return 1500;
  if (place.includes("belagavi")) return 900;
  if (place.includes("bengaluru rural")) return 850;
  if (place.includes("mysuru")) return 800;
  if (place.includes("mandya")) return 750;
  if (/kolar|tumakuru/.test(place)) return 700;
  if (place.includes("chitradurga")) return 650;
  if (
    target &&
    target.lat > 0 &&
    target.lat < 24 &&
    target.lon >= 68 &&
    target.lon <= 97
  ) {
    return 800;
  }
  return 700;
};

const rainfallForRecommendation = (
  data: SoilRainDisplayData | null,
  target: FarmLocation | null,
): number => {
  const observed = data?.rain.seasonalMm;
  if (typeof observed === "number" && observed > 0) {
    if (data?.rainSource?.startsWith("Open-Meteo")) {
      return Math.round(observed * 4);
    }
    if (!data?.rainSource?.startsWith("Local regional")) {
      return Math.round(observed);
    }
  }
  return regionalAnnualRainfall(target);
};

const regionalSoil = (target: FarmLocation) => {
  const label = target.label.toLowerCase();
  const profiles = [
    { match: "chitradurga", n: 205, p: 19, k: 270, ph: 7.1 },
    { match: "bengaluru rural", n: 215, p: 22, k: 280, ph: 6.7 },
    { match: "mandya", n: 230, p: 25, k: 295, ph: 6.8 },
    { match: "kolar", n: 190, p: 20, k: 260, ph: 7.3 },
    { match: "tumakuru", n: 205, p: 21, k: 285, ph: 7.0 },
    { match: "mysuru", n: 225, p: 24, k: 305, ph: 6.8 },
    { match: "belagavi", n: 210, p: 23, k: 325, ph: 7.4 },
  ];
  const profile =
    profiles.find(({ match }) => label.includes(match)) ??
    (target.lat > 15
      ? { n: 195, p: 22, k: 300, ph: 7.4 }
      : { n: 215, p: 22, k: 280, ph: 6.9 });
  const parts = target.label.split(",").map((part) => part.trim());
  return {
    label: target.label,
    district: parts.length > 1 ? parts[1] : parts[0] || null,
    lat: target.lat,
    lon: target.lon,
    n: profile.n,
    p: profile.p,
    k: profile.k,
    ph: profile.ph,
    testedOn: "—",
    source: "Indicative regional estimate; not a field soil test",
    distanceKm: null,
  };
};

const createRegionalEstimateBundle = (target: FarmLocation): RegionalLiveBundle => {
  const now = new Date();
  const seasonKey = seasonKeyForMonth(now.getMonth() + 1);
  const isRainy = seasonKey === "kharif";
  const temperature = target.lat > 15 ? 25 : 27;
  const humidity = isRainy ? 72 : 61;
  const precipitation = isRainy ? 0.8 : 0;
  const today = now.toISOString().slice(0, 10);
  const placeParts = target.label.split(",").map((part) => part.trim());
  const seasonalMm = isRainy ? 86 : seasonKey === "rabi" ? 24 : 8;
  const soil = regionalSoil(target);

  return {
    estimated: true,
    weather: {
      place: target.label,
      current: {
        temperature,
        humidity,
        precipitation,
        weatherCode: isRainy ? 3 : 1,
        windSpeed: 8,
      },
      daily: [{
        date: today,
        code: isRainy ? 3 : 1,
        tMax: temperature + 2,
        tMin: temperature - 4,
        precipSum: precipitation,
      }],
    },
    soilRain: {
      rainSource: "Local regional estimate; Open-Meteo is unavailable",
      place: {
        village: placeParts[0] || null,
        town: placeParts[0] || null,
        taluk: null,
        district: placeParts.length > 1 ? placeParts[1] : null,
        state: placeParts.length > 1 ? placeParts[placeParts.length - 1] : null,
        label: target.label,
      },
      rain: {
        seasonKey,
        windowStart: new Date(now.getTime() - 29 * 86_400_000)
          .toISOString()
          .slice(0, 10),
        windowEnd: today,
        seasonalMm,
        normalMm: null,
        deviationPct: null,
        recent7Mm: isRainy ? 23 : seasonKey === "rabi" ? 5 : 1,
      },
      soil: { status: "regional-estimate", data: soil },
      trustRadiusKm: 0,
      fetchedAt: Date.now(),
    },
  };
};

const createOpenMeteoBundle = (
  target: FarmLocation,
  payload: OpenMeteoCurrentResponse,
): RegionalLiveBundle => {
  const current = payload.current;
  const temperature = current?.temperature_2m;
  const humidity = current?.relative_humidity_2m;
  const precipitation = current?.precipitation;
  if (
    typeof temperature !== "number" ||
    !Number.isFinite(temperature) ||
    typeof humidity !== "number" ||
    !Number.isFinite(humidity) ||
    typeof precipitation !== "number" ||
    !Number.isFinite(precipitation)
  ) {
    throw new Error("Open-Meteo response is missing current conditions");
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const daily = payload.daily;
  const rows = (daily?.time ?? []).map((date, index) => ({
    date,
    precipitation: daily?.precipitation_sum?.[index] ?? 0,
    code: daily?.weather_code?.[index] ?? current?.weather_code ?? 0,
    tMax: daily?.temperature_2m_max?.[index] ?? temperature + 2,
    tMin: daily?.temperature_2m_min?.[index] ?? temperature - 4,
  }));
  if (!rows.length) {
    throw new Error("Open-Meteo response is missing daily rainfall");
  }

  const seasonKey = seasonKeyForMonth(now.getMonth() + 1);
  const sameSeasonRows = rows.filter(
    (row) => seasonKeyForMonth(Number(row.date.slice(5, 7))) === seasonKey,
  );
  const sevenDaysAgo = new Date(now.getTime() - 6 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const recentRows = rows.filter((row) => row.date >= sevenDaysAgo && row.date <= today);
  const forecastRows = rows.filter((row) => row.date >= today).slice(0, 5);
  const displayRows = forecastRows.length ? forecastRows : rows.slice(-1);
  const placeParts = target.label.split(",").map((part) => part.trim());
  const soil = regionalSoil(target);

  return {
    estimated: false,
    weather: {
      place: target.label,
      current: {
        temperature,
        humidity,
        precipitation,
        weatherCode: current?.weather_code ?? 0,
        windSpeed: current?.wind_speed_10m ?? 0,
      },
      daily: displayRows.map((row) => ({
        date: row.date,
        code: row.code,
        tMax: row.tMax,
        tMin: row.tMin,
        precipSum: row.precipitation,
      })),
    },
    soilRain: {
      rainSource: "Open-Meteo; rainfall summed over the available 30-day window",
      place: {
        village: placeParts[0] || null,
        town: placeParts[0] || null,
        taluk: null,
        district: placeParts.length > 1 ? placeParts[1] : null,
        state: placeParts.length > 1 ? placeParts[placeParts.length - 1] : null,
        label: target.label,
      },
      rain: {
        seasonKey,
        windowStart: sameSeasonRows[0]?.date ?? rows[0].date,
        windowEnd: today,
        seasonalMm: roundMm(sameSeasonRows.reduce((sum, row) => sum + row.precipitation, 0)),
        normalMm: null,
        deviationPct: null,
        recent7Mm: roundMm(recentRows.reduce((sum, row) => sum + row.precipitation, 0)),
      },
      soil: { status: "regional-estimate", data: soil },
      trustRadiusKm: 0,
      fetchedAt: Date.now(),
    },
  };
};

const fetchRegionalLiveBundle = async (
  target: FarmLocation,
): Promise<RegionalLiveBundle> => {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${target.lat}&longitude=${target.lon}` +
    "&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m" +
    "&daily=precipitation_sum,weather_code,temperature_2m_max,temperature_2m_min" +
    "&past_days=30&forecast_days=1&timezone=auto";
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Open-Meteo request failed (${response.status})`);
    }
    return createOpenMeteoBundle(
      target,
      (await response.json()) as OpenMeteoCurrentResponse,
    );
  } catch (error) {
    console.warn("Open-Meteo unavailable; showing a regional estimate.", error);
    return createRegionalEstimateBundle(target);
  } finally {
    window.clearTimeout(timer);
  }
};

const farmerSeasonForDate = (date: Date): FarmerSeason => {
  const month = date.getMonth();
  if (month >= 5 && month <= 8) return "Rainy Season";
  if (month >= 9 || month <= 1) return "Winter Season";
  return "Summer Season";
};

const farmerSeasonForModelSeason = (value: Season): FarmerSeason => {
  if (value === "kharif") return "Rainy Season";
  if (value === "rabi") return "Winter Season";
  return "Summer Season";
};

const modelSeasonForFarmerSeason = (value: FarmerSeason): Season => {
  if (value === "Rainy Season") return "kharif";
  if (value === "Winter Season") return "rabi";
  return "zaid";
};

const PROFIT_ESTIMATES = {
  pomegranate: { quintalsPerAcre: 75, pricePerQuintal: 5200, costPerAcre: 180000 },
  rice: { quintalsPerAcre: 24, pricePerQuintal: 2300, costPerAcre: 38000 },
  maize: { quintalsPerAcre: 18, pricePerQuintal: 2200, costPerAcre: 36000 },
  cotton: { quintalsPerAcre: 7, pricePerQuintal: 7200, costPerAcre: 42000 },
} as const;

type ProfitCrop = keyof typeof PROFIT_ESTIMATES;

const formatRupees = (value: number) =>
  `₹${Math.round(value).toLocaleString("en-IN")}`;

const withTimeout = <T,>(request: Promise<T>, ms = 8000): Promise<T> =>
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

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim() ?? "";
  const hasConvexUrl =
    Boolean(convexUrl) && !/(127\.0\.0\.1|localhost)/i.test(convexUrl);

  // Deep-link support: /dashboard?tab=forecast opens the Market price tab
  // directly (used by the Market module card).
  const [searchParams] = useSearchParams();
  const farmPlanTab = searchParams.get("tab") === "forecast" ? "forecast" : "fert";

  const getWeather = useAction(api.weather.getWeather);
  const getSoilRain = useAction(api.soilRain.getSoilRain);
  const saveSoilReport = useMutation(api.reports.saveSoilReport);

  // Farmer's saved fields drive the digital-farm / calendar / updates cards.
  const fields = useQuery(
    api.cropData.listFields,
    hasConvexUrl ? {} : "skip",
  );
  const [sampleFarmLoaded, setSampleFarmLoaded] = useState(false);
  const [sampleField, setSampleField] = useState<{
    crop: string;
    sowingDate: string;
    irrigationType: string;
    village: string;
    taluk: string;
    district: string;
    state: string;
  } | null>(null);
  const primaryField = sampleFarmLoaded ? sampleField : fields?.[0];
  const [profitCrop, setProfitCrop] = useState<ProfitCrop>("pomegranate");
  const [profitAcres, setProfitAcres] = useState(1.5);

  // --- Location + weather -------------------------------------------------
  const [loc, setLoc] = useState<FarmLocation | null>(null);
  const [weather, setWeather] = useState<WeatherResult | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherEstimated, setWeatherEstimated] = useState(false);
  const weatherRef = useRef(weather);
  weatherRef.current = weather;

  // --- Farmer inputs --------------------------------------------------------
  const [soil, setSoil] = useState<SoilValues>(EMPTY_SOIL);
  const [soilMeta, setSoilMeta] = useState<SoilMeta | null>(null);
  const [temp, setTempState] = useState("");
  const [hum, setHumState] = useState("");
  const [rain, setRainState] = useState("");
  const [area, setArea] = useState("");
  const [season, setSeason] = useState<Season>("kharif");
  const [detectedSeason, setDetectedSeason] = useState<FarmerSeason | null>(null);
  const [farmDetecting, setFarmDetecting] = useState(false);
  const [weatherAuto, setWeatherAuto] = useState(true);
  const [rainAuto, setRainAuto] = useState(true);

  const weatherAutoRef = useRef(weatherAuto);
  weatherAutoRef.current = weatherAuto;
  const autoKeyRef = useRef<string | null>(null);
  const rainAutoRef = useRef(rainAuto);
  rainAutoRef.current = rainAuto;
  const rainKeyRef = useRef<string | null>(null);
  const seasonTouchedRef = useRef(false);

  const setTemp = useCallback((v: string) => {
    setWeatherAuto(false);
    setTempState(v);
  }, []);
  const setHum = useCallback((v: string) => {
    setWeatherAuto(false);
    setHumState(v);
  }, []);
  const setRain = useCallback((v: string) => {
    setRainAuto(false);
    setRainState(v);
  }, []);

  // --- Live Soil & Rainfall ------------------------------------------------
  const [srData, setSrData] = useState<SoilRainDisplayData | null>(null);
  const [srLoading, setSrLoading] = useState(false);
  const [srError, setSrError] = useState<string | null>(null);
  const regionalBundleRequestsRef = useRef(
    new Map<string, Promise<RegionalLiveBundle>>(),
  );
  const soilRainRequestIdRef = useRef(0);

  const getRegionalBundle = useCallback(
    (target: FarmLocation, refresh = false) => {
      const key = `${target.lat.toFixed(4)},${target.lon.toFixed(4)}`;
      const existing = regionalBundleRequestsRef.current.get(key);
      if (!refresh && existing) return existing;
      const request = fetchRegionalLiveBundle(target);
      regionalBundleRequestsRef.current.set(key, request);
      return request;
    },
    [],
  );

  const loadSoilRain = useCallback(
    (target: FarmLocation, forceRegional = false) => {
      const requestId = ++soilRainRequestIdRef.current;
      const isCurrentRequest = () => requestId === soilRainRequestIdRef.current;
      const applyRegionalData = async (refresh: boolean) => {
        const bundle = await getRegionalBundle(target, refresh);
        if (!isCurrentRequest()) return;
        setSrData(bundle.soilRain);
        setSrError(null);
        setWeather(bundle.weather);
        setWeatherEstimated(bundle.estimated);
        setWeatherError(null);
        setWeatherLoading(false);
        if (weatherAutoRef.current) {
          const key = `${target.lat.toFixed(4)},${target.lon.toFixed(4)}`;
          if (autoKeyRef.current !== key) {
            autoKeyRef.current = key;
            setTempState(String(Math.round(bundle.weather.current.temperature)));
            setHumState(String(Math.round(bundle.weather.current.humidity)));
          }
        }
      };

      setSrLoading(true);
      setSrError(null);
      setSrData((previous) =>
        previous?.place.label === target.label ? previous : null,
      );
      if (weatherRef.current?.place !== target.label && hasConvexUrl && !forceRegional) {
        setWeather(null);
      }
      if (!hasConvexUrl || forceRegional) {
        const estimate = createRegionalEstimateBundle(target);
        setSrData((previous) =>
          previous?.place.label === target.label ? previous : estimate.soilRain,
        );
        if (weatherRef.current?.place !== target.label) {
          setWeather(estimate.weather);
          setWeatherEstimated(true);
          setWeatherError(null);
        }
      }
      const run = async () => {
        try {
          if (!hasConvexUrl || forceRegional) {
            await applyRegionalData(forceRegional);
            return;
          }

          const res = await withTimeout(
            getSoilRain({ lat: target.lat, lon: target.lon }),
          );
          if (!isCurrentRequest()) return;
          if (res.ok) {
            setSrData(
              res.data.soil.status === "unavailable"
                ? {
                    ...res.data,
                    soil: {
                      status: "regional-estimate",
                      data: regionalSoil(target),
                      reference: res.data.soil.reference,
                    },
                  }
                : res.data,
            );
            setSrError(null);
            return;
          }
          console.warn("Convex soil/rain request failed; using Open-Meteo.", res.reason);
          await applyRegionalData(true);
        } catch (error) {
          if (!isCurrentRequest()) return;
          console.warn("Convex soil/rain request failed; using Open-Meteo.", error);
          await applyRegionalData(true);
        } finally {
          if (isCurrentRequest()) setSrLoading(false);
        }
      };
      void run();
    },
    [getRegionalBundle, getSoilRain, hasConvexUrl],
  );

  const refreshSoilRain = useCallback(() => {
    if (!loc) return;
    setWeatherLoading(true);
    setWeatherError(null);
    loadSoilRain(loc, true);
  }, [loc, loadSoilRain]);

  // Open the Soil Health Card / manual-entry section of the soil form
  // (used by the SoilRainCard's "Enter Soil Health Card Data" button).
  const openSoilDataEntry = useCallback(() => {
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    soilFormElRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setSoilFormOpenSignal((s) => s + 1);
  }, []);

  // Apply the available soil record or clearly labeled regional estimate.
  const applySoil = useCallback(
    (
      v: { N: number; P: number; K: number; ph: number },
      meta: SoilMeta,
    ) => {
      setSoil({
        N: String(Math.round(v.N)),
        P: String(Math.round(v.P)),
        K: String(Math.round(v.K)),
        ph: String(v.ph),
      });
      setSoilMeta(meta);
    },
    [],
  );

  // Fetch live soil & rainfall whenever the location changes.
  useEffect(() => {
    if (!loc) {
      soilRainRequestIdRef.current += 1;
      setSrLoading(false);
      setSrData(null);
      setSrError(null);
      setSoil(EMPTY_SOIL);
      setSoilMeta(null);
      setRainState("");
      setRainAuto(true);
      rainKeyRef.current = null;
      return;
    }
    loadSoilRain(loc, sampleFarmLoaded);
  }, [loc, loadSoilRain, sampleFarmLoaded]);

  // Auto-apply soil data + seasonal rainfall + season once fetched.
  const autoSoilKeyRef = useRef<string | null>(null);
  const userSoilLockRef = useRef(false); // farmer chose upload/manual → don't override
  useEffect(() => {
    if (sampleFarmLoaded) return;
    if (!srData) return;
    const key = `${loc?.lat.toFixed(3)},${loc?.lon.toFixed(3)}`;
    const s = srData.soil;
    // Keep estimates and measured records out of the form after manual entry.
    if (
      s.status !== "unavailable" &&
      autoSoilKeyRef.current !== key &&
      !userSoilLockRef.current
    ) {
      autoSoilKeyRef.current = key;
      const d = s.data;
      applySoil(
        { N: d.n, P: d.p, K: d.k, ph: d.ph },
        {
          source:
            s.status === "regional-estimate"
              ? "auto"
              : s.status === "live"
                ? "gov_dataset"
                : "nearest_test",
          testedOn: d.testedOn === "—" ? null : d.testedOn,
          sourceLabel: d.source,
          distanceKm: d.distanceKm,
          oc: d.oc ?? null,
          ec: d.ec ?? null,
          s: d.s ?? null,
        },
      );
    }
    // Rainfall: auto-fill seasonal rainfall (used by the crop model).
    if (rainAutoRef.current && rainKeyRef.current !== key) {
      rainKeyRef.current = key;
      setRainState(String(rainfallForRecommendation(srData, loc)));
    }
    // Season: follow the detected agricultural season until the farmer picks.
    if (!seasonTouchedRef.current) {
      setSeason(srData.rain.seasonKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srData, sampleFarmLoaded]);

  useEffect(() => {
    if (!loc) {
      setWeather(null);
      setWeatherEstimated(false);
      setWeatherError(null);
      return;
    }
    if (sampleFarmLoaded) {
      setWeatherLoading(false);
      setWeatherError(null);
      return;
    }
    if (!weatherAutoRef.current) {
      setWeatherLoading(false);
      return;
    }
    let cancelled = false;
    setWeatherLoading(true);
    setWeatherError(null);
    const applyWeatherInputs = (w: WeatherResult) => {
      const key = `${loc.lat.toFixed(4)},${loc.lon.toFixed(4)}`;
      if (autoKeyRef.current !== key && weatherAutoRef.current) {
        autoKeyRef.current = key;
        setTempState(String(Math.round(w.current.temperature)));
        setHumState(String(Math.round(w.current.humidity)));
      }
    };
    const run = async () => {
      try {
        if (hasConvexUrl) {
          try {
            const result = await withTimeout(
              getWeather({ lat: loc.lat, lon: loc.lon }),
            );
            if (cancelled) return;
            setWeather(result);
            setWeatherEstimated(false);
            applyWeatherInputs(result);
            return;
          } catch (error) {
            if (cancelled) return;
            console.warn("Convex weather request failed; using Open-Meteo.", error);
          }
        }

        const bundle = await getRegionalBundle(loc, hasConvexUrl);
        if (cancelled) return;
        setWeather(bundle.weather);
        setWeatherEstimated(bundle.estimated);
        setWeatherError(null);
        setSrData((previous) => previous ?? bundle.soilRain);
        setSrError(null);
        applyWeatherInputs(bundle.weather);
      } catch (error) {
        if (!cancelled) {
          console.error("Unable to load weather fallback.", error);
          setWeatherError(null);
        }
      } finally {
        if (!cancelled) setWeatherLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [loc, getRegionalBundle, getWeather, sampleFarmLoaded, hasConvexUrl]);

  const retryWeather = useCallback(() => {
    if (!loc) return;
    setWeatherLoading(true);
    setWeatherError(null);
    void getRegionalBundle(loc, true).then((bundle) => {
      setWeather(bundle.weather);
      setWeatherEstimated(bundle.estimated);
      setWeatherError(null);
      setSrData((previous) => previous ?? bundle.soilRain);
      setSrError(null);
      if (weatherAutoRef.current) {
        setTempState(String(Math.round(bundle.weather.current.temperature)));
        setHumState(String(Math.round(bundle.weather.current.humidity)));
      }
      setWeatherLoading(false);
    });
  }, [getRegionalBundle, loc]);

  // --- Recommendation -------------------------------------------------------
  const [submitted, setSubmitted] = useState<Record<FeatureKey, number> | null>(
    null,
  );
  const remoteRec = useQuery(
    api.recommend.recommendCrop,
    submitted && !sampleFarmLoaded && hasConvexUrl ? submitted : "skip",
  ) as CropRecommendationResult | undefined;
  const irrigationType = (primaryField?.irrigationType ?? "").toLowerCase();
  const irrigated =
    irrigationType.length > 0 &&
    !/(rain.?fed|dryland|no irrigation|unirrigated)/.test(irrigationType);
  const rec = submitted
    ? loc
      ? classifyCrop({
          ...submitted,
          latitude: loc.lat,
          longitude: loc.lon,
          season,
          irrigated,
        })
      : remoteRec ??
        classifyCrop({
          ...submitted,
          season,
          irrigated,
        })
    : remoteRec;

  const resultsRef = useRef<HTMLDivElement>(null);
  // Opens the manual/SHC-entry section in SoilForm (bumped by SoilRainCard's
  // "Enter Soil Health Card Data" button) — never fabricated soil values.
  const [soilFormOpenSignal, setSoilFormOpenSignal] = useState(0);
  const soilFormElRef = useRef<HTMLDivElement>(null);

  const n = num(soil.N);
  const p = num(soil.P);
  const k = num(soil.K);
  const ph = num(soil.ph);
  const tempN = num(temp);
  const humN = num(hum);
  const rainN = num(rain);

  const ready =
    n !== null &&
    p !== null &&
    k !== null &&
    ph !== null &&
    tempN !== null &&
    humN !== null &&
    rainN !== null;

  // Pending report is saved once the model returns, so the snapshot includes
  // the recommended crop (project DB requirement).
  const pendingReportRef = useRef<Record<string, unknown> | null>(null);
  useEffect(() => {
    const report = pendingReportRef.current;
    if (!rec || !report) return;
    const top = rec.top[0];
    if (!top) return;
    pendingReportRef.current = null;
    if (sampleFarmLoaded || !hasConvexUrl) return;
    void saveSoilReport({
      ...(report as Parameters<typeof saveSoilReport>[0]),
      recommendedCrop: top.crop,
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec, sampleFarmLoaded, hasConvexUrl]);

  const onRecommend = () => {
    if (
      !ready ||
      n === null ||
      p === null ||
      k === null ||
      ph === null ||
      tempN === null ||
      humN === null ||
      rainN === null
    ) {
      return;
    }
    if (ph < 0 || ph > 14 || humN < 0 || humN > 100 || n < 0 || p < 0 || k < 0) {
      toast.error(t("unusualWarn"));
      return;
    }
    const recommendationRainfall = rainAuto
      ? rainfallForRecommendation(srData, loc)
      : rainN;
    setSubmitted({
      N: n,
      P: p,
      K: k,
      temperature: tempN,
      humidity: humN,
      ph: ph,
      rainfall: recommendationRainfall,
    });
    pendingReportRef.current = {
      lat: loc?.lat,
      lon: loc?.lon,
      village: srData?.place.village ?? undefined,
      taluk: srData?.place.taluk ?? undefined,
      district: srData?.place.district ?? undefined,
      ph,
      nitrogen: n,
      phosphorus: p,
      potassium: k,
      soilSampleDate: soilMeta?.testedOn ?? undefined,
      soilDataSource: soilMeta?.source ?? "manual",
      temperature: tempN,
      humidity: humN,
      rainfall: recommendationRainfall,
      season,
    };
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const loadSampleFarm = useCallback(() => {
    const now = new Date();
    const sowingDate = new Date(now.getTime() - 62 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const sampleLocation: FarmLocation = {
      label: "Devanahalli, Bengaluru Rural, Karnataka",
      lat: 13.2443,
      lon: 77.7117,
      source: "manual",
    };
    const inputs: Record<FeatureKey, number> = {
      N: 19,
      P: 20,
      K: 40,
      temperature: 22,
      humidity: 90,
      ph: 6.4,
      rainfall: 108,
    };

    setSampleField({
      crop: "pomegranate",
      sowingDate,
      irrigationType: "Drip irrigation",
      village: "Devanahalli",
      taluk: "Devanahalli",
      district: "Bengaluru Rural",
      state: "Karnataka",
    });
    setSampleFarmLoaded(true);
    setLoc(sampleLocation);
    setSoil({ N: "19", P: "20", K: "40", ph: "6.4" });
    setSoilMeta({
      source: "manual",
      testedOn: sowingDate,
      sourceLabel: "Sample Soil Health Card (illustrative)",
      distanceKm: null,
      oc: null,
      ec: null,
      s: null,
    });
    setTempState("22");
    setHumState("90");
    setRainState("108");
    setWeatherAuto(false);
    setRainAuto(false);
    setArea("1.5");
    setSeason("rabi");
    setDetectedSeason("Winter Season");
    seasonTouchedRef.current = true;
    setWeather({
      place: "Devanahalli, Karnataka",
      current: {
        temperature: 27,
        humidity: 68,
        precipitation: 0,
        weatherCode: 1,
        windSpeed: 10,
      },
      daily: Array.from({ length: 5 }, (_, index) => {
        const date = new Date(now.getTime() + index * 86_400_000)
          .toISOString()
          .slice(0, 10);
        return {
          date,
          code: index === 2 ? 2 : 1,
          tMax: 28 + (index % 2),
          tMin: 17 + (index % 3),
          precipSum: index === 2 ? 1.2 : 0,
        };
      }),
    });
    setWeatherLoading(false);
    setWeatherError(null);
    setWeatherEstimated(true);
    setSubmitted(inputs);
    setProfitCrop("pomegranate");
    setProfitAcres(1.5);
    pendingReportRef.current = null;
    toast.success("Sample farm loaded. Values are illustrative and not saved.");
  }, []);

  const clearSampleFarm = useCallback(() => {
    setSampleFarmLoaded(false);
    setSampleField(null);
    setLoc(null);
    setWeather(null);
    setWeatherLoading(false);
    setWeatherError(null);
    setWeatherEstimated(false);
    setSoil(EMPTY_SOIL);
    setSoilMeta(null);
    setTempState("");
    setHumState("");
    setRainState("");
    setArea("");
    setSubmitted(null);
    setWeatherAuto(true);
    setRainAuto(true);
    setSeason("kharif");
    setDetectedSeason(null);
    setProfitCrop("pomegranate");
    setProfitAcres(1.5);
    autoKeyRef.current = null;
    rainKeyRef.current = null;
    autoSoilKeyRef.current = null;
    userSoilLockRef.current = false;
    seasonTouchedRef.current = false;
    pendingReportRef.current = null;
  }, []);

  const autoDetectFarm = useCallback(() => {
    if (farmDetecting) return;
    setFarmDetecting(true);

    const applyLocation = async (
      latitude: number,
      longitude: number,
      source: FarmLocation["source"],
      label: string,
    ) => {
      let temperature = 24;
      let humidity = 65;
      let precipitation = 0;
      let hasLiveWeather = false;

      try {
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}` +
          `&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation`;
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8000);
        let payload: OpenMeteoCurrentResponse;
        try {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) {
            throw new Error(`Weather request failed: ${response.status}`);
          }
          payload = (await response.json()) as OpenMeteoCurrentResponse;
        } finally {
          window.clearTimeout(timeout);
        }
        const temperatureReading = payload.current?.temperature_2m;
        const humidityReading = payload.current?.relative_humidity_2m;
        const precipitationReading = payload.current?.precipitation;
        if (
          typeof temperatureReading !== "number" ||
          !Number.isFinite(temperatureReading) ||
          typeof humidityReading !== "number" ||
          !Number.isFinite(humidityReading) ||
          typeof precipitationReading !== "number" ||
          !Number.isFinite(precipitationReading)
        ) {
          throw new Error("Weather response is missing current conditions");
        }
        temperature = temperatureReading;
        humidity = humidityReading;
        precipitation = precipitationReading;
        hasLiveWeather = true;
      } catch {
        toast.error("Live weather is unavailable; using an illustrative local estimate.");
      }

      const location: FarmLocation = {
        label,
        lat: latitude,
        lon: longitude,
        source,
      };
      const annualRainfall = regionalAnnualRainfall(location);
      const seasonName = farmerSeasonForDate(new Date());
      const today = Date.now();
      setSampleFarmLoaded(false);
      setSampleField(null);
      setLoc(location);
      setSoil({ N: "19", P: "20", K: "40", ph: "6.4" });
      setSoilMeta({
        source: "auto",
        testedOn: null,
        sourceLabel: "Indicative demo values (not a soil test)",
        distanceKm: null,
        oc: null,
        ec: null,
        s: null,
      });
      setTempState(String(Math.round(temperature)));
      setHumState(String(Math.round(humidity)));
      setRainState(String(annualRainfall));
      setWeatherAuto(false);
      setRainAuto(true);
      setWeather({
        place: label,
        current: {
          temperature,
          humidity,
          precipitation,
          weatherCode: 0,
          windSpeed: 0,
        },
        daily: Array.from({ length: 5 }, (_, index) => {
          const date = new Date(today + index * 86_400_000)
            .toISOString()
            .slice(0, 10);
          return {
            date,
            code: 0,
            tMax: Math.round(temperature + 2),
            tMin: Math.round(temperature - 4),
            precipSum: index === 0 ? precipitation : 0,
          };
        }),
      });
      setWeatherLoading(false);
      setWeatherError(null);
      setWeatherEstimated(!hasLiveWeather);
      setSrData(null);
      setSrLoading(false);
      setSrError(null);
      setSubmitted({
        N: 19,
        P: 20,
        K: 40,
        temperature,
        humidity,
        ph: 6.4,
        rainfall: annualRainfall,
      });
      setDetectedSeason(seasonName);
      setSeason(modelSeasonForFarmerSeason(seasonName));
      setArea("1");
      setProfitCrop("pomegranate");
      pendingReportRef.current = null;
      autoSoilKeyRef.current = null;
      userSoilLockRef.current = false;
      rainKeyRef.current = null;
      seasonTouchedRef.current = true;
      setFarmDetecting(false);
      toast.success(
        hasLiveWeather
          ? `Farm detected. ${seasonName} selected and live weather loaded.`
          : `Farm location loaded for ${seasonName}; local weather estimate shown.`,
      );
    };

    const fallbackToDevanahalli = () =>
      applyLocation(13.2473, 77.7131, "manual", "Devanahalli, Karnataka");

    if (
      typeof navigator === "undefined" ||
      !navigator.geolocation
    ) {
      void fallbackToDevanahalli();
      return;
    }

    try {
      navigator.geolocation.getCurrentPosition(
        (position: GeolocationPosition) => {
          const { latitude, longitude } = position.coords;
          void applyLocation(
            latitude,
            longitude,
            "gps",
            `GPS location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
          );
        },
        () => {
          void fallbackToDevanahalli();
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 },
      );
    } catch {
      void fallbackToDevanahalli();
    }
  }, [farmDetecting]);

  const scanSoilCardDemo = useCallback(() => {
    const sampleSoil: SoilValues = { N: "19", P: "20", K: "40", ph: "6.4" };
    setSoil(sampleSoil);
    setSoilMeta({
      source: "manual",
      testedOn: null,
      sourceLabel: "Demo Soil Health Card (illustrative sample)",
      distanceKm: null,
      oc: null,
      ec: null,
      s: null,
    });
    setSubmitted(null);
    pendingReportRef.current = null;
    userSoilLockRef.current = true;
    toast.success("Sample Soil Health Card values loaded; no image was scanned.");
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Dashboard sign-out failed.", error);
      toast.error("Could not complete cloud sign-out. The sign-in page will still open.");
    } finally {
      navigate("/auth", { replace: true });
    }
  };

  const chatContext: ChatContextInfo = {
    loc,
    weather,
    rec: rec ?? null,
    soil,
    season: detectedSeason ?? farmerSeasonForModelSeason(season),
  };
  const profitEstimate = PROFIT_ESTIMATES[profitCrop];
  const expectedQuintals = profitAcres * profitEstimate.quintalsPerAcre;
  const grossRevenue = expectedQuintals * profitEstimate.pricePerQuintal;
  const estimatedNetProfit = grossRevenue - profitAcres * profitEstimate.costPerAcre;

  return (
    <div className="nb-dots min-h-screen bg-[#E9F2EC] text-[#102318]">
      {/* Header */}
      <header className="border-b border-[#1B4332]/20 bg-[#F6FBF8]/95">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <IconBadge icon={Sprout} tone="gold" size="md" />
            <div className="leading-tight">
              <p className="font-display text-lg uppercase">KrishiMitra AI</p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#496352]">
                {t("dashSub")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AlertBell demoMode={sampleFarmLoaded || !hasConvexUrl} />
            <LangSwitcher />
            {user ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="nb-press inline-flex items-center gap-2 bg-[#F6FBF8] px-3 py-1.5 text-xs font-bold uppercase text-[#1B4332]"
              >
                <LogOut className="size-4" /> {t("signOut")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/auth")}
                className="nb-press inline-flex items-center gap-2 bg-[#1B4332] px-3 py-1.5 text-xs font-bold uppercase text-white"
              >
                <LogIn className="size-4" /> Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-7">
        <GuestBanner onLoadSampleFarm={loadSampleFarm} />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-2xl uppercase">
            {t("dashWelcome", { name: user?.name ? `, ${user.name}` : "" })}
          </p>
          <button
            type="button"
            onClick={() => navigate("/help")}
            className="nb-press inline-flex items-center gap-2 bg-[#1B4332] px-5 py-3 font-display text-sm uppercase text-white"
          >
            <IconBadge icon={LifeBuoy} tone="gold" size="sm" />
            {t("cardHelp")}
          </button>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={autoDetectFarm}
            disabled={farmDetecting}
            className="nb-press inline-flex min-h-12 items-center gap-2 bg-[#1B4332] px-4 py-3 text-left text-xs font-bold uppercase text-white disabled:cursor-wait"
          >
            <MapPin className="size-5 shrink-0 text-[#FDE68A]" />
            <span>
              {farmDetecting
                ? "Detecting farm and loading weather…"
                : "1-Tap Auto-Detect My Farm (GPS + Live Weather + Soil)"}
            </span>
          </button>
          <button
            type="button"
            onClick={scanSoilCardDemo}
            className="nb-press inline-flex min-h-12 items-center gap-2 bg-[#FEF3C7] px-4 py-3 text-left text-xs font-bold uppercase text-[#102318]"
          >
            <Camera className="size-5 shrink-0 text-[#854D0E]" />
            <span>Scan Soil Card (Demo Auto-Fill)</span>
          </button>
          {detectedSeason && (
            <p
              aria-live="polite"
              className="rounded-full border border-[#1B4332]/20 bg-[#F6FBF8] px-3 py-2 text-xs font-bold text-[#1B4332]"
            >
              Detected season: {detectedSeason}
            </p>
          )}
        </div>

        {/* Module cards: crop / weather / soil / market / alerts / schemes / nearby / AI */}
        <ModuleCards
          demoMode={sampleFarmLoaded}
          onDemoModeChange={(enabled) => {
            if (enabled) loadSampleFarm();
            else clearSampleFarm();
          }}
        />

        {/* Live digital farm + calendar, driven by the farmer's saved field */}
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <DigitalFarmCard
            crop={primaryField?.crop}
            sowingDate={primaryField?.sowingDate}
            irrigationType={primaryField?.irrigationType}
            village={primaryField?.village}
            taluk={primaryField?.taluk}
            district={primaryField?.district}
            state={primaryField?.state}
          />
          <FarmCalendarCard
            crop={primaryField?.crop}
            sowingDate={primaryField?.sowingDate}
          />
        </div>

        {/* Official government agriculture portals */}
        <div className="mb-6">
          <AgricultureUpdates />
        </div>

        {/* Crop photo quick actions */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => navigate("/scan")}
            className="nb-press flex items-center gap-3 bg-[#FEF3C7] px-5 py-4 text-left"
          >
            <IconBadge icon={Camera} tone="gold" size="md" />
            <span>
              <span className="font-display block text-lg uppercase">{t("scanShort")}</span>
              <span className="block text-xs font-semibold text-[#496352]">{t("scanHomeHint")}</span>
            </span>
        </button>
          <button
            type="button"
            onClick={() => navigate("/fields")}
            className="nb-press flex items-center gap-3 bg-[#F6FBF8] px-5 py-4 text-left"
          >
            <IconBadge icon={Wheat} tone="emerald" size="md" />
            <span>
              <span className="font-display block text-lg uppercase">{t("navFields")}</span>
              <span className="block text-xs font-semibold text-[#496352]">{t("fieldsHomeHint")}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/history")}
            className="nb-press flex items-center gap-3 bg-[#F6FBF8] px-5 py-4 text-left sm:col-span-2"
          >
            <IconBadge icon={FileCheck2} tone="mint" size="md" />
            <span>
              <span className="font-display block text-lg uppercase">{t("navHistory")}</span>
              <span className="block text-xs font-semibold text-[#496352]">{t("historyHomeHint")}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/farm")}
            className="nb-press flex items-center gap-3 bg-[#F6FBF8] px-5 py-4 text-left sm:col-span-2"
          >
            <IconBadge icon={MapPin} tone="sky" size="md" />
            <span>
              <span className="font-display block text-lg uppercase">{t("farmTitle")}</span>
              <span className="block text-xs font-semibold text-[#496352]">{t("farmCardHint")}</span>
            </span>
          </button>
        </div>

        <section className="nb-card mb-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <IconBadge icon={IndianRupee} tone="gold" size="lg" />
              <div>
                <h2 className="font-display text-base uppercase sm:text-lg">
                  Estimated Yield &amp; Mandi Profit Calculator
                </h2>
                <p className="mt-1 text-xs text-[#496352]">
                  Indicative local estimate only; actual prices, costs and yields vary.
                </p>
              </div>
            </div>
            <label className="min-w-44">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#496352]">
                Crop
              </span>
              <select
                value={profitCrop}
                onChange={(event) => setProfitCrop(event.target.value as ProfitCrop)}
                className="nb-input"
              >
                <option value="pomegranate">Pomegranate</option>
                <option value="rice">Rice</option>
                <option value="maize">Maize</option>
                <option value="cotton">Cotton</option>
              </select>
            </label>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_1.2fr] lg:items-center">
            <label>
              <span className="flex items-center justify-between text-xs font-bold text-[#1B4332]">
                <span>Acreage</span>
                <span>{profitAcres.toFixed(1)} acres</span>
              </span>
              <input
                type="range"
                min="0.5"
                max="20"
                step="0.5"
                value={profitAcres}
                onChange={(event) => setProfitAcres(Number(event.target.value))}
                className="mt-3 w-full accent-[#1B4332]"
                aria-label="Farm acreage"
              />
              <span className="flex justify-between text-[10px] text-[#496352]">
                <span>0.5 acre</span>
                <span>20 acres</span>
              </span>
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-[#1B4332]/15 bg-[#E9F2EC] p-3">
                <p className="text-[10px] font-bold uppercase text-[#496352]">Expected yield</p>
                <p className="mt-1 text-lg font-bold text-[#102318]">
                  {expectedQuintals.toFixed(1)} q
                </p>
              </div>
              <div className="rounded-xl border border-[#1B4332]/15 bg-[#E9F2EC] p-3">
                <p className="text-[10px] font-bold uppercase text-[#496352]">Gross revenue</p>
                <p className="mt-1 text-lg font-bold text-[#102318]">
                  {formatRupees(grossRevenue)}
                </p>
              </div>
              <div className="rounded-xl border border-[#1B4332]/15 bg-gradient-to-br from-[#DDF1E4] to-[#B7DEC5] p-3">
                <p className="text-[10px] font-bold uppercase text-[#1B4332]">Estimated net profit</p>
                <p className="mt-1 text-lg font-bold text-[#102318]">
                  {formatRupees(estimatedNetProfit)}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          {/* Left: inputs */}
          <div className="space-y-6">
            <LocationCard loc={loc} setLoc={setLoc} />
            <WeatherCard
              loc={loc}
              weather={weather}
              loading={weatherLoading}
              error={weatherError}
              estimated={weatherEstimated}
              onRetry={retryWeather}
            />
            <div ref={soilFormElRef}>
              <SoilForm
                locLabel={srData?.place.label ?? loc?.label ?? null}
                soil={soil}
                setSoil={setSoil}
                soilMeta={soilMeta}
                temp={temp}
                hum={hum}
                rain={rain}
                area={area}
                setTemp={setTemp}
                setHum={setHum}
                setRain={setRain}
                setArea={setArea}
                weatherAuto={weatherAuto}
                rainAuto={rainAuto}
                season={season}
                setSeason={(s) => {
                  seasonTouchedRef.current = true;
                  setSeason(s);
                  setDetectedSeason(farmerSeasonForModelSeason(s));
                }}
                ready={ready}
                onRecommend={onRecommend}
                openManualSignal={soilFormOpenSignal}
                onUpload={(v) => {
                  userSoilLockRef.current = true;
                  applySoil(v, v.meta);
                }}
              />
            </div>
            <SoilRainCard
              loc={loc}
              data={srData}
              loading={srLoading}
              error={srError}
              onRefresh={refreshSoilRain}
              onEnterSoilData={openSoilDataEntry}
              onUseRainfall={(mm) => {
                setRain(
                  String(
                    srData
                      ? rainfallForRecommendation(srData, loc)
                      : Math.round(mm),
                  ),
                );
              }}
              onUseSoil={(v) => {
                userSoilLockRef.current = true;
                applySoil(v, {
                  source:
                    srData?.soil.status === "regional-estimate"
                      ? "auto"
                      : srData?.soil.status === "live"
                        ? "gov_dataset"
                        : "nearest_test",
                  testedOn: v.testedOn === "—" ? null : v.testedOn,
                  sourceLabel: v.source,
                  distanceKm: v.distanceKm,
                  oc: v.oc,
                  ec: v.ec,
                  s: v.s,
                });
              }}
            />
          </div>

          {/* Right: results */}
          <div ref={resultsRef} className="space-y-6 scroll-mt-4">
            <Results
              rec={rec}
              ready={submitted !== null}
              inputs={submitted ?? EMPTY_INPUTS}
              season={season}
            />
            <FarmPlan rec={rec ?? null} soil={soil} area={area} defaultTab={farmPlanTab} />
            <HowItWorks />
          </div>
        </div>
      </main>

      <ChatDock context={chatContext} />
    </div>
  );
}
