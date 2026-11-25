import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { area as turfArea } from "@turf/area";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useLang } from "@/context/LanguageContext";
import "leaflet/dist/leaflet.css";

/**
 * KrishiMitra AI — Phase 4: GPS + farm boundary mapping (Leaflet).
 *
 * • "Use My Current Location" uses the browser Geolocation API. GPS gives
 *   coordinates ONLY — it never measures N/P/K/pH (gpsNote is shown).
 * • Marker is draggable + click-to-place so the farmer can adjust a poor
 *   GPS fix ("Adjust Location" mode).
 * • Polygon draw (2-tap rectangle) / edit (draggable corner handles) /
 *   delete / redraw / save / clear — no external draw plugin, keeps the
 *   bundle small for low-bandwidth farmers.
 * • Area is computed from the actual polygon with turf.area — never from a
 *   single GPS point — and shown in m² / acres / hectares.
 */

type LatLngTuple = [number, number]; // [lat, lng] (Leaflet order, stored in DB)

const OSM_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ESRI_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

function rectPoints(b: L.LatLngBounds): LatLngTuple[] {
  const s = b.getSouth();
  const w = b.getWest();
  const n = b.getNorth();
  const e = b.getEast();
  return [
    [n, w],
    [n, e],
    [s, e],
    [s, w],
  ];
}

