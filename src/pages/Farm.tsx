import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PageShell } from "@/components/dashboard/PageShell";
import { FarmMap } from "@/components/dashboard/FarmMap";
import { FarmWeatherPanel } from "@/components/dashboard/FarmWeatherPanel";
import { SatellitePanel } from "@/components/dashboard/SatellitePanel";
import { SuitabilityPanel } from "@/components/dashboard/SuitabilityPanel";
import { ManualLocationCard } from "@/components/dashboard/ManualLocationCard";
import type { ManualLocation } from "@/components/dashboard/ManualLocationCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/context/LanguageContext";
import type { Lang } from "@/lib/i18n";

/**
 * KrishiMitra AI — Phases 4–7 farm dashboard: Location / Boundary / Weather /
 * Satellite / Suitability tabs. Reuses the existing fields table (geo columns
 * added in Phase 4) — no duplicate farm model. Place info comes from real
 * reverse geocoding (OSM Nominatim via the Convex action) and shows
 * "unavailable" on failure — never a fabricated district/state.
 */

type Tab = "loc" | "bnd" | "wx" | "sat" | "suit";

const TABS: { key: Tab; label: string }[] = [
  { key: "loc", label: "tabFarmLoc" },
  { key: "bnd", label: "tabFarmBoundary" },
  { key: "wx", label: "tabFarmWeather" },
  { key: "sat", label: "tabFarmSat" },
  { key: "suit", label: "tabFarmSuit" },
];

type LocMethod = "manual" | "gps" | "draw";

/** Three-method chooser labels (spec: USE CURRENT LOCATION / SELECT LOCATION
 *  MANUALLY / DRAW FIELD ON MAP). Local per-locale map — see Landing.tsx note
 *  on why these live next to their use. */
const LOC_METHOD: Record<Lang, { prompt: string; manual: string; gps: string; draw: string; gpsHint: string; drawHint: string }> = {
  en: {
    prompt: "Choose how you want to provide your location",
    manual: "🗺️ Select location manually",
    gps: "📍 Use current location",
    draw: "✏️ Draw field on map",
    gpsHint: 'Tap "Use My Current Location" on the map below.',
    drawHint: "Use the draw tools on the map below to outline your field.",
  },
  kn: {
    prompt: "ನಿಮ್ಮ ಸ್ಥಳವನ್ನು ಹೇಗೆ ನೀಡಬೇಕು ಎಂದು ಆಯ್ಕೆಮಾಡಿ",
    manual: "🗺️ ಸ್ಥಳವನ್ನು ಕೈಯಿಂದ ಆಯ್ಕೆಮಾಡಿ",
    gps: "📍 ಪ್ರಸ್ತುತ ಸ್ಥಳ ಬಳಸಿ",
    draw: "✏️ ನಕ್ಷೆಯಲ್ಲಿ ಜಮೀನನ್ನು ಗುರುತಿಸಿ",
    gpsHint: "ಕೆಳಗಿನ ನಕ್ಷೆಯಲ್ಲಿ \"ನನ್ನ ಪ್ರಸ್ತುತ ಸ್ಥಳ ಬಳಸಿ\" ಒತ್ತಿರಿ.",
    drawHint: "ಕೆಳಗಿನ ನಕ್ಷೆಯ ಡ್ರಾ ಸಾಧನಗಳನ್ನು ಬಳಸಿ ನಿಮ್ಮ ಜಮೀನಿನ ಗಡಿಯನ್ನು ಗುರುತಿಸಿ.",
  },
  hi: {
    prompt: "अपना स्थान कैसे देना चाहते हैं, चुनें",
    manual: "🗺️ स्थान मैन्युअली चुनें",
    gps: "📍 वर्तमान स्थान उपयोग करें",
    draw: "✏️ नक्शे पर खेत बनाएं",
    gpsHint: "नीचे नक्शे पर \"मेरा वर्तमान स्थान उपयोग करें\" दबाएं।",
    drawHint: "नीचे नक्शे के ड्रा टूल्स से अपने खेत की सीमा बनाएं।",
  },
};

