import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/context/LanguageContext";
import type { Lang } from "@/lib/i18n";
import type { ExtractedSoil } from "@/convex/soilCard";

export interface SoilValues {
  N: string;
  P: string;
  K: string;
  ph: string;
}

export interface SoilMeta {
  source: "auto" | "shc_upload" | "manual" | "nearest_test" | "gov_dataset";
  testedOn: string | null;
  sourceLabel: string;
  distanceKm: number | null;
  oc: number | null;
  ec: number | null;
  s: number | null;
}

export interface SoilFormProps {
  locLabel: string | null;
  soil: SoilValues;
  setSoil: (s: SoilValues) => void;
  soilMeta: SoilMeta | null;
  temp: string;
  hum: string;
  rain: string;
  area: string;
  setTemp: (v: string) => void;
  setHum: (v: string) => void;
  setRain: (v: string) => void;
  setArea: (v: string) => void;
  weatherAuto: boolean;
  rainAuto: boolean;
  season: "kharif" | "rabi" | "zaid";
  setSeason: (s: "kharif" | "rabi" | "zaid") => void;
  ready: boolean;
  onRecommend: () => void;
  /** Incremented by the parent to open the manual/SHC entry section. */
  openManualSignal?: number;
  onUpload: (v: { N: number; P: number; K: number; ph: number; meta: SoilMeta }) => void;
}

const fmt = (v: number) =>
  Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);

const SEASON_LABELS: Record<Lang, Record<"kharif" | "rabi" | "zaid", string>> = {
  kn: { kharif: "ಮಳೆಗಾಲ", rabi: "ಚಳಿಗಾಲ", zaid: "ಬೇಸಿಗೆ" },
  hi: { kharif: "बरसात का मौसम", rabi: "सर्दी का मौसम", zaid: "गर्मी का मौसम" },
  en: { kharif: "Rainy Season", rabi: "Winter Season", zaid: "Summer Season" },
};