export function FarmMap({
  fieldId,
  onGeocode,
}: {
  fieldId: Id<"fields"> | null;
  /** Called with new coordinates whenever the marker is set/dragged/placed. */
  onGeocode?: (lat: number, lon: number) => void;
}) {
  const { t } = useLang();

  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const rectRef = useRef<L.Rectangle | null>(null);
  const handlesRef = useRef<L.LayerGroup | null>(null);
  const drawClicksRef = useRef<L.LatLng[]>([]);

  const [geo, setGeo] = useState<{ lat: number; lon: number; accuracy?: number } | null>(null);
  const [placing, setPlacing] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [boundary, setBoundary] = useState<LatLngTuple[] | null>(null);
  const [savedBoundary, setSavedBoundary] = useState<LatLngTuple[] | null>(null);
  const [satLayer, setSatLayer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [geoStatus, setGeoStatus] = useState<"idle" | "locating" | "denied" | "unavailable">(
    "idle",
  );

  const updateField = useMutation(api.cropData.updateField);

  // ---- reset per-field state ----------------------------------------------
  const lastFieldRef = useRef<Id<"fields"> | null>(null);
  useEffect(() => {
    if (fieldId === lastFieldRef.current) return;
    lastFieldRef.current = fieldId;
    setGeo(null);
    setBoundary(null);
    setSavedBoundary(null);
    setDrawing(false);
    setEditing(false);
    setPlacing(false);
    setSavedFlash(false);
  }, [fieldId]);

  // ---- map bootstrap -------------------------------------------------------
  useEffect(() => {
    if (mapRef.current || !mapElRef.current) return;
    const map = L.map(mapElRef.current, { zoomControl: true }).setView([14.6, 75.6], 6);
    tileRef.current = L.tileLayer(OSM_URL, {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
    handlesRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
      handlesRef.current = null;
      markerRef.current = null;
      rectRef.current = null;
    };
  }, []);

  // ---- base/satellite tile switching --------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) map.removeLayer(layer);
    });
    tileRef.current = L.tileLayer(satLayer ? ESRI_URL : OSM_URL, {
      maxZoom: 19,
      attribution: satLayer ? "© Esri World Imagery" : "© OpenStreetMap contributors",
    }).addTo(map);
    tileRef.current.bringToBack();
  }, [satLayer]);

  // ---- GPS -----------------------------------------------------------------
  const placeMarker = useCallback((lat: number, lon: number, zoom?: number) => {
    const map = mapRef.current;
    if (!map) return;
    if (zoom) map.setView([lat, lon], zoom);
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
    } else {
      markerRef.current = L.marker([lat, lon], { draggable: true })
        .addTo(map)
        .bindPopup("📍");
      markerRef.current.on("dragend", () => {
        const p = markerRef.current!.getLatLng();
        setGeo((g) => ({ lat: p.lat, lon: p.lng, accuracy: g?.accuracy }));
        onGeocode?.(p.lat, p.lng);
      });
    }
  }, []);

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoStatus("unavailable");
      return;
    }
    setGeoStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGeo({ lat: latitude, lon: longitude, accuracy });
        setGeoStatus("idle");
        placeMarker(latitude, longitude, 17);
        onGeocode?.(latitude, longitude);
      },
      (err) => {
        setGeoStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }, [placeMarker]);

  // ---- click-to-place (manual adjust) --------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onClick = (e: L.LeafletMouseEvent) => {
      setGeo({ lat: e.latlng.lat, lon: e.latlng.lng });
      placeMarker(e.latlng.lat, e.latlng.lng);
      onGeocode?.(e.latlng.lat, e.latlng.lng);
      setPlacing(false);
    };
    if (placing) map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [placing, placeMarker]);

  const recenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (geo) map.setView([geo.lat, geo.lon], 17);
    else if (boundary && boundary.length >= 3) {
      map.fitBounds(L.latLngBounds(boundary as L.LatLngTuple[]), { padding: [30, 30] });
    }
  }, [geo, boundary]);

  // ---- corner handles (edit mode) ------------------------------------------
  const renderHandles = useCallback((bounds: L.LatLngBounds) => {
    const group = handlesRef.current;
    if (!group) return;
    group.clearLayers();
    const corners: { lat: number; lng: number }[] = [
      bounds.getNorthWest(),
      bounds.getNorthEast(),
      bounds.getSouthEast(),
      bounds.getSouthWest(),
    ];
    corners.forEach((c) => {
      L.circleMarker([c.lat, c.lng], {
        radius: 7,
        color: "#141414",
        weight: 2,
        fillColor: "#ffc53d",
        fillOpacity: 1,
      })
        .addTo(group)
        .on("drag", (e) => {
          const r = rectRef.current;
          if (!r) return;
          const ll = (e.target as L.CircleMarker).getLatLng();
          const nb = r.getBounds();
          const midLat = (nb.getNorth() + nb.getSouth()) / 2;
          const midLng = (nb.getWest() + nb.getEast()) / 2;
          const isNorth = c.lat > midLat;
          const isWest = c.lng < midLng;
          const next = L.latLngBounds(
            L.latLng(isNorth ? ll.lat : nb.getSouth(), isWest ? ll.lng : nb.getEast()),
            L.latLng(isNorth ? nb.getNorth() : ll.lat, isWest ? nb.getWest() : ll.lng),
          );
          r.setBounds(next);
          renderHandles(next);
          setBoundary(rectPoints(next));
        });
    });
  }, []);

  // ---- draw / edit / clear ---------------------------------------------------
  const startDraw = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    setEditing(false);
    setDrawing(true);
    drawClicksRef.current = [];
    const onClick = (e: L.LeafletMouseEvent) => {
      drawClicksRef.current.push(e.latlng);
      if (drawClicksRef.current.length >= 2) {
        map.off("click", onClick);
        const b = L.latLngBounds(drawClicksRef.current[0], drawClicksRef.current[1]);
        if (rectRef.current) rectRef.current.remove();
        rectRef.current = L.rectangle(b, {
          color: "#141414",
          weight: 2,
          fillColor: "#7fb069",
          fillOpacity: 0.25,
        }).addTo(map);
        setBoundary(rectPoints(b));
        setDrawing(false);
      }
    };
    map.on("click", onClick);
  }, []);

  const startEdit = useCallback(() => {
    const r = rectRef.current;
    if (!r) return;
    setEditing(true);
    renderHandles(r.getBounds());
  }, [renderHandles]);

  const finishEdit = useCallback(() => {
    const r = rectRef.current;
    if (r) setBoundary(rectPoints(r.getBounds()));
    handlesRef.current?.clearLayers();
    setEditing(false);
  }, []);

  const clearBoundary = useCallback(() => {
    rectRef.current?.remove();
    rectRef.current = null;
    handlesRef.current?.clearLayers();
    setBoundary(null);
  }, []);

  // keep the rectangle synced when boundary changes externally (save/clear)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!boundary || boundary.length < 3) {
      if (rectRef.current) {
        rectRef.current.remove();
        rectRef.current = null;
      }
      handlesRef.current?.clearLayers();
      return;
    }
    if (!rectRef.current && !drawing) {
      rectRef.current = L.rectangle(L.latLngBounds(boundary as L.LatLngTuple[]), {
        color: "#141414",
        weight: 2,
        fillColor: "#7fb069",
        fillOpacity: 0.25,
      }).addTo(map);
      map.fitBounds(rectRef.current.getBounds(), { padding: [30, 30] });
    }
  }, [boundary, drawing]);

  // ---- area (turf, from the actual polygon) --------------------------------
  const area = useMemo(() => {
    if (!boundary || boundary.length < 3) return null;
    const ring: [number, number][] = boundary.map(([lat, lng]) => [lng, lat]);
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
    try {
      return turfArea({ type: "Polygon", coordinates: [ring] } as never) as number;
    } catch {
      return null;
    }
  }, [boundary]);

  const center = useMemo<[number, number]>(() => {
    if (boundary && boundary.length >= 3) {
      return [
        boundary.reduce((s, p) => s + p[0], 0) / boundary.length,
        boundary.reduce((s, p) => s + p[1], 0) / boundary.length,
      ];
    }
    return [0, 0];
  }, [boundary]);

  const fmt = (n: number) =>
    n >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : n.toFixed(2);

  // ---- save ------------------------------------------------------------------
  const canSave = Boolean(fieldId && boundary && boundary.length >= 3 && area && area >= 100);
  const save = useCallback(async () => {
    if (!fieldId || !boundary || !area) return;
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {
        fieldId,
        boundary,
        areaSqM: area,
        geoUpdatedAt: Date.now(),
      };
      if (geo) {
        patch.lat = geo.lat;
        patch.lon = geo.lon;
      }
      await updateField(patch as never);
      setSavedBoundary(boundary);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2500);
    } finally {
      setSaving(false);
    }
  }, [fieldId, boundary, area, geo, updateField]);

  const dirty =
    Boolean(boundary) &&
    JSON.stringify(boundary) !== JSON.stringify(savedBoundary);

  return (
    <div className="space-y-3">
      {/* GPS buttons */}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={locate} disabled={geoStatus === "locating"}>
          {geoStatus === "locating" ? "⏳" : "📍"} {t("gpsBtn")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={recenter}>
          🎯 {t("gpsRecenter")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={placing ? "default" : "outline"}
          onClick={() => setPlacing((p) => !p)}
        >
          ✋ {t("gpsAdjust")}
        </Button>
      </div>

      {geoStatus === "denied" && (
        <p className="border-2 border-[#141414] bg-[#f87171]/20 px-3 py-2 text-xs font-semibold">
          {t("gpsDeniedMap")}
        </p>
      )}
      {geoStatus === "unavailable" && (
        <p className="border-2 border-[#141414] bg-[#fbbf24]/25 px-3 py-2 text-xs font-semibold">
          {t("gpsUnavailable")}
        </p>
      )}
      {placing && (
        <p className="border-2 border-[#141414] bg-[#ffc53d]/40 px-3 py-2 text-xs font-semibold">
          {t("gpsAdjust")} — {t("revAdjustHint")}
        </p>
      )}

      {geo && (
        <div className="border-2 border-[#141414] bg-white px-3 py-2 text-xs font-semibold nb-shadow-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            <span>
              Lat: <b>{geo.lat.toFixed(5)}</b>
            </span>
            <span>
              Lon: <b>{geo.lon.toFixed(5)}</b>
            </span>
            <span>
              {t("gpsAccuracy")}: <b>{geo.accuracy ? `±${Math.round(geo.accuracy)} m` : "—"}</b>
            </span>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="relative">
        <div
          ref={mapElRef}
          className={`h-72 w-full border-2 border-[#141414] nb-shadow-sm sm:h-80 ${placing ? "cursor-crosshair" : ""}`}
        />
        <button
          type="button"
          onClick={() => setSatLayer((s) => !s)}
          className="absolute right-2 top-2 z-[500] border-2 border-[#141414] bg-white px-2 py-1 text-[10px] font-bold uppercase nb-shadow-sm"
        >
          {satLayer ? "🗺️ OSM" : "🛰️ Esri"}
        </button>
      </div>

      {/* Boundary controls */}
      <div className="flex flex-wrap items-center gap-2">
        {!drawing && (!boundary || boundary.length < 3) && (
          <Button type="button" size="sm" onClick={startDraw}>
            ✏️ {t("bndDraw")}
          </Button>
        )}
        {drawing && (
          <span className="border-2 border-[#141414] bg-[#ffc53d] px-3 py-1.5 text-xs font-bold uppercase nb-shadow-sm">
            {t("bndDrawHint")}
          </span>
        )}
        {boundary && boundary.length >= 3 && (
          <>
            {!editing ? (
              <Button type="button" size="sm" variant="outline" onClick={startEdit}>
                ✋ {t("bndEdit")}
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={finishEdit}>
                ✔ {t("bndFinish")}
              </Button>
            )}
            <Button type="button" size="sm" variant="outline" onClick={startDraw}>
              🔄 {t("bndRedraw")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={clearBoundary}
              disabled={saving}
            >
              🗑️ {t("bndClear")}
            </Button>
            {fieldId && (
              <Button
                type="button"
                size="sm"
                onClick={save}
                disabled={!canSave || saving || (!dirty && Boolean(savedBoundary))}
              >
                💾 {saving ? t("farmSaving") : t("bndSave")}
              </Button>
            )}
          </>
        )}
      </div>

      {!fieldId && boundary && boundary.length >= 3 && (
        <p className="border-2 border-[#141414] bg-[#fbbf24]/25 px-3 py-2 text-xs font-semibold">
          {t("bndNeed")}
        </p>
      )}

      {area !== null && (
        <div className="border-2 border-[#141414] bg-white px-3 py-2 text-xs font-semibold nb-shadow-sm">
          <p className="mb-1 font-display text-sm uppercase">{t("bndArea")}</p>
          <div className="grid grid-cols-3 gap-2">
            <span>{fmt(area)} m²</span>
            <span>{(area / 4046.8564224).toFixed(2)} ac</span>
            <span>{(area / 10000).toFixed(2)} ha</span>
          </div>
          <p className="mt-2 text-[11px] font-medium text-[#5c574b]">
            {t("bndCoords")}: {boundary!.length} pts · {t("bndCenter")}:{" "}
            {center[0].toFixed(5)}, {center[1].toFixed(5)}
          </p>
        </div>
      )}

      {savedFlash && (
        <p className="border-2 border-[#141414] bg-[#7fb069]/30 px-3 py-2 text-xs font-bold">
          {t("bndSavedMsg")}
        </p>
      )}

      {/* GPS rule reminder */}
      <p className="text-[11px] font-medium leading-snug text-[#5c574b]">{t("gpsNote")}</p>
    </div>
  );
}
