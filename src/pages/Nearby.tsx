import { useAction } from "convex/react";
import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/context/LanguageContext";
import { PageShell } from "@/components/dashboard/PageShell";
import "leaflet/dist/leaflet.css";

interface Place {
  id: number;
  name: string;
  category: string;
  lat: number;
  lon: number;
  distanceKm: number;
  address: string | null;
  phone: string | null;
  openingHours: string | null;
}

interface OSMElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

const FILTERS = [
  { key: "all", label: "ALL", labelKey: "nbAll" },
  { key: "seeds", label: "SEEDS", labelKey: "nbSeeds" },
  { key: "soil_lab", label: "SOIL LAB", labelKey: "nbSoilLab" },
  { key: "kvk", label: "KVK", labelKey: "nbKvk" },
  { key: "fertilizer", label: "FERTILIZER", labelKey: "nbFertilizer" },
  { key: "equipment", label: "EQUIPMENT", labelKey: "nbEquipment" },
  { key: "apmc", label: "APMC", labelKey: "nbApmc" },
  { key: "buyers", label: "BUYERS" },
  { key: "bank", label: "BANK", labelKey: "nbBank" },
  { key: "agrovet", label: "AGROVET", labelKey: "nbAgrovet" },
] as const;

const KNOWN_PLACES: Record<string, { lat: number; lon: number; label: string }> = {
  devanahalli: { lat: 13.2473, lon: 77.7131, label: "Devanahalli, Karnataka" },
  chikkaballapur: { lat: 13.4355, lon: 77.7315, label: "Chikkaballapur, Karnataka" },
  mandya: { lat: 12.5224, lon: 76.8951, label: "Mandya, Karnataka" },
  kolar: { lat: 13.1367, lon: 78.1292, label: "Kolar, Karnataka" },
  mysuru: { lat: 12.2958, lon: 76.6394, label: "Mysuru, Karnataka" },
  bengaluru: { lat: 12.9716, lon: 77.5946, label: "Bengaluru, Karnataka" },
};

const LOCAL_DIRECTORY: { category: string; name: string; latOffset: number; lonOffset: number }[] = [
  { category: "apmc", name: "Regulated Produce Market · demo listing", latOffset: 0.035, lonOffset: 0.018 },
  { category: "buyers", name: "FPO & Wholesale Crop Buyers · demo directory", latOffset: -0.024, lonOffset: 0.03 },
  { category: "buyers", name: "Produce Cold Storage · demo directory", latOffset: 0.015, lonOffset: -0.04 },
  { category: "seeds", name: "Agricultural Seed Dealer · demo directory", latOffset: -0.018, lonOffset: -0.014 },
  { category: "soil_lab", name: "Soil Testing Laboratory · demo directory", latOffset: 0.048, lonOffset: -0.026 },
  { category: "kvk", name: "Krishi Vigyan Kendra · demo directory", latOffset: -0.055, lonOffset: 0.012 },
  { category: "fertilizer", name: "Fertilizer Depot · demo directory", latOffset: 0.012, lonOffset: 0.052 },
  { category: "equipment", name: "Farm Equipment Service · demo directory", latOffset: -0.04, lonOffset: -0.038 },
  { category: "bank", name: "Rural Agricultural Bank · demo directory", latOffset: 0.026, lonOffset: -0.008 },
  { category: "agrovet", name: "Agrovet & Crop Care Centre · demo directory", latOffset: -0.012, lonOffset: 0.045 },
];

const timeoutFetch = async (url: string, init?: RequestInit, ms = 9000) => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
};

const withTimeout = <T,>(request: Promise<T>, ms = 9000): Promise<T> =>
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

const distanceBetween = (aLat: number, aLon: number, bLat: number, bLon: number) => {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(bLat - aLat);
  const dLon = radians(bLon - aLon);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(aLat)) *
      Math.cos(radians(bLat)) *
      Math.sin(dLon / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(x)) * 10) / 10;
};

const classifyOSM = (tags: Record<string, string>): string | null => {
  const shop = tags.shop ?? "";
  const amenity = tags.amenity ?? "";
  const office = tags.office ?? "";
  if (tags.healthcare === "laboratory" || tags["laboratory:type"] === "soil") return "soil_lab";
  if (amenity === "research_institute" || office === "government" && /krishi|agri|kvk/i.test(tags.name ?? "")) return "kvk";
  if (amenity === "bank") return "bank";
  if (amenity === "marketplace") return "apmc";
  if (shop === "wholesale" || /fpo|farmer producer|cold storage|crop buyer/i.test(tags.name ?? "")) return "buyers";
  if (shop === "agricultural" || shop === "seeds") return "seeds";
  if (shop === "agrarian" || shop === "fertilizer") return "fertilizer";
  if (shop === "farm" || shop === "garden_centre") return "agrovet";
  if (shop === "trade" || /machinery|equipment/i.test(tags.trade ?? "")) return "equipment";
  return null;
};

