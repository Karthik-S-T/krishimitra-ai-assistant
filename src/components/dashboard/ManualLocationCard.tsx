import { useAction } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/context/LanguageContext";
import {
  orderedStates,
  getDistrictsFor,
  getTaluksFor,
  getPincodesFor,
  searchList,
  LOCATION_META,
} from "@/lib/indiaLocations";

export interface ManualLocation {
  state: string;
  district: string;
  taluk: string;
  village: string;
  pincode: string;
  /** Approximate village/town coordinates from geocoding (labelled as such). */
  approxLat: number | null;
  approxLon: number | null;
}

interface Props {
  /** Fires once when the farmer confirms a complete selection. */
  onConfirm: (loc: ManualLocation) => void;
}

interface IndiaPostOffice {
  Name?: string | null;
  Block?: string | null;
  District?: string | null;
  State?: string | null;
}

interface IndiaPostResponse {
  Status?: string;
  PostOffice?: IndiaPostOffice[] | null;
}

const CUSTOM_VILLAGE = "Other / Custom Village";

const placeKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const LOCAL_VILLAGES: Record<string, string[]> = {
  challakere: ["Challakere", "Nayakanahatti", "Parasuramapura", "Talaku", "Sanikere", "Thimmanayakanahalli"],
  hiriyur: ["Hiriyur", "Aimangala", "Dharmapura", "Madure", "Yarabanahalli", "Metikurke"],
  holalkere: ["Holalkere", "Chikkajajur", "Ramagiri", "Talya", "Nayakanahalli"],
  hosadurga: ["Hosadurga", "Bagur", "Honnur", "Mathodu", "Kittadalu", "Madadakere"],
  molakalmuru: ["Molakalmuru", "Rampura", "Nannivala", "B.G. Kere", "Brahmagiri"],
  chitradurga: ["Challakere", "Hiriyur", "Holalkere", "Hosadurga", "Molakalmuru", "Chitradurga"],
  devanahalli: ["Devanahalli", "Vijayapura", "Kundana", "Avathi", "Channarayapatna", "Sadahalli"],
  doddaballapura: ["Doddaballapura", "Tubagere", "Sathnur", "Hadonahalli", "Aralumallige", "Bashettihalli"],
  hosakote: ["Hosakote", "Anugondanahalli", "Jadigenahalli", "Nandagudi", "Sulibele", "Muthsandra"],
  hoskote: ["Hosakote", "Anugondanahalli", "Jadigenahalli", "Nandagudi", "Sulibele", "Muthsandra"],
  nelamangala: ["Nelamangala", "Tyamagondlu", "Somapura", "Yantaganahalli", "Arishinakunte", "Dabaspet"],
  "bengaluru rural": ["Devanahalli", "Doddaballapura", "Hosakote", "Nelamangala", "Vijayapura"],
  mandya: ["Mandya", "Maddur", "Malavalli", "Srirangapatna", "Nagamangala", "Pandavapura", "Krishnarajpet"],
  maddur: ["Maddur", "Bannur", "Besagarahalli", "Koppa", "Ganjam"],
  malavalli: ["Malavalli", "Halaguru", "Kirugavalu", "Belakavadi", "Somanahalli"],
  kolar: ["Kolar", "Bangarapet", "Malur", "Mulbagal", "Srinivaspur", "Vemgal"],
  bangarapet: ["Bangarapet", "Bethamangala", "Kamasamudram", "Boodikote", "Robertsonpet"],
  tumakuru: ["Tumakuru", "Tiptur", "Gubbi", "Sira", "Kunigal", "Pavagada", "Madhugiri", "Koratagere"],
  tiptur: ["Tiptur", "Honnavalli", "Nonavinakere", "Kibbanahalli", "Biligere"],
  gubbi: ["Gubbi", "Nittur", "Chelur", "Hagalavadi", "C.S. Pura"],
  mysuru: ["Mysuru", "Hunsur", "Nanjangud", "T. Narasipura", "Periyapatna", "H.D. Kote", "K.R. Nagar"],
  hunsur: ["Hunsur", "Bilikere", "Hanagodu", "Ravandur", "Gavadagere"],
  nanjangud: ["Nanjangud", "Hullahalli", "Hediyala", "Kasaba", "Devarasanahalli"],
  belagavi: ["Belagavi", "Athani", "Bailhongal", "Chikkodi", "Gokak", "Hukkeri", "Khanapur", "Ramdurg"],
  athani: ["Athani", "Kagawad", "Shedbal", "Ugar Khurd", "Kokatnur"],
  gokak: ["Gokak", "Mudalgi", "Konnur", "Yadwad", "Arabavi"],
  shivamogga: ["Shivamogga", "Bhadravati", "Sagara", "Shikaripura", "Sorab", "Thirthahalli"],
  dharwad: ["Dharwad", "Hubballi", "Kalghatgi", "Kundgol", "Navalgund"],
  hassan: ["Hassan", "Alur", "Arasikere", "Belur", "Channarayapatna", "Holenarsipur", "Sakleshpur"],
  udupi: ["Udupi", "Karkala", "Kundapura", "Brahmavara", "Kapu", "Byndoor"],
  "dakshina kannada": ["Mangaluru", "Bantwal", "Belthangady", "Puttur", "Sullia"],
  chennai: ["Chennai", "Tambaram", "Avadi", "Poonamallee", "Sholinganallur"],
  coimbatore: ["Coimbatore", "Pollachi", "Mettupalayam", "Sulur", "Annur"],
  madurai: ["Madurai", "Melur", "Usilampatti", "Vadipatti", "Thirumangalam"],
  hyderabad: ["Hyderabad", "Secunderabad", "Ranga Reddy", "Medchal", "Shamshabad"],
  pune: ["Pune", "Haveli", "Baramati", "Daund", "Junnar", "Mulshi"],
  jaipur: ["Jaipur", "Amer", "Sanganer", "Chomu", "Bassi"],
  lucknow: ["Lucknow", "Mohanlalganj", "Malihabad", "Bakshi Ka Talab", "Sarojini Nagar"],
  indore: ["Indore", "Mhow", "Depalpur", "Sanwer", "Hatod"],
};

