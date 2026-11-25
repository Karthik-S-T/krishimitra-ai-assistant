export type WmoGroup =
  | "clear"
  | "partly"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "heavyrain"
  | "snow"
  | "thunder";

/** Map Open-Meteo WMO weather codes to a stable group + emoji. */
export function wmoInfo(code: number): { group: WmoGroup; emoji: string } {
  if (code === 0) return { group: "clear", emoji: "☀️" };
  if (code === 1 || code === 2) return { group: "partly", emoji: "🌤️" };
  if (code === 3) return { group: "cloudy", emoji: "☁️" };
  if (code === 45 || code === 48) return { group: "fog", emoji: "🌫️" };
  if (code >= 51 && code <= 57) return { group: "drizzle", emoji: "🌦️" };
  if (code === 61 || code === 80 || code === 81 || code === 66 || code === 67)
    return { group: "rain", emoji: "🌧️" };
  if (code === 63) return { group: "rain", emoji: "🌧️" };
  if (code === 65 || code === 82) return { group: "heavyrain", emoji: "🌧️" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return { group: "snow", emoji: "❄️" };
  if (code >= 95) return { group: "thunder", emoji: "⛈️" };
  return { group: "cloudy", emoji: "☁️" };
}

export function condKey(group: WmoGroup): string {
  return `cond${group.charAt(0).toUpperCase()}${group.slice(1)}`;
}