function NumField({
  label,
  value,
  onChange,
  chip,
  hint,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  chip?: string | null;
  hint?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-1">
        <label className="text-[11px] font-bold uppercase tracking-widest">
          {label}
        </label>
        {chip ? (
          <span
            className={`nb-chip ${chip === "auto" ? "bg-[#5fa8e8] text-[#141414]" : "bg-[#ede7d8]"}`}
          >
            {chip === "auto" ? "⚡ auto" : "✍ manual"}
          </span>
        ) : null}
      </div>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        min={min}
        max={max}
        className="nb-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? (
        <p className="mt-1 text-[10px] font-semibold leading-tight text-[#5c574b]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SoilForm(props: SoilFormProps) {
  const { t, lang } = useLang();
  const {
    locLabel,
    soil,
    setSoil,
    soilMeta,
    temp,
    hum,
    rain,
    area,
    setTemp,
    setHum,
    setRain,
    setArea,
  weatherAuto,
  rainAuto,
  season,
  setSeason,
    ready,
    onRecommend,
    onUpload,
  } = props;

  const extractSoilCard = useAction(api.soilCard.extractSoilCard);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [pending, setPending] = useState<ExtractedSoil | null>(null);

  // Parent (SoilRainCard → Dashboard) can request the manual-entry section.
  useEffect(() => {
    if ((props.openManualSignal ?? 0) > 0) setShowManual(true);
  }, [props.openManualSignal]);

  const applyExtracted = (e: ExtractedSoil) => {
    // Confirm step: values are shown to the farmer BEFORE use (req #5).
    setPending(e);
  };

  const confirmExtracted = () => {
    if (!pending) return;
    const { ph, n, p, k } = pending;
    if (ph === null || n === null || p === null || k === null) return;
    onUpload({
      N: n,
      P: p,
      K: k,
      ph,
      meta: {
        source: "shc_upload",
        testedOn: pending.sampleDate,
        sourceLabel: pending.docType ?? "Soil Health Card (upload)",
        distanceKm: null,
        oc: pending.oc,
        ec: pending.ec,
        s: pending.s,
      },
    });
    setPending(null);
  };

  const onFile = async (file: File) => {
    setUploading(true);
    setPending(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("read_failed"));
        r.readAsDataURL(file);
      });
      const res = await extractSoilCard({ fileDataUrl: dataUrl, fileName: file.name });
      if (res.ok) {
        applyExtracted(res.data);
      } else if (res.reason === "missing_key") {
        toast.error(t("shcNoKey"));
        // Graceful degradation: let the farmer type the values from the card.
        setShowManual(true);
      } else if (res.reason === "no_values_found") {
        toast.error(t("shcNoValues"));
        setShowManual(true);
      } else {
        toast.error(t("shcFail"));
        setShowManual(true);
      }
    } catch {
      toast.error(t("shcFail"));
      setShowManual(true);
    } finally {
      setUploading(false);
    }
  };

  const chip = weatherAuto ? "auto" : "manual";

  return (
    <div className="nb-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xl">🌱</span>
        <h2 className="font-display text-base uppercase">{t("soilTitle")}</h2>
      </div>

      {/* ---- Automatic soil data display ---- */}
      {soilMeta && (
        <div className="nb-border mb-4 bg-[#2fa35c] p-3 text-white">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
            📍 {t("srLocLabel")}
          </p>
          <p className="text-sm font-bold">{locLabel ?? "—"}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="nb-border bg-white px-3 py-2 text-[#141414]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#5c574b]">
                {t("nLabel")}
              </p>
              <p className="text-lg font-bold">
                {soil.N || "—"}{" "}
                <span className="text-[10px] font-semibold">kg/ha</span>
              </p>
            </div>
            <div className="nb-border bg-white px-3 py-2 text-[#141414]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#5c574b]">
                {t("pLabel")}
              </p>
              <p className="text-lg font-bold">
                {soil.P || "—"}{" "}
                <span className="text-[10px] font-semibold">kg/ha</span>
              </p>
            </div>
            <div className="nb-border bg-white px-3 py-2 text-[#141414]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#5c574b]">
                {t("kLabel")}
              </p>
              <p className="text-lg font-bold">
                {soil.K || "—"}{" "}
                <span className="text-[10px] font-semibold">kg/ha</span>
              </p>
            </div>
            <div className="nb-border bg-white px-3 py-2 text-[#141414]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#5c574b]">
                {t("phLabel")}
              </p>
              <p className="text-lg font-bold">{soil.ph || "—"}</p>
            </div>
          </div>

          {(soilMeta.oc != null || soilMeta.ec != null || soilMeta.s != null) && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {soilMeta.oc != null && (
                <div className="nb-border bg-[#ede7d8] px-2 py-1.5 text-[#141414]">
                  <p className="text-[9px] font-bold uppercase text-[#5c574b]">
                    OC %
                  </p>
                  <p className="text-sm font-bold">{soilMeta.oc}</p>
                </div>
              )}
              {soilMeta.ec != null && (
                <div className="nb-border bg-[#ede7d8] px-2 py-1.5 text-[#141414]">
                  <p className="text-[9px] font-bold uppercase text-[#5c574b]">
                    EC dS/m
                  </p>
                  <p className="text-sm font-bold">{soilMeta.ec}</p>
                </div>
              )}
              {soilMeta.s != null && (
                <div className="nb-border bg-[#ede7d8] px-2 py-1.5 text-[#141414]">
                  <p className="text-[9px] font-bold uppercase text-[#5c574b]">
                    S ppm
                  </p>
                  <p className="text-sm font-bold">{soilMeta.s}</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-3 space-y-0.5 text-[11px] font-semibold text-white/90">
            {/* Data-status: honest provenance of the displayed values */}
            <p>
              <span className="nb-border mr-1 inline-block bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#141414]">
                {soilMeta.source === "manual" || soilMeta.source === "shc_upload"
                  ? t("srStatusFarmer")
                  : t("srStatusMeasured")}
              </span>
            </p>
            {soilMeta.testedOn && (
              <p>
                📅 {t("shcSampleDate")}: {soilMeta.testedOn}
              </p>
            )}
            <p>
              🏛 {t("shcSource")}: {soilMeta.sourceLabel}
            </p>
            {soilMeta.distanceKm != null && (
              <p>
                📏 {t("srDistanceAway", { km: soilMeta.distanceKm })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ---- Fallback actions when no soil data yet ---- */}
      {!soilMeta && (
        <div className="nb-border mb-4 bg-[#ffc53d] px-3 py-3">
          <p className="text-xs font-bold">🚫 {t("noSoilFound")}</p>
          <p className="mt-1 text-[10px] font-semibold">{t("noSoilSub")}</p>
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="nb-press w-full bg-[#2fa35c] px-3 py-2.5 text-xs font-bold uppercase text-white"
            >
              {uploading ? t("shcUploading") : `📄 ${t("shcUploadBtn")}`}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => setShowManual((s) => !s)}
              className="nb-press w-full bg-white px-3 py-2.5 text-xs font-bold uppercase"
            >
              ✍️ {t("manualBtn")}
            </button>
            <a
              href="https://soilhealth.dac.gov.in/lab-finder"
              target="_blank"
              rel="noreferrer"
              className="nb-press block w-full bg-[#ede7d8] px-3 py-2.5 text-center text-xs font-bold uppercase"
            >
              🧪 {t("labFinderBtn")}
            </a>
          </div>
        </div>
      )}

      {/* ---- Manual entry (hidden until requested) ---- */}
      {showManual && (
        <div className="nb-border mb-4 bg-[#ede7d8] p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest">
            ✍️ {t("manualTitle")}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label={t("nLabel")}
              value={soil.N}
              onChange={(v) => setSoil({ ...soil, N: v })}
              min={0}
              max={200}
            />
            <NumField
              label={t("pLabel")}
              value={soil.P}
              onChange={(v) => setSoil({ ...soil, P: v })}
              min={0}
              max={200}
            />
            <NumField
              label={t("kLabel")}
              value={soil.K}
              onChange={(v) => setSoil({ ...soil, K: v })}
              min={0}
              max={250}
            />
            <NumField
              label={t("phLabel")}
              value={soil.ph}
              onChange={(v) => setSoil({ ...soil, ph: v })}
              min={0}
              max={14}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              const n = Number(soil.N);
              const p = Number(soil.P);
              const k = Number(soil.K);
              const ph = Number(soil.ph);
              const ok =
                Number.isFinite(n) && n >= 0 &&
                Number.isFinite(p) && p >= 0 &&
                Number.isFinite(k) && k >= 0 &&
                Number.isFinite(ph) && ph >= 0 && ph <= 14 &&
                soil.N !== "" && soil.P !== "" && soil.K !== "" && soil.ph !== "";
              if (!ok) {
                toast.error(t("invalidSoil"));
                return;
              }
              onUpload({
                N: n,
                P: p,
                K: k,
                ph,
                meta: {
                  source: "manual",
                  testedOn: null,
                  sourceLabel: "Manual entry (from soil test report)",
                  distanceKm: null,
                  oc: null,
                  ec: null,
                  s: null,
                },
              });
            }}
            className="nb-press mt-3 w-full bg-[#141414] px-3 py-2 text-xs font-bold uppercase text-white"
          >
            ✓ {t("manualSave")}
          </button>
        </div>
      )}

      {/* ---- OCR confirmation dialog ---- */}
      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#141414]/60 p-4"
          onClick={() => setPending(null)}
        >
          <div
            className="nb-card w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display mb-3 text-sm uppercase">
              🔍 {t("shcDetectedTitle")}
            </p>
            <div className="space-y-1.5 text-sm font-bold">
              {(
                [
                  ["N", pending.n, "kg/ha"],
                  ["P", pending.p, "kg/ha"],
                  ["K", pending.k, "kg/ha"],
                  ["pH", pending.ph, ""],
                ] as const
              ).map(([label, val, unit]) => (
                <div
                  key={label}
                  className="nb-border flex items-center justify-between bg-[#ede7d8] px-3 py-2"
                >
                  <span>{label}</span>
                  <span>
                    {val === null ? (
                      <span className="font-semibold text-[#5c574b]">—</span>
                    ) : (
                      <>
                        {fmt(val)}{" "}
                        {unit && (
                          <span className="text-[10px] font-semibold text-[#5c574b]">
                            {unit}
                          </span>
                        )}
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
            {pending.sampleDate && (
              <p className="mt-2 text-[11px] font-semibold">
                📅 {t("shcSampleDate")}: {pending.sampleDate}
              </p>
            )}
            {pending.notes && (
              <p className="mt-1 text-[10px] font-semibold text-[#5c574b]">
                {pending.notes}
              </p>
            )}
            <p className="mt-2 text-[10px] font-semibold text-[#5c574b]">
              {t("shcConfirmHint")}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="nb-press flex-1 bg-white px-3 py-2 text-xs font-bold uppercase"
              >
                {t("shcReject")}
              </button>
              <button
                type="button"
                onClick={confirmExtracted}
                disabled={
                  pending.ph === null ||
                  pending.n === null ||
                  pending.p === null ||
                  pending.k === null
                }
                className="nb-press flex-1 bg-[#2fa35c] px-3 py-2 text-xs font-bold uppercase text-white"
              >
                ✓ {t("shcConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Weather inputs + season + area ---- */}
      <div className="grid grid-cols-2 gap-3">
        <NumField label={t("tempLabel")} value={temp} onChange={setTemp} chip={chip} min={-10} max={60} />
        <NumField label={t("humLabel")} value={hum} onChange={setHum} chip={chip} min={0} max={100} />
        <div className="col-span-2">
          <NumField
            label={t("rainLabel")}
            value={rain}
            onChange={setRain}
            chip={rainAuto ? "auto" : "manual"}
            hint={t("rainHint")}
            min={0}
            max={2000}
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest">
            🗓 {t("seasonLabel")}
          </label>
          <select
            className="nb-input"
            value={season}
            onChange={(e) =>
              setSeason(e.target.value as "kharif" | "rabi" | "zaid")
            }
          >
            <option value="kharif">{SEASON_LABELS[lang].kharif}</option>
            <option value="rabi">{SEASON_LABELS[lang].rabi}</option>
            <option value="zaid">{SEASON_LABELS[lang].zaid}</option>
          </select>
        </div>
        <div className="col-span-2">
          <NumField
            label={t("areaLabel")}
            value={area}
            onChange={setArea}
            hint={t("areaNote")}
            min={0}
          />
        </div>
      </div>

      {!ready && (
        <p className="nb-border mt-4 bg-[#ede7d8] px-3 py-2 text-[11px] font-bold">
          ✏️ {t("fillAllAuto")}
        </p>
      )}

      <button
        type="button"
        onClick={onRecommend}
        disabled={!ready}
        className="nb-press mt-4 w-full bg-[#2fa35c] px-4 py-3 font-display text-sm uppercase text-white"
      >
        {t("recBtn")}
      </button>
    </div>
  );
}