function localVillageOptions(district: string, taluk: string): string[] {
  const place = taluk.trim() || district.trim();
  if (!place) return [];
  const known = taluk
    ? LOCAL_VILLAGES[placeKey(taluk)] ?? []
    : LOCAL_VILLAGES[placeKey(district)] ?? [];
  return [...new Set([...known, `${place} Kasaba`, `${place} Rural`, CUSTOM_VILLAGE])];
}

function SearchableSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  disabled,
  searchPh,
  loading,
}: {
  label: string;
  placeholder: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  searchPh: string;
  loading?: boolean;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const filtered = useMemo(() => searchList(options, q), [options, q]);

  return (
    <div className="relative" ref={boxRef}>
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide">
        {label}
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((v) => !v);
          setQ("");
        }}
        className={`nb-border flex h-11 w-full items-center justify-between bg-white px-3 text-sm font-bold disabled:opacity-50 ${
          value ? "" : "text-[#5c574b]"
        }`}
      >
        <span className="truncate">{value || placeholder}</span>
        <span className="ml-2 shrink-0">▼</span>
      </button>

      {open && (
        <div className="nb-shadow-lg absolute z-30 mt-1 w-full border-2 border-[#141414] bg-white">
          <div className="border-b-2 border-[#141414] p-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPh}
              className="nb-border w-full bg-[#f5f0e6] px-2.5 py-2 text-sm font-semibold outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {loading && (
              <p className="px-3 py-3 text-xs font-bold">⏳ {t("loading")}</p>
            )}
            {!loading && filtered.length === 0 && (
              <p className="px-3 py-3 text-xs font-semibold text-[#5c574b]">
                {t("locNoMatch")}
              </p>
            )}
            {filtered.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[#ffc53d] ${
                  o === value ? "bg-[#ede7d8] font-bold" : ""
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 📍 SELECT YOUR FARM LOCATION — the easy, default path.
 * Dependent dropdowns from the LGD index with browser-side India Post lookup
 * and local village options. Confirming
 * reports the selection upward; coordinates, when found, are explicitly
 * "Approximate village location" — never the exact farm.
 */
export function ManualLocationCard({ onConfirm }: Props) {
  const { t } = useLang();
  const geocodePlace = useAction(api.indiaPost.geocodePlace);

  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [taluk, setTaluk] = useState("");
  const [village, setVillage] = useState("");
  const [customVillage, setCustomVillage] = useState("");
  const [pincode, setPincode] = useState("");
  const [villages, setVillages] = useState<string[]>([]);
  const [vLoading, setVLoading] = useState(false);
  const [vError, setVError] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [confirmed, setConfirmed] = useState<ManualLocation | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  const districts = useMemo(() => getDistrictsFor(state), [state]);
  const taluks = useMemo(() => getTaluksFor(state, district), [state, district]);
  const effectiveTaluk = taluk || district;
  const selectedVillage = village === CUSTOM_VILLAGE ? customVillage.trim() : village;
  const villageOptions = useMemo(() => {
    const local = localVillageOptions(district, taluk);
    return [...new Set([...local, ...villages])];
  }, [district, taluk, villages]);

  // Keep local options available immediately while the public PIN API loads.
  useEffect(() => {
    setVillage("");
    setCustomVillage("");
    setVillages([]);
    setVError(false);
    const place = taluk || district;
    if (!state || !district || !place) {
      setVLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6_000);
    setVLoading(true);

    const loadVillages = async () => {
      try {
        const response = await fetch(
          `https://api.postalpincode.in/postoffice/${encodeURIComponent(place)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(`India Post returned ${response.status}.`);
        const payload: unknown = await response.json();
        const entries = Array.isArray(payload) ? payload as IndiaPostResponse[] : [];
        const offices: IndiaPostOffice[] = entries.flatMap((entry) =>
          Array.isArray(entry.PostOffice) ? entry.PostOffice : [],
        );
        const stateKey = placeKey(state);
        const districtKey = placeKey(district);
        const adminMatches = offices.filter((office) => {
          const officeState = placeKey(office.State ?? "");
          const officeDistrict = placeKey(office.District ?? "");
          return (
            (!officeState || officeState === stateKey) &&
            (!officeDistrict || officeDistrict === districtKey)
          );
        });
        const blockMatches = adminMatches.filter((office) =>
          placeKey(office.Block ?? "").includes(placeKey(taluk)),
        );
        const selectedOffices = blockMatches.length ? blockMatches : adminMatches;
        const names = [...new Set(selectedOffices
          .map((office) => office.Name?.trim() ?? "")
          .filter(Boolean))];
        if (cancelled) return;
        setVillages(names);
        setVError(names.length === 0);
      } catch {
        if (!cancelled) setVError(true);
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled) setVLoading(false);
      }
    };

    void loadVillages();
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [state, district, taluk]);

  const missing = !state || !district || !selectedVillage;

  const confirm = async () => {
    if (missing) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    const sel: ManualLocation = {
      state,
      district,
      taluk: effectiveTaluk,
      village: selectedVillage,
      pincode: pincode.trim(),
      approxLat: null,
      approxLon: null,
    };
    setConfirmed(sel);
    setCoords(null);
    onConfirm(sel);

    // Best-effort approximate coordinates for the village (clearly labelled).
    try {
      const hits = await geocodePlace({ name: selectedVillage, count: 6 });
      const match =
        hits.find(
          (h: any) =>
            h.district?.toLowerCase() === district.toLowerCase() &&
            h.state?.toLowerCase() === state.toLowerCase(),
        ) ??
        hits.find((h: any) => h.district?.toLowerCase() === district.toLowerCase()) ??
        null;
      if (match) {
        setCoords({ lat: match.lat, lon: match.lon });
        sel.approxLat = match.lat;
        sel.approxLon = match.lon;
      }
    } catch {
      setCoords(null);
    }
  };

  const reset = () => {
    setConfirmed(null);
    setCoords(null);
    setShowErrors(false);
  };

  const errorFor = (field: string) => {
    if (!showErrors) return null;
    if (field === "district" && !district) return t("locErrDistrict");
    if (field === "village" && district && !selectedVillage) return t("locErrVillage");
    return null;
  };

  return (
    <div className="nb-shadow-sm nb-border bg-white p-4">
      <p className="font-display text-sm uppercase">📍 {t("locSelectTitle")}</p>
      <p className="mt-1 text-[11px] font-semibold text-[#5c574b]">
        {t("locSelectSub")}
      </p>

      {/* Confirmation panel */}
      {confirmed ? (
        <div className="mt-4">
          <div className="nb-border bg-[#2fa35c] p-4 text-white">
            <p className="font-display text-sm uppercase">✓ {t("locSaved")}</p>
            <div className="mt-2 space-y-0.5 text-sm font-bold">
              <p>📍 {t("locVillage")}: {confirmed.village}</p>
              <p>📍 {t("locTaluk")}: {confirmed.taluk}</p>
              <p>📍 {t("locDistrict")}: {confirmed.district}</p>
              <p>📍 {t("locState")}: {confirmed.state}</p>
              {confirmed.pincode && (
                <p>📮 PIN: {confirmed.pincode}</p>
              )}
            </div>
          </div>

          {coords && (
            <div className="nb-border mt-2 bg-[#ede7d8] px-3 py-2 text-xs font-semibold">
              <p>
                🌐 {t("locCoords")}: {coords.lat.toFixed(4)}, {coords.lon.toFixed(4)}
              </p>
              <p className="text-[10px] font-bold uppercase text-[#5c574b]">
                {t("locApproxNote")}
              </p>
            </div>
          )}

          <p className="mt-2 text-[10px] font-semibold text-[#5c574b]">
            🟢 {t("locSourceManual")}
          </p>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => onConfirm({ ...confirmed, approxLat: coords?.lat ?? null, approxLon: coords?.lon ?? null })}
              className="nb-press nb-border bg-[#2fa35c] px-4 py-2 text-xs font-bold uppercase text-white"
            >
              ✓ {t("locUseThis")}
            </button>
            <button
              type="button"
              onClick={reset}
              className="nb-press nb-border bg-white px-4 py-2 text-xs font-bold uppercase"
            >
              ✏️ {t("locChange")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <SearchableSelect
                label={t("locState")}
                placeholder={t("locPickState")}
                options={orderedStates()}
                value={state}
                onChange={(v) => {
                  setState(v);
                  setDistrict("");
                  setTaluk("");
                  setVillage("");
                  setCustomVillage("");
                  setPincode("");
                  setShowErrors(false);
                }}
                searchPh={t("locSearchState")}
              />
              {errorFor("district") === null && showErrors && !state && (
                <p className="mt-1 text-[11px] font-bold text-[#d64545]">{t("locErrState")}</p>
              )}
            </div>
            <div>
              <SearchableSelect
                label={t("locDistrict")}
                placeholder={t("locPickDistrict")}
                options={districts}
                value={district}
                onChange={(v) => {
                  setDistrict(v);
                  setTaluk("");
                  setVillage("");
                  setCustomVillage("");
                  setPincode("");
                  setShowErrors(false);
                }}
                disabled={!state}
                searchPh={t("locSearchDistrict")}
              />
              {errorFor("district") && (
                <p className="mt-1 text-[11px] font-bold text-[#d64545]">{t("locErrDistrict")}</p>
              )}
            </div>
            <div>
              <SearchableSelect
                label={t("locTaluk")}
                placeholder={t("locPickTaluk")}
                options={taluks}
                value={taluk}
                onChange={(v) => {
                  setTaluk(v);
                  setVillage("");
                  setCustomVillage("");
                  setShowErrors(false);
                }}
                disabled={!district}
                searchPh={t("locSearchTaluk")}
              />
              {errorFor("taluk") && (
                <p className="mt-1 text-[11px] font-bold text-[#d64545]">{t("locErrTaluk")}</p>
              )}
            </div>
            <div>
              <SearchableSelect
                label={t("locVillage")}
                placeholder={t("locPickVillage")}
                options={villageOptions}
                value={village}
                onChange={(v) => {
                  setVillage(v);
                  if (v !== CUSTOM_VILLAGE) setCustomVillage("");
                  setShowErrors(false);
                }}
                disabled={!district}
                searchPh={t("locSearchVillage")}
                loading={vLoading}
              />
              {village === CUSTOM_VILLAGE && (
                <input
                  value={customVillage}
                  onChange={(event) => {
                    setCustomVillage(event.target.value);
                    setShowErrors(false);
                  }}
                  placeholder="Enter village name"
                  className="nb-border mt-2 h-11 w-full bg-white px-3 text-sm font-bold outline-none"
                  aria-label="Custom village name"
                />
              )}
              {errorFor("village") && (
                <p className="mt-1 text-[11px] font-bold text-[#d64545]">{t("locErrVillage")}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide">
                {t("locPincode")}
              </label>
              <input
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder={t("locPincodePh")}
                disabled={!district}
                className="nb-border h-11 w-full bg-white px-3 text-sm font-bold outline-none disabled:opacity-50"
              />
              {district && pincode.length > 0 && pincode.length < 6 && (
                <p className="mt-1 text-[11px] font-bold text-[#d64545]">{t("locPincodeShort")}</p>
              )}
            </div>
          </div>

          {/* Honest fallback when the India Post lookup fails */}
          {vError && (
            <p className="nb-border mt-3 bg-[#ffc53d] px-3 py-2 text-[11px] font-bold">
              ⚠️ {t("locVillageUnavailable")}
            </p>
          )}

          <button
            type="button"
            onClick={() => void confirm()}
            disabled={missing}
            title={missing ? t("locErrVillage") : undefined}
            className="nb-press nb-border mt-4 h-12 w-full bg-[#2fa35c] font-display text-sm uppercase text-white disabled:opacity-50"
          >
            ✓ {t("locConfirm")}
          </button>
          {missing && showErrors && (
            <p className="mt-1 text-center text-[11px] font-bold text-[#d64545]">
              {t("locErrVillage")}
            </p>
          )}

          <p className="mt-3 text-[10px] font-semibold text-[#5c574b]">
            📄 {t("locDataSources")} · {LOCATION_META.villageSource}
          </p>
        </>
      )}
    </div>
  );
}
