/**
 * KrishiMitra AI — Farm-Map weather actions.
 *
 * Split from the dashboard weather card: richer payload for the Farm module
 * (hourly, feels-like, rain probability, wind direction) using Open-Meteo —
 * free, no API key, real observations/forecasts. All values are metric.
 *
 * Also: full reverse geocoding (village → district → state → country) via
 * BigDataCloud + Photon. Never fabricates a district or state: if both
 * providers fail, the response reports them as unavailable.
 */
import { action } from "./_generated/server";
import { v } from "convex/values";

export interface FarmHourly {
  time: string; // ISO local
  temperature: number;
  precipProb: number; // %
  precipMm: number;
  windKmh: number;
  code: number;
  isDay: boolean;
}

export interface FarmDaily {
  date: string;
  code: number;
  tMax: number;
  tMin: number;
  precipProb: number;
  precipSum: number;
  windMax: number;
}

export interface FarmWeather {
  current: {
    temperature: number;
    feelsLike: number;
    humidity: number;
    precipitation: number;
    rainProbability: number;
    weatherCode: number;
    windSpeed: number; // km/h
    windDirection: number; // degrees
    isDay: boolean;
    time: string;
  };
  hourly: FarmHourly[];
  daily: FarmDaily[];
  timezone: string;
  fetchedAt: number;
  source: string;
}

export const getFarmWeather = action({
  args: { lat: v.number(), lon: v.number() },
  handler: async (_ctx, { lat, lon }): Promise<FarmWeather> => {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      "&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m" +
      "&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,is_day" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max" +
      "&forecast_days=7&wind_speed_unit=kmh&timezone=auto";

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather service error (${res.status})`);
    const d = (await res.json()) as {
      timezone?: string;
      current?: Record<string, number>;
      hourly?: {
        time: string[];
        temperature_2m: (number | null)[];
        precipitation_probability: (number | null)[];
        precipitation: (number | null)[];
        weather_code: (number | null)[];
        wind_speed_10m: (number | null)[];
        is_day: (number | null)[];
      };
      daily?: {
        time: string[];
        weather_code: (number | null)[];
        temperature_2m_max: (number | null)[];
        temperature_2m_min: (number | null)[];
        precipitation_sum: (number | null)[];
        precipitation_probability_max: (number | null)[];
        wind_speed_10m_max: (number | null)[];
      };
    };
    const cur = d.current;
    const hourly = d.hourly;
    const daily = d.daily;
    if (!cur || !hourly || !daily) throw new Error("Incomplete weather response");

    // Next 24 hours starting from the current hour.
    const nowIso = String(cur.time ?? "").slice(0, 13);
    let startIdx = hourly.time.findIndex((t) => t.slice(0, 13) >= nowIso);
    if (startIdx < 0) startIdx = 0;
    const hourlyOut: FarmHourly[] = [];
    for (let i = startIdx; i < Math.min(startIdx + 24, hourly.time.length); i++) {
      hourlyOut.push({
        time: hourly.time[i]!,
        temperature: hourly.temperature_2m[i] ?? 0,
        precipProb: hourly.precipitation_probability[i] ?? 0,
        precipMm: hourly.precipitation[i] ?? 0,
        windKmh: hourly.wind_speed_10m[i] ?? 0,
        code: hourly.weather_code[i] ?? 0,
        isDay: (hourly.is_day[i] ?? 1) === 1,
      });
    }

    return {
      current: {
        temperature: cur.temperature_2m ?? 0,
        feelsLike: cur.apparent_temperature ?? cur.temperature_2m ?? 0,
        humidity: cur.relative_humidity_2m ?? 0,
        precipitation: cur.precipitation ?? 0,
        rainProbability: 0, // Open-Meteo has no current prob — hourly[0] is shown instead
        weatherCode: cur.weather_code ?? 0,
        windSpeed: cur.wind_speed_10m ?? 0,
        windDirection: cur.wind_direction_10m ?? 0,
        isDay: (cur.is_day ?? 1) === 1,
        time: String(cur.time ?? new Date().toISOString()),
      },
      hourly: hourlyOut,
      daily: daily.time.map((date, i) => ({
        date,
        code: daily.weather_code[i] ?? 0,
        tMax: daily.temperature_2m_max[i] ?? 0,
        tMin: daily.temperature_2m_min[i] ?? 0,
        precipProb: daily.precipitation_probability_max[i] ?? 0,
        precipSum: daily.precipitation_sum[i] ?? 0,
        windMax: daily.wind_speed_10m_max[i] ?? 0,
      })),
      timezone: d.timezone ?? "auto",
      fetchedAt: Date.now(),
      source: "Open-Meteo (open-meteo.com) — real observations & forecasts",
    };
  },
});

// ---------------------------------------------------------------------------
// Reverse geocoding — village/taluk/district/state/country
// ---------------------------------------------------------------------------

export interface FarmPlace {
  village: string | null;
  taluk: string | null;
  district: string | null;
  state: string | null;
  country: string | null;
  label: string;
  source: string;
}

const cleanAdm = (s: string | null | undefined): string | null => {
  const v = (s ?? "").replace(/\s+(taluk|taluka|district)$/i, "").trim();
  return v || null;
};

function composeLabel(p: Omit<FarmPlace, "label" | "source">): string {
  const seen: string[] = [];
  for (const part of [p.village ?? p.taluk, p.taluk, p.district, p.state, p.country]) {
    if (part && !seen.includes(part)) seen.push(part);
  }
  return seen.join(", ");
}

export const reverseGeocode = action({
  args: { lat: v.number(), lon: v.number() },
  handler: async (_ctx, { lat, lon }): Promise<{ ok: true; place: FarmPlace } | { ok: false }> => {
    // Primary: BigDataCloud (keyless client endpoint).
    try {
      const r = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
      );
      if (r.ok) {
        const d = (await r.json()) as {
          locality?: string;
          city?: string;
          principalSubdivision?: string;
          countryName?: string;
          localityInfo?: {
            administrative?: { name?: string; adminLevel?: number }[];
          };
        };
        const admin = d.localityInfo?.administrative ?? [];
        const district = cleanAdm(admin.find((a) => a.adminLevel === 5)?.name);
        const taluk = cleanAdm(admin.find((a) => a.adminLevel === 6)?.name);
        if (d.locality || d.city || district || d.principalSubdivision) {
          const base = {
            village: d.locality ?? null,
            taluk,
            district,
            state: d.principalSubdivision ?? null,
            country: d.countryName ?? null,
          };
          return {
            ok: true,
            place: { ...base, label: composeLabel(base), source: "BigDataCloud reverse geocoding" },
          };
        }
      }
    } catch {
      // fall through
    }
    // Fallback: Photon (OpenStreetMap).
    try {
      const r = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`);
      if (r.ok) {
        const d = (await r.json()) as {
          features?: { properties?: Record<string, string> }[];
        };
        const p = d.features?.[0]?.properties;
        if (p) {
          const base = {
            village: p.district ?? p.name ?? null,
            taluk: cleanAdm(p.county),
            district: cleanAdm(p.county) ?? null,
            state: p.state ?? null,
            country: p.country ?? null,
          };
          return {
            ok: true,
            place: { ...base, label: composeLabel(base), source: "Photon / OpenStreetMap" },
          };
        }
      }
    } catch {
      // both failed
    }
    return { ok: false };
  },
});