export default function Farm() {
  const { t, lang } = useLang();
  const LM = LOC_METHOD[lang];
  const listFields = useQuery(api.cropData.listFields);
  const addField = useMutation(api.cropData.addField);
  const reverseGeocode = useAction(api.farmWeather.reverseGeocode);

  const [tab, setTab] = useState<Tab>("loc");
  // Spec default: "SELECT LOCATION MANUALLY" is the easiest path for farmers.
  const [locMethod, setLocMethod] = useState<LocMethod>("manual");
  const [fieldId, setFieldId] = useState<Id<"fields"> | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [place, setPlace] = useState<{
    district: string | null;
    state: string | null;
    country: string | null;
    label: string;
  } | null>(null);
  const [geoErr, setGeoErr] = useState(false);

  /* Manual administrative location (State→District→Taluk→Village). Persisted
     onto the selected field so every module (weather, soil, market, alerts,
     nearby, schemes) can use the real selected location — never just for
     display. Source is stored as "manual". */
  const [manualLoc, setManualLoc] = useState<ManualLocation | null>(null);
  const updateField = useMutation(api.cropData.updateField);

  const handleManualConfirm = useCallback(
    async (loc: ManualLocation) => {
      setManualLoc(loc);
      if (!fieldId) return; // saved once a field exists
      try {
        await updateField({
          fieldId,
          village: loc.village,
          taluk: loc.taluk,
          district: loc.district,
          state: loc.state,
          // Approximate village coordinates — clearly labelled, never treated
          // as the exact farm boundary.
          lat: loc.approxLat ?? undefined,
          lon: loc.approxLon ?? undefined,
          geoUpdatedAt: Date.now(),
        });
      } catch {
        // Selection stays in the UI; farmer can retry after creating a field.
      }
    },
    [fieldId, updateField],
  );

  // default to the first field once loaded
  useEffect(() => {
    if (fieldId === null && listFields && listFields.length > 0) {
      setFieldId(listFields[0]._id);
    }
  }, [listFields, fieldId]);

  const field = useMemo(
    () => listFields?.find((f: any) => f._id === fieldId) ?? null,
    [listFields, fieldId],
  );

  // ---- reverse geocoding ----------------------------------------------------
  const geocodeFor = useCallback(
    async (lat: number, lon: number) => {
      try {
        const res = await reverseGeocode({ lat, lon });
        if (res.ok) {
          setPlace({
            district: res.place.district,
            state: res.place.state,
            country: res.place.country,
            label: res.place.label,
          });
          setGeoErr(false);
        } else {
          setPlace(null);
          setGeoErr(true);
        }
      } catch {
        setPlace(null);
        setGeoErr(true);
      }
    },
    [reverseGeocode],
  );

  // geocode when the selected field has coordinates
  useEffect(() => {
    if (field?.lat != null && field?.lon != null) {
      void geocodeFor(field.lat, field.lon);
    }
  }, [field?.lat, field?.lon, geocodeFor]);

  const createField = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const id = await addField({ fieldName: name });
      setNewName("");
      setFieldId(id);
    } finally {
      setCreating(false);
    }
  }, [newName, addField]);

  return (
    <PageShell title={t("farmTitle")} emoji="🗺️">
      <p className="mb-3 text-xs font-semibold text-[#5c574b]">{t("farmSub")}</p>

      {/* field selector */}
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="block text-xs font-bold uppercase">
          {t("farmPickField")}
          <select
            value={fieldId ?? ""}
            onChange={(e) => setFieldId((e.target.value || null) as Id<"fields"> | null)}
            className="mt-1 w-56 border-2 border-[#141414] bg-white px-2.5 py-1.5 text-sm font-semibold"
          >
            <option value="">— {t("farmPickField")} —</option>
            {(listFields ?? []).map((f: any) => (
              <option key={f._id} value={f._id}>
                {f.fieldName}
              </option>
            ))}
          </select>
        </label>
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t("farmFieldNamePh")}
          className="w-44"
        />
        <Button
          type="button"
          size="sm"
          onClick={() => void createField()}
          disabled={!newName.trim() || creating}
        >
          ➕ {t("farmCreateField")}
        </Button>
      </div>

      {listFields && listFields.length === 0 && (
        <p className="mb-4 border-2 border-[#141414] bg-[#fbbf24]/25 px-3 py-2 text-xs font-semibold">
          {t("farmNoFields")}
        </p>
      )}

      {/* tabs */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`border-2 border-[#141414] px-3 py-1.5 text-[11px] font-bold uppercase nb-shadow-sm ${
              tab === key ? "bg-[#ffc53d]" : "bg-white"
            }`}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {/* panels */}
      <div className="space-y-4">
        {tab === "loc" && (
          <div className="border-2 border-[#141414] bg-[#f5f0e6] p-3 nb-shadow-sm">
            {/* Three-method chooser (spec) — manual is the highlighted default */}
            <p className="font-display text-sm uppercase">📍 {t("locWhereTitle")}</p>
            <p className="mt-1 text-[11px] font-semibold text-[#5c574b]">
              {LM.prompt}
            </p>
            <div className="my-3 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setLocMethod("gps")}
                className={`nb-press nb-border px-3 py-3 text-xs font-bold uppercase ${
                  locMethod === "gps" ? "bg-[#ffc53d]" : "bg-white"
                }`}
              >
                {LM.gps}
              </button>
              <button
                type="button"
                onClick={() => setLocMethod("manual")}
                className={`nb-press nb-border px-3 py-3 text-xs font-bold uppercase ${
                  locMethod === "manual" ? "bg-[#2fa35c] text-white" : "bg-white"
                }`}
              >
                {LM.manual}
              </button>
              <button
                type="button"
                onClick={() => setLocMethod("draw")}
                className={`nb-press nb-border px-3 py-3 text-xs font-bold uppercase ${
                  locMethod === "draw" ? "bg-[#ffc53d]" : "bg-white"
                }`}
              >
                {LM.draw}
              </button>
            </div>

            {/* GPS / draw: brief guidance, then jump to the map panel */}
            {locMethod !== "manual" && (
              <div className="nb-border mb-3 bg-[#ede7d8] px-3 py-2">
                <p className="text-[11px] font-bold">
                  {locMethod === "gps" ? LM.gpsHint : LM.drawHint}
                </p>
                <button
                  type="button"
                  onClick={() => setTab("bnd")}
                  className="nb-press nb-shadow mt-2 bg-[#141414] px-3 py-1.5 text-[11px] font-bold uppercase text-white"
                >
                  {t("tabFarmBoundary")} →
                </button>
              </div>
            )}

            {/* Manual selection — the easy default path */}
            {locMethod === "manual" && (
              <ManualLocationCard onConfirm={(loc) => void handleManualConfirm(loc)} />
            )}

            <div className="my-3 flex items-center gap-3">
              <span className="h-0.5 flex-1 border-t-2 border-dashed border-[#141414]/30" />
              <span className="nb-chip bg-[#ede7d8] text-[10px]">{t("orDivider")}</span>
              <span className="h-0.5 flex-1 border-t-2 border-dashed border-[#141414]/30" />
            </div>

            {/* GPS — full detail lives in the map component below */}
            <p className="mb-2 text-[11px] font-bold uppercase text-[#5c574b]">
              🛰️ {t("locMapOptional")}
            </p>
            {manualLoc && (
              <p className="nb-border mb-3 bg-[#2fa35c] px-3 py-2 text-[11px] font-bold text-white">
                ✓ {t("locSavedAs")}: {manualLoc.village}, {manualLoc.taluk}, {manualLoc.district}, {manualLoc.state}
              </p>
            )}
          </div>
        )}

        {(tab === "loc" || tab === "bnd") && (
          <div className="border-2 border-[#141414] bg-[#f5f0e6] p-3 nb-shadow-sm">
            <FarmMap fieldId={fieldId} onGeocode={geocodeFor} />
            {/* reverse-geocoded place */}
            <div className="mt-3 border-2 border-[#141414] bg-white px-3 py-2 text-xs font-semibold nb-shadow-sm">
              <p className="text-[10px] font-bold uppercase text-[#5c574b]">{t("revPlace")}</p>
              {place ? (
                <>
                  <p>
                    {place.label}
                    {place.country ? ` · ${place.country}` : ""}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-[#5c574b]">
                    {t("revSource")}: OpenStreetMap Nominatim · {t("revAdjustHint")}
                  </p>
                </>
              ) : (
                <p>{geoErr ? t("revUnavailable") : "—"}</p>
              )}
            </div>
            {field?.areaSqM != null && (
              <p className="mt-2 text-[11px] font-semibold text-[#5c574b]">
                {t("bndArea")}: {(field.areaSqM / 4046.8564224).toFixed(2)} ac ·{" "}
                {(field.areaSqM / 10000).toFixed(2)} ha
              </p>
            )}
            {field?.geoUpdatedAt != null && (
              <p className="mt-1 text-[10px] font-medium text-[#5c574b]">
                {t("wfUpdated")}: {new Date(field.geoUpdatedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {tab === "wx" && <FarmWeatherPanel lat={field?.lat ?? null} lon={field?.lon ?? null} />}

        {tab === "sat" && <SatellitePanel boundary={field?.boundary ?? null} />}

        {tab === "suit" && (
          <SuitabilityPanel
            lat={field?.lat ?? null}
            lon={field?.lon ?? null}
            district={field?.district ?? place?.district ?? null}
            state={field?.state ?? place?.state ?? null}
            farmAreaSqM={field?.areaSqM ?? null}
            satellite={null}
          />
        )}
      </div>
    </PageShell>
  );
}
