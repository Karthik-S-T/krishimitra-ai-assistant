/**
 * KrishiMitra AI — India administrative location data.
 *
 * Real data sources (nothing invented):
 *  • States / districts / taluks (blocks): LGD-mapped India Post dataset
 *    (github: bilal-webdev/india-postal-pincode-dataset — Local Government
 *    Directory codes) shipped as ./indiaLocations.json
 *  • Villages: official India Post PIN API (api.postalpincode.in) — post
 *    office localities per pincode, looked up server-side per taluk and
 *    cached. Villages are fetched on demand so the bundle stays small.
 *
 * Titles are converted to standard case (HAVERI → Haveri) for display only;
 * the underlying administrative relationships come from the dataset.
 */
import raw from "./indiaLocations.json";

export interface IndiaLocationData {
  _meta: {
    source: string;
    villageSource: string;
    pincodesIncludedFor: string;
    generated: string;
  };
  states: string[];
  districtsByState: Record<string, string[]>;
  taluksByDistrict: Record<string, string[]>; // key: "State|District"
  pincodesByTaluk: Record<string, string[]>; // key: "State|District|Taluk"
}

const data = raw as unknown as IndiaLocationData;

/** Title-case conversion used by the generator ("HAVERI" → "Haveri"). */
export const getStateNames = (): string[] => data.states;

export const getDistrictsFor = (state: string): string[] =>
  state ? data.districtsByState[state] ?? [] : [];

export const getTaluksFor = (state: string, district: string): string[] =>
  state && district
    ? data.taluksByDistrict[`${state}|${district}`] ?? []
    : [];

export const getPincodesFor = (
  state: string,
  district: string,
  taluk: string,
): string[] =>
  state && district && taluk
    ? data.pincodesByTaluk[`${state}|${district}|${taluk}`] ?? []
    : [];

export const LOCATION_META = data._meta;

/** Karnataka-first ordering: Karnataka (and neighbours) float to the top. */
export const orderedStates = (): string[] => {
  const priority = ["Karnataka"];
  return [...priority, ...data.states.filter((s) => !priority.includes(s))];
};

/** Case-insensitive, partial match search over a list (farmer-friendly). */
export const searchList = (list: string[], q: string, limit = 40): string[] => {
  const needle = q.trim().toLowerCase();
  if (!needle) return list.slice(0, limit);
  const starts: string[] = [];
  const contains: string[] = [];
  for (const item of list) {
    const lower = item.toLowerCase();
    if (lower.startsWith(needle)) starts.push(item);
    else if (lower.includes(needle)) contains.push(item);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
};