const placesFromOSM = (elements: OSMElement[], lat: number, lon: number): Place[] =>
  elements.flatMap((element) => {
    const pointLat = element.lat ?? element.center?.lat;
    const pointLon = element.lon ?? element.center?.lon;
    const tags = element.tags ?? {};
    const category = classifyOSM(tags);
    if (pointLat === undefined || pointLon === undefined || !category || !tags.name) return [];
    const address = [
      tags["addr:street"],
      tags["addr:suburb"],
      tags["addr:village"],
      tags["addr:town"],
      tags["addr:city"],
      tags["addr:postcode"],
    ].filter(Boolean).join(", ");
    return [{
      id: element.id,
      name: tags.name,
      category,
      lat: pointLat,
      lon: pointLon,
      distanceKm: distanceBetween(lat, lon, pointLat, pointLon),
      address: address || null,
      phone: tags.phone ?? tags["contact:phone"] ?? null,
      openingHours: tags.opening_hours ?? "Hours not listed by OpenStreetMap",
    }];
  }).sort((a, b) => a.distanceKm - b.distanceKm);

const localDirectory = (lat: number, lon: number, label: string): Place[] =>
  LOCAL_DIRECTORY.map((entry, index) => {
    const placeLat = lat + entry.latOffset;
    const placeLon = lon + entry.lonOffset;
    return {
      id: 8_000_000 + index,
      name: entry.name,
      category: entry.category,
      lat: placeLat,
      lon: placeLon,
      distanceKm: distanceBetween(lat, lon, placeLat, placeLon),
      address: `Illustrative reference near ${label}`,
      phone: null,
      openingHours: "Demo listing · confirm locally before travel",
    };
  }).sort((a, b) => a.distanceKm - b.distanceKm);

