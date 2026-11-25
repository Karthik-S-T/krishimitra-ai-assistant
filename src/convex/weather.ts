/**
 * KrishiMitra AI — Weather + location actions.
 * Mirrors the planned REST surface: GET /api/weather and GET /api/location.
 *
 * Uses Open-Meteo (free, no API key) for weather + place search, and
 * BigDataCloud's keyless reverse-geocoding endpoint for place names.
 */
import { action } from "./_generated/server";
import { v } from "convex/values";

export interface WeatherDaily {
  date: string;
  code: number;
  tMax: number;
  tMin: number;
  precipSum: number;
}

export interface WeatherResult {
  place: string | null;
  current: {
    temperature: number;
    humidity: number;
    precipitation: number;
    weatherCode: number;
    windSpeed: number;
  };
  daily: WeatherDaily[];
}

export const getWeather = action({
  args: { lat: v.number(), lon: v.number() },
  handler: async (_ctx, { lat, lon }): Promise<WeatherResult> => {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      "&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum" +
      "&forecast_days=5&timezone=auto";

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather service error (${res.status})`);
    const data = (await res.json()) as {
      current?: Record<string, number>;
      daily?: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_sum: number[];
      };
    };
    const cur = data.current;
    const daily = data.daily;
    if (!cur || !daily) throw new Error("Incomplete weather response");

    // Best-effort reverse geocoding; never blocks the weather result.
    let place: string | null = null;
    try {
      const r = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
      );
      if (r.ok) {
        const d = (await r.json()) as Record<string, string>;
        place = d.city || d.locality || d.principalSubdivision || null;
      }
    } catch {
      place = null;
    }

    return {
      place,
      current: {
        temperature: cur.temperature_2m ?? 0,
        humidity: cur.relative_humidity_2m ?? 0,
        precipitation: cur.precipitation ?? 0,
        weatherCode: cur.weather_code ?? 0,
        windSpeed: cur.wind_speed_10m ?? 0,
      },
      daily: daily.time.map((date, i) => ({
        date,
        code: daily.weather_code[i] ?? 0,
        tMax: daily.temperature_2m_max[i] ?? 0,
        tMin: daily.temperature_2m_min[i] ?? 0,
        precipSum: daily.precipitation_sum[i] ?? 0,
      })),
    };
  },
});

export interface GeocodeHit {
  name: string;
  admin1: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
}

export const geocodeSearch = action({
  args: { name: v.string() },
  handler: async (_ctx, { name }): Promise<GeocodeHit[]> => {
    const url =
      "https://geocoding-api.open-meteo.com/v1/search?count=6&language=en&format=json&name=" +
      encodeURIComponent(name);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Geocoding service error (${res.status})`);
    const data = (await res.json()) as {
      results?: {
        name: string;
        admin1?: string;
        country?: string;
        latitude: number;
        longitude: number;
      }[];
    };
    const hits = data.results ?? [];
    // Indian locations first — KrishiMitra is focused on Indian farmers.
    return hits
      .sort((a, b) =>
        (a.country === "India" ? 0 : 1) - (b.country === "India" ? 0 : 1))
      .map((h) => ({
        name: h.name,
        admin1: h.admin1 ?? null,
        country: h.country ?? null,
        latitude: h.latitude,
        longitude: h.longitude,
      }));
  },
});