const gmaps = (lat: number, lon: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
const gdir = (dlat: number, dlon: number, lat: number, lon: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${dlat},${dlon}&origin=${lat},${lon}&travelmode=driving`;

export default function Nearby() {
  const { t } = useLang();
  const search = useAction(api.nearby.getNearbyServices);
  const geocodeAction = useAction(api.weather.geocodeSearch);
  const hasConvexUrl = Boolean(import.meta.env.VITE_CONVEX_URL?.trim());
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  const [pos, setPos] = useState<{ lat: number; lon: number } | null>(null);
  const [locLabel, setLocLabel] = useState("Devanahalli, Karnataka");
  const [locState, setLocState] = useState<"idle" | "locating" | "denied" | "ok">("idle");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState("");
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"osm" | "demo" | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const shownPlaces = useMemo(
    () => (places ?? []).filter((place) => filter === "all" || place.category === filter),
    [places, filter],
  );

  const getLocalPlaces = useCallback((lat: number, lon: number, label: string) => {
    setPlaces(localDirectory(lat, lon, label));
    setSource("demo");
    setFetchedAt(Date.now());
    setError(null);
  }, []);

  const run = useCallback(async (lat: number, lon: number, label: string) => {
    setLoading(true);
    setError(null);
    try {
      if (hasConvexUrl) {
        const result = await withTimeout(search({ lat, lon, radiusKm: 25 }));
        if (result.ok && result.places.length > 0) {
          setPlaces(result.places as Place[]);
          setSource("osm");
          setFetchedAt(result.at);
          return;
        }
      } else {
        const around = `(around:25000,${lat},${lon})`;
        const query =
          `[out:json][timeout:8];(` +
          `nwr${around}[shop~"agricultural|agrarian|farm|garden_centre|wholesale|seeds|fertilizer"];` +
          `nwr${around}[amenity~"marketplace|bank|research_institute"];` +
          `nwr${around}[healthcare=laboratory];);out center 100;`;
        const response = await timeoutFetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(query)}`,
        });
        if (response.ok) {
          const payload = (await response.json()) as { elements?: OSMElement[] };
          const osmPlaces = placesFromOSM(payload.elements ?? [], lat, lon);
          if (osmPlaces.length > 0) {
            setPlaces(osmPlaces.slice(0, 60));
            setSource("osm");
            setFetchedAt(Date.now());
            return;
          }
        }
      }
      getLocalPlaces(lat, lon, label);
    } catch {
      getLocalPlaces(lat, lon, label);
    } finally {
      setLoading(false);
    }
  }, [getLocalPlaces, hasConvexUrl, search]);

  const usePosition = useCallback((lat: number, lon: number, label: string) => {
    setPos({ lat, lon });
    setLocLabel(label);
    setLocState("ok");
    void run(lat, lon, label);
  }, [run]);

  const useDefaultLocation = useCallback(() => {
    const place = KNOWN_PLACES.devanahalli!;
    usePosition(place.lat, place.lon, place.label);
  }, [usePosition]);

  const locate = useCallback(() => {
    setLocState("locating");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      useDefaultLocation();
      return;
    }
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          usePosition(latitude, longitude, `GPS location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
        },
        () => {
          setLocState("denied");
          useDefaultLocation();
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 },
      );
    } catch {
      setLocState("denied");
      useDefaultLocation();
    }
  }, [useDefaultLocation, usePosition]);

  const submitManual = useCallback(async () => {
    const name = manualText.trim();
    if (!name) return;
    setLocState("locating");
    setError(null);
    try {
      let coordinates: { lat: number; lon: number; label: string } | null = null;
      if (hasConvexUrl) {
        try {
          const hits = await withTimeout(geocodeAction({ name }), 6000);
          const hit = hits.find((item: { country: string | null }) => item.country === "India") ?? hits[0];
          if (hit) coordinates = { lat: hit.latitude, lon: hit.longitude, label: hit.name };
        } catch {
          coordinates = null;
        }
      }
      if (!coordinates) {
        try {
          const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&country=India&q=${encodeURIComponent(name)}`;
          const response = await timeoutFetch(url, { headers: { "Accept-Language": "en" } }, 7000);
          if (response.ok) {
            const hits = (await response.json()) as NominatimResult[];
            const hit = hits[0];
            if (hit) {
              const lat = Number(hit.lat);
              const lon = Number(hit.lon);
              if (Number.isFinite(lat) && Number.isFinite(lon)) {
                coordinates = { lat, lon, label: hit.display_name.split(",").slice(0, 3).join(",") };
              }
            }
          }
        } catch {
          coordinates = null;
        }
      }
      if (!coordinates) {
        const normalized = name.toLowerCase();
        const knownKey = Object.keys(KNOWN_PLACES).find((key) => normalized.includes(key));
        if (knownKey) coordinates = KNOWN_PLACES[knownKey]!;
      }
      if (!coordinates) {
        setLocState("denied");
        setError("Location could not be geocoded; showing the Devanahalli demo directory.");
        useDefaultLocation();
        return;
      }
      setManualOpen(false);
      usePosition(coordinates.lat, coordinates.lon, coordinates.label);
    } catch {
      setError("Could not search that place; showing the Devanahalli demo directory.");
      useDefaultLocation();
    }
  }, [geocodeAction, hasConvexUrl, manualText, useDefaultLocation, usePosition]);

  useEffect(() => {
    const mapElement = mapElementRef.current;
    if (!mapElement || mapRef.current) return;
    const map = L.map(mapElement).setView([13.2473, 77.7131], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = markersRef.current;
    if (!map || !group) return;
    group.clearLayers();
    if (pos) map.setView([pos.lat, pos.lon], 10);
    const pins = shownPlaces;
    pins.forEach((place) => {
      const popup = document.createElement("div");
      popup.textContent = `${place.name} · ${place.distanceKm} km · ${place.category}`;
      L.circleMarker([place.lat, place.lon], {
        radius: 7,
        color: "#0F2E1D",
        weight: 2,
        fillColor: place.category === "buyers" ? "#EAB308" : "#2fa35c",
        fillOpacity: 0.9,
      })
        .bindPopup(popup)
        .addTo(group);
    });
    if (pins.length > 1) {
      map.fitBounds(L.latLngBounds(pins.map((place) => L.latLng(place.lat, place.lon))), {
        padding: [24, 24],
        maxZoom: 12,
      });
    }
  }, [pos, shownPlaces]);

  useEffect(() => {
    locate();
  }, [locate]);

  return (
    <PageShell title={t("nbTitle")} emoji="📍">
      <h1 className="mb-1 font-display text-2xl uppercase">📍 {t("nbTitle")}</h1>
      <p className="mb-4 text-xs font-semibold text-[#5c574b]">{t("nbSub")}</p>

      <div className="nb-border nb-shadow-sm mb-4 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={locate}
            className="nb-press nb-border bg-[#2fa35c] px-4 py-2 text-xs font-bold uppercase text-white"
          >
            📍 {locState === "locating" ? t("nbLocating") : t("nbUseMyLocation")}
          </button>
          <button
            type="button"
            onClick={() => setManualOpen((open) => !open)}
            className="nb-press nb-border bg-white px-4 py-2 text-xs font-bold uppercase"
          >
            ⌨️ {t("nbManual")}
          </button>
          {pos && <span className="text-[11px] font-bold text-[#5c574b]">{locLabel} · {pos.lat.toFixed(3)}, {pos.lon.toFixed(3)}</span>}
        </div>
        {manualOpen && (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void submitManual();
            }}
          >
            <input
              value={manualText}
              onChange={(event) => setManualText(event.target.value)}
              placeholder={t("nbManualPh")}
              className="nb-border min-w-0 flex-1 bg-[#f5f0e6] px-3 py-2 text-sm font-semibold outline-none"
            />
            <button type="submit" className="nb-press nb-border bg-[#ffc53d] px-3 py-2 text-xs font-bold uppercase">
              {t("nbGo")}
            </button>
          </form>
        )}
        {error && <p className="mt-3 text-xs font-semibold text-[#854D0E]">{error}</p>}
      </div>

      <p className="nb-border mb-3 bg-[#FEF3C7] px-3 py-2 text-[11px] font-semibold text-[#854D0E]">
        {source === "demo"
          ? "Illustrative demo directory only — listings, distances and hours are not verified; confirm details before travel."
          : "OpenStreetMap community listings may be incomplete. Confirm hours and services before travelling."}
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`nb-press nb-border px-3 py-1.5 text-[10px] font-bold uppercase ${filter === item.key ? "bg-[#ffc53d]" : "bg-white"}`}
          >
            {"labelKey" in item && item.labelKey ? t(item.labelKey) : item.label}
          </button>
        ))}
      </div>

      <div ref={mapElementRef} className="mb-4 h-72 w-full overflow-hidden border-2 border-[#141414] nb-shadow-sm sm:h-96" aria-label="Map of nearby agriculture services" />
      {loading && <p className="mb-3 text-sm font-semibold">⏳ {t("nbSearching")}</p>}
      {!loading && (
        <div className="grid gap-3 md:grid-cols-2">
          {shownPlaces.map((place) => (
            <article key={place.id} className="nb-border nb-shadow-sm bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-base uppercase leading-tight">{place.name}</p>
                <span className="nb-border shrink-0 bg-[#ede7d8] px-2 py-0.5 text-[10px] font-black uppercase">{place.distanceKm} km</span>
              </div>
              <p className="mt-1 text-[10px] font-bold uppercase text-[#1B4332]">{place.category.replace("_", " ")}</p>
              <p className="mt-1 text-xs font-semibold text-[#5c574b]">📍 {place.address ?? "Address not listed"}</p>
              <p className="mt-0.5 text-xs font-semibold text-[#5c574b]">
                🕐 Open status: {source === "demo" ? "Not verified" : place.openingHours ? "Hours listed" : "Not listed"} · {place.openingHours ?? "Hours not listed"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {place.phone && (
                  <a href={`tel:${place.phone}`} className="nb-press nb-border bg-[#2fa35c] px-3 py-1.5 text-[10px] font-bold uppercase text-white">
                    📞 {t("nbCall")}
                  </a>
                )}
                <a href={gmaps(place.lat, place.lon)} target="_blank" rel="noreferrer noopener" className="nb-press nb-border bg-white px-3 py-1.5 text-[10px] font-bold uppercase">
                  🗺️ {t("nbViewMap")}
                </a>
                {pos && (
                  <a href={gdir(place.lat, place.lon, pos.lat, pos.lon)} target="_blank" rel="noreferrer noopener" className="nb-press nb-border bg-[#5fa8e8] px-3 py-1.5 text-[10px] font-bold uppercase text-white">
                    ➜ {t("nbDirections")}
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {!loading && shownPlaces.length === 0 && places !== null && (
        <div className="nb-card p-8 text-center">
          <p className="font-display text-base uppercase">{t("nbNone")}</p>
          <p className="mt-1 text-xs font-semibold text-[#5c574b]">{t("nbNoneHint")}</p>
        </div>
      )}
      {fetchedAt && (
        <p className="mt-4 text-[11px] font-semibold text-[#5c574b]">
          {source === "demo" ? "Illustrative demo directory" : "OpenStreetMap contributors"} · {new Date(fetchedAt).toLocaleString()}
        </p>
      )}
    </PageShell>
  );
}
