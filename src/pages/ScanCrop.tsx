import { useAction, useMutation, useQuery } from "convex/react";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLang } from "@/context/LanguageContext";
import { PageShell } from "@/components/dashboard/PageShell";
import { compressImage, validatePhoto } from "@/lib/imageCompress";
import {
  addDemoField,
  appendDemoAnalysis,
  loadDemoFarmData,
  SAMPLE_LEAF_IMAGE,
  type DemoField,
} from "@/lib/demoFarmStore";
import { createOfflineLeafDiagnosis, withTimeout } from "@/lib/demoAgronomy";
import type { CropPhotoAnalysis } from "@/convex/cropPhoto";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Camera, Plus, RefreshCw, X } from "lucide-react";

const CROPS = [
  "rice","maize","chickpea","kidneybeans","pigeonpeas","mothbeans","mungbean",
  "blackgram","lentil","pomegranate","banana","mango","grapes","watermelon",
  "muskmelon","apple","orange","papaya","coconut","cotton","jute","coffee",
] as const;

const MAX_PHOTOS = 3;

const HEALTH_ORDER = ["severe_stress", "moderate_stress", "mild_stress", "healthy"] as const;

const healthRank = (s: string) => HEALTH_ORDER.indexOf(s as (typeof HEALTH_ORDER)[number]);

interface PrevSummary {
  analyzedAt: number;
  healthStatus: string;
  growthStage: string | undefined;
  yieldLowQa: number | undefined;
  yieldHighQa: number | undefined;
}

export default function ScanCrop() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const hasConvexUrl = Boolean(import.meta.env.VITE_CONVEX_URL);
  const [demoData, setDemoData] = useState(loadDemoFarmData);

  const fieldsQuery = useQuery(api.cropData.listFields, hasConvexUrl ? {} : "skip");
  const fields = (fieldsQuery ?? demoData.fields) as DemoField[];
  const onlineReady = hasConvexUrl && fieldsQuery !== undefined;
  const addField = useMutation(api.cropData.addField);
  const saveAnalysis = useMutation(api.cropData.saveAnalysis);
  const rescheduleReminder = useMutation(api.cropData.rescheduleReminder);
  const analyzePhoto = useAction(api.cropPhoto.analyzeCropPhoto);

  const [fieldId, setFieldId] = useState<string>(() => params.get("f") ?? "");
  const [crop, setCrop] = useState<string>(() =>
    fields.find((candidate) => candidate._id === params.get("f"))?.crop ?? "maize",
  );
  const [variety, setVariety] = useState(() =>
    fields.find((candidate) => candidate._id === params.get("f"))?.variety ?? "",
  );
  const [ageDays, setAgeDays] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  // Photo picker: tapping the main button opens a small dialog with BOTH
  // options. The camera input keeps capture="environment" (opens the rear
  // camera); the gallery input has NO capture attribute so Android Chrome /
  // Samsung Internet / Firefox open the normal photo/file picker instead of
  // forcing the camera. pickIndex: null → add new photo, number → replace.
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickIndex, setPickIndex] = useState<number | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CropPhotoAnalysis | null>(null);
  const [savedId, setSavedId] = useState<Id<"cropAnalyses"> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [prev, setPrev] = useState<PrevSummary | null>(null);

  const [newOpen, setNewOpen] = useState(false);
  const [nfName, setNfName] = useState("");
  const [nfArea, setNfArea] = useState("");
  const [nfCrop, setNfCrop] = useState("");
  const [nfVillage, setNfVillage] = useState("");

  const field = useMemo(
    () => fields.find((f) => f._id === fieldId) ?? null,
    [fields, fieldId],
  );

  const openPicker = (index: number | null) => {
    setPickIndex(index);
    setPickerOpen(true);
  };

  const handleTakePhoto = () => {
    setPickerOpen(false);
    cameraInputRef.current?.click();
  };

  const handleChooseGallery = () => {
    setPickerOpen(false);
    galleryInputRef.current?.click();
  };

  // Both hidden inputs route here. Validation runs BEFORE compression and
  // nothing is uploaded until the farmer presses Analyze.
  const handlePhotoSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const invalid = validatePhoto(file);
    if (invalid === "not_image") {
      toast.error(t("photoErrType"));
      return;
    }
    if (invalid === "too_large") {
      toast.error(t("photoErrSize"));
      return;
    }
    setPhotoBusy(true);
    try {
      const dataUrl = await compressImage(file);
      setPhotos((prev) => {
        const next = [...prev];
        if (pickIndex !== null && pickIndex < next.length) {
          next[pickIndex] = dataUrl;
        } else if (next.length < MAX_PHOTOS) {
          next.push(dataUrl);
        }
        return next;
      });
      setResult(null);
      setSavedId(null);
      setErr(null);
    } catch {
      toast.error(t("scanBadImage"));
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setResult(null);
    setSavedId(null);
  };

  const createField = async () => {
    if (!nfName.trim()) return;
    const newField = {
      fieldName: nfName.trim(),
      area: nfArea ? Number(nfArea) : undefined,
      crop: nfCrop || undefined,
      village: nfVillage.trim() || undefined,
    };
    if (!onlineReady) {
      const next = addDemoField(newField);
      setDemoData(next);
      const created = next.fields[0];
      setFieldId(created?._id ?? "");
      setNewOpen(false);
      setNfName("");
      setNfArea("");
      setNfCrop("");
      setNfVillage("");
      toast.success(t("fieldAdded"));
      return;
    }
    try {
      const id = await withTimeout(addField(newField));
      setNewOpen(false);
      setNfName("");
      setNfArea("");
      setNfCrop("");
      setNfVillage("");
      setFieldId(id);
      toast.success(t("fieldAdded"));
    } catch {
      const next = addDemoField(newField);
      setDemoData(next);
      setFieldId(next.fields[0]?._id ?? "");
      setNewOpen(false);
      toast.info("Saved in this browser's demo farm because the cloud service is unavailable.");
    }
  };

  const trySampleLeaf = () => {
    const sampleCrop = field?.crop ?? fields[0]?.crop ?? "tomato";
    const sampleFieldId = fieldId || fields[0]?._id || "";
    const diagnosis = createOfflineLeafDiagnosis(sampleCrop, lang);
    setCrop(sampleCrop);
    setPhotos([SAMPLE_LEAF_IMAGE]);
    setResult(diagnosis);
    setSavedId(null);
    setErr(null);
    setPrev(null);
    setFieldId(sampleFieldId);
    if (sampleFieldId) {
      setDemoData(appendDemoAnalysis({
        fieldId: sampleFieldId,
        crop: sampleCrop,
        variety: undefined,
        growthStage: diagnosis.growthStage,
        images: [SAMPLE_LEAF_IMAGE],
        healthStatus: diagnosis.healthStatus,
        healthScore: diagnosis.healthScore ?? undefined,
        observations: diagnosis.observations,
        fertilizerAdvice: diagnosis.fertilizerAdvice ?? undefined,
        irrigationAdvice: diagnosis.irrigationAdvice ?? undefined,
        yieldLowQa: diagnosis.yieldBand?.low,
        yieldHighQa: diagnosis.yieldBand?.high,
        confidence: diagnosis.confidence ?? undefined,
        aiResponse: diagnosis.fullText,
        areaAcres: field?.area,
      }));
    }
    toast.info("Sample diagnosis loaded. It is an illustration, not a diagnosis of a real crop.");
  };

  const runAnalysis = async () => {
    if (photos.length === 0) {
      toast.error(t("photoErrNone"));
      return;
    }
    if ((!fieldId && onlineReady) || busy) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    setSavedId(null);
    setPrev(null);
    try {
      if (!onlineReady) {
        const local = createOfflineLeafDiagnosis(crop, lang);
        const previous = demoData.analyses
          .filter((analysis) => analysis.fieldId === fieldId)
          .sort((a, b) => b.analyzedAt - a.analyzedAt)[0];
        setPrev(previous
          ? {
              analyzedAt: previous.analyzedAt,
              healthStatus: previous.healthStatus,
              growthStage: previous.growthStage,
              yieldLowQa: previous.yieldLowQa,
              yieldHighQa: previous.yieldHighQa,
            }
            : null);
        setResult(local);
        if (fieldId) {
          setDemoData(appendDemoAnalysis({
            fieldId,
            crop,
            variety: variety.trim() || undefined,
            growthStage: local.growthStage,
            images: photos,
            healthStatus: local.healthStatus,
            healthScore: local.healthScore ?? undefined,
            observations: local.observations,
            fertilizerAdvice: local.fertilizerAdvice ?? undefined,
            irrigationAdvice: local.irrigationAdvice ?? undefined,
            yieldLowQa: local.yieldBand?.low,
            yieldHighQa: local.yieldBand?.high,
            confidence: local.confidence ?? undefined,
            aiResponse: local.fullText,
            areaAcres: field?.area,
          }));
        }
        toast.info("Offline demo result shown; no photo was uploaded or saved.");
        return;
      }

      const res = await withTimeout(analyzePhoto({
          fileDataUrl: photos[0]!,
          extraImages: photos.slice(1),
          crop,
          variety: variety.trim() || undefined,
          cropAgeDays: ageDays ? Number(ageDays) : undefined,
          areaAcres: field?.area,
          lang,
          notes: notes.trim() || undefined,
        }));
      if (!res.ok) {
        setResult(createOfflineLeafDiagnosis(crop, lang));
        setErr(null);
        toast.info("Cloud analysis is unavailable; showing a cautious local checklist instead.");
        return;
      }
      const data = res.data;
      // The query value at click time is the pre-save latest → the "previous"
      // analysis for the current-vs-previous comparison.
      const previous = latestQ ?? demoData.analyses
        .filter((analysis) => analysis.fieldId === fieldId)
        .sort((a, b) => b.analyzedAt - a.analyzedAt)[0];
      setPrev(previous
        ? {
            analyzedAt: previous.analyzedAt,
            healthStatus: previous.healthStatus,
            growthStage: previous.growthStage,
            yieldLowQa: previous.yieldLowQa,
            yieldHighQa: previous.yieldHighQa,
          }
        : null);
      setResult(data);
      try {
        const id = await withTimeout(saveAnalysis({
          fieldId: fieldId as Id<"fields">,
          crop,
          variety: variety.trim() || undefined,
          cropAgeDays: ageDays ? Number(ageDays) : undefined,
          growthStage: data.growthStage,
          images: photos,
          healthStatus: data.healthStatus,
          healthScore: data.healthScore ?? undefined,
          observations: data.observations,
          fertilizerAdvice: data.fertilizerAdvice ?? undefined,
          irrigationAdvice: data.irrigationAdvice ?? undefined,
          yieldLowQa: data.yieldBand?.low,
          yieldHighQa: data.yieldBand?.high,
          confidence: data.confidence ?? undefined,
          aiResponse: data.fullText || undefined,
          engine: data.engine,
          areaAcres: field?.area,
        }));
        setSavedId(id);
        try {
          const rem = await fetchReminder();
          if (rem?.enabled) {
            await withTimeout(rescheduleReminder({ reminderId: rem._id }));
          }
        } catch {
          toast.info("Analysis is ready; reminder sync is unavailable.");
        }
        toast.success(t("scanSaved"));
      } catch {
        toast.info("Analysis is ready in this session, but could not be saved to the cloud.");
      }
    } catch {
      const local = createOfflineLeafDiagnosis(crop, lang);
      setResult(local);
      setSavedId(null);
      toast.info("Cloud analysis failed or timed out; showing a cautious local checklist instead.");
    } finally {
      setBusy(false);
    }
  };

  // Small helper readers over the reactive query values.
  const latestQ = useQuery(
    api.cropData.latestFieldAnalysis,
    onlineReady && fieldId ? { fieldId: fieldId as Id<"fields"> } : "skip",
  );
  const remQ = useQuery(
    api.cropData.getReminder,
    onlineReady && fieldId ? { fieldId: fieldId as Id<"fields"> } : "skip",
  );
  async function fetchReminder() {
    return remQ ?? null;
  }

  const changed =
    result && prev && healthRank(prev.healthStatus) !== healthRank(result.healthStatus);

  return (
    <PageShell title={t("scanTitle")} emoji="📸">
      <div className="mx-auto max-w-2xl space-y-5">
        <h1 className="font-display text-2xl uppercase">📸 {t("scanTitle")}</h1>

        {/* Step 1: field */}
        <section className="nb-shadow-sm nb-border bg-white p-4">
          <p className="font-display mb-2 text-sm uppercase">{t("scanStepField")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={fieldId}
              onChange={(e) => {
                const nextFieldId = e.target.value;
                const nextField = fields.find((candidate) => candidate._id === nextFieldId);
                setFieldId(nextFieldId);
                if (nextField?.crop) setCrop(nextField.crop);
                if (nextField?.variety) setVariety(nextField.variety);
                setPrev(null);
                setResult(null);
                setPhotos([]);
              }}
              className="nb-border min-h-11 flex-1 bg-[#f5f0e6] px-3 py-2 text-sm font-semibold"
            >
              <option value="">{t("scanPickField")}</option>
              {fields.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.fieldName}
                  {f.area ? ` — ${f.area} ${t("acres")}` : ""}
                  {f.crop ? ` — ${f.crop}` : ""}
                </option>
              ))}
            </select>
            <Dialog open={newOpen} onOpenChange={setNewOpen}>
              <DialogTrigger asChild>
                <button type="button" className="nb-press nb-border bg-[#ffc53d] px-3 py-2 text-xs font-bold uppercase">
                  ＋ {t("addField")}
                </button>
              </DialogTrigger>
              <DialogContent className="nb-border bg-[#f5f0e6]">
                <DialogHeader>
                  <DialogTitle className="font-display uppercase">＋ {t("addField")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Input value={nfName} onChange={(e) => setNfName(e.target.value)} placeholder={t("fieldNamePh")} className="nb-border bg-white" />
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={nfArea} onChange={(e) => setNfArea(e.target.value)} placeholder={t("fieldAreaPh")} inputMode="decimal" className="nb-border bg-white" />
                    <Input value={nfVillage} onChange={(e) => setNfVillage(e.target.value)} placeholder={t("fieldVillagePh")} className="nb-border bg-white" />
                  </div>
                  <Input value={nfCrop} onChange={(e) => setNfCrop(e.target.value)} placeholder={t("fieldCropPh")} className="nb-border bg-white" />
                  <Button onClick={createField} className="nb-border bg-[#ffc53d] font-bold text-[#141414]">
                    {t("save")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </section>

        {/* Step 2: photo — camera AND gallery via two hidden inputs.
            The gallery input has NO capture attribute, so Android browsers
            open the normal photo picker instead of forcing the camera. */}
        <section className="nb-shadow-sm nb-border bg-white p-4">
          <p className="font-display mb-2 text-sm uppercase">{t("scanStepPhoto")}</p>
          <button
            type="button"
            onClick={trySampleLeaf}
            disabled={busy || photoBusy}
            className="nb-press nb-border mb-3 w-full bg-[#e9f7d8] px-4 py-2.5 text-sm font-bold"
          >
            🌿 Try Sample Leaf Disease Photo
          </button>
          {photos.length === 0 ? (
            <button
              type="button"
              onClick={() => openPicker(null)}
              disabled={busy || photoBusy}
              className="nb-press nb-border flex w-full flex-col items-center gap-2 bg-[#ede7d8] p-6 text-center"
            >
              <Camera className="h-7 w-7" />
              <span className="text-sm font-semibold">
                {photoBusy ? t("photoProcessing") : `📷 ${t("scanTakePhoto")}`}
              </span>
              <span className="text-[11px] font-semibold text-[#5c574b]">{t("photoHint")}</span>
            </button>
          ) : (
            <>
              <div className="flex flex-wrap gap-3">
                {photos.map((p, i) => (
                  <div key={i} className="relative">
                    <img
                      src={p}
                      alt={`${t("photoN").replace("{n}", String(i + 1))}`}
                      className="h-24 w-24 rounded-lg border-2 border-[#141414]/15 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      disabled={busy || photoBusy}
                      aria-label={t("photoRemove")}
                      className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#141414] bg-[#d64545] text-white shadow"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openPicker(i)}
                      disabled={busy || photoBusy}
                      className="nb-border nb-press mt-1 flex w-24 items-center justify-center gap-1 bg-white px-1 py-1 text-[10px] font-bold uppercase"
                    >
                      <RefreshCw className="h-3 w-3" />
                      {t("photoChange")}
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => openPicker(null)}
                    disabled={busy || photoBusy}
                    className="nb-border flex h-24 w-24 flex-col items-center justify-center gap-1 border-dashed bg-[#ede7d8]"
                  >
                    <Plus className="h-5 w-5" />
                    <span className="text-[10px] font-bold uppercase">{t("photoAdd")}</span>
                  </button>
                )}
              </div>
              <p className="mt-2 text-[11px] font-semibold text-[#5c574b]">
                {t("photoCount").replace("{cur}", String(photos.length)).replace("{max}", String(MAX_PHOTOS))}
              </p>
            </>
          )}

          {/* Hidden inputs: camera keeps capture="environment"; the gallery
              input must NOT have capture — that is what forces the camera. */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoSelect}
            style={{ display: "none" }}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelect}
            style={{ display: "none" }}
          />

          {/* Picker dialog with BOTH options — shown on tap of the main button. */}
          {pickerOpen && (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-[#141414]/60 p-4 sm:items-center"
              onClick={() => setPickerOpen(false)}
            >
              <div
                className="nb-shadow-sm nb-border w-full max-w-sm bg-[#f5f0e6] p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="font-display mb-3 text-sm uppercase">➕ {t("photoAddPhoto")}</p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleTakePhoto}
                    className="nb-press nb-border w-full bg-[#ffc53d] px-3 py-3 text-left text-sm font-bold uppercase"
                  >
                    📷 {t("photoTakePhoto")}
                  </button>
                  <button
                    type="button"
                    onClick={handleChooseGallery}
                    className="nb-press nb-border w-full bg-[#b5e48c] px-3 py-3 text-left text-sm font-bold uppercase"
                  >
                    🖼️ {t("photoChooseGallery")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(false)}
                    className="nb-press nb-border w-full bg-white px-3 py-2.5 text-left text-sm font-bold uppercase"
                  >
                    ❌ {t("photoCancel")}
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <select
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
              className="nb-border min-h-11 bg-[#f5f0e6] px-2 py-2 text-sm font-semibold"
            >
              {CROPS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <Input value={variety} onChange={(e) => setVariety(e.target.value)} placeholder={t("varietyPh")} className="nb-border bg-[#f5f0e6]" />
            <Input value={ageDays} onChange={(e) => setAgeDays(e.target.value)} placeholder={t("agePh")} inputMode="numeric" className="nb-border bg-[#f5f0e6]" />
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("scanNotesPh")} className="nb-border bg-[#f5f0e6]" />
          </div>
          <button
            type="button"
            disabled={photos.length === 0 || (onlineReady && !fieldId) || busy}
            onClick={runAnalysis}
            className="nb-press nb-border mt-3 w-full bg-[#ffc53d] px-4 py-3 font-display text-base uppercase disabled:opacity-50"
          >
            {busy ? `⏳ ${t("scanAnalyzing")}` : `🔍 ${t("scanAnalyzeBtn")}`}
          </button>
          {!fieldId && onlineReady && (
            <p className="mt-2 text-xs font-semibold text-[#8a5a00]">{t("scanNeedField")}</p>
          )}
        </section>

        {err === "photo_unclear" && (
          <p className="nb-border bg-[#ffd6d6] p-3 text-sm font-semibold">⚠️ {t("scanUnclear")}</p>
        )}

        {/* Result */}
        {result && (
          <section className="nb-shadow-sm nb-border bg-white p-4">
            <p className="font-display mb-2 text-sm uppercase">{t("scanResultTitle")}</p>
            {result.engine === "offline" && (
              <p className="nb-border mb-3 bg-[#fff3c4] p-2 text-xs font-semibold">⚙️ {t("scanOfflineNote")}</p>
            )}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p><span className="font-bold">{t("healthLabel")}:</span> {t(`health_${result.healthStatus}`)}</p>
              <p><span className="font-bold">{t("stageLabel")}:</span> {result.growthStage}</p>
              {result.healthScore !== null && (
                <p><span className="font-bold">{t("scanScore")}:</span> {result.healthScore}/100</p>
              )}
              {result.confidence !== null && (
                <p><span className="font-bold">{t("scanConfidence")}:</span> {Math.round(result.confidence * 100)}%</p>
              )}
              {result.yieldBand && (
                <p className="col-span-2">
                  <span className="font-bold">{t("yieldEstLabel")}:</span>{" "}
                  {result.yieldBand.low}–{result.yieldBand.high} {t("qPerAcre")}
                </p>
              )}
            </div>
            {result.observations.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-bold uppercase">{t("scanObservations")}</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {result.observations.map((o, i) => <li key={i}>{o}</li>)}
                </ul>
              </div>
            )}
            {result.fertilizerAdvice && (
              <p className="mt-3 text-sm">🧪 {result.fertilizerAdvice}</p>
            )}
            {result.irrigationAdvice && (
              <p className="mt-1 text-sm">💧 {result.irrigationAdvice}</p>
            )}
            {result.fullText && (
              <p className="mt-3 border-t-2 border-dashed border-[#141414]/30 pt-2 text-sm">{result.fullText}</p>
            )}
            <p className="mt-3 text-[11px] font-semibold text-[#5c574b]">{t("scanDisclaimer")}</p>

            {/* Current vs Previous */}
            {prev && (
              <div className="nb-border mt-4 bg-[#ede7d8] p-3">
                <p className="text-xs font-bold uppercase">📊 {t("vsPrevTitle")}</p>
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase">
                      <th className="py-1">{t("parameter")}</th>
                      <th className="py-1">{t("prevShort")}</th>
                      <th className="py-1">{t("currShort")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-[#141414]/20">
                      <td className="py-1">{t("healthLabel")}</td>
                      <td className="py-1">{t(`health_${prev.healthStatus}`)}</td>
                      <td className="py-1">{t(`health_${result.healthStatus}`)}</td>
                    </tr>
                    <tr className="border-t border-[#141414]/20">
                      <td className="py-1">{t("stageLabel")}</td>
                      <td className="py-1">{prev.growthStage ?? "—"}</td>
                      <td className="py-1">{result.growthStage}</td>
                    </tr>
                    <tr className="border-t border-[#141414]/20">
                      <td className="py-1">{t("yieldEstLabel")}</td>
                      <td className="py-1">
                        {prev.yieldLowQa != null ? `${prev.yieldLowQa}–${prev.yieldHighQa} ${t("qPerAcre")}` : "—"}
                      </td>
                      <td className="py-1">
                        {result.yieldBand ? `${result.yieldBand.low}–${result.yieldBand.high} ${t("qPerAcre")}` : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
                {changed && (
                  <p className="mt-2 text-xs font-semibold">
                    {healthRank(result.healthStatus) > healthRank(prev.healthStatus)
                      ? `📉 ${t("vsPrevWorse")}`
                      : `📈 ${t("vsPrevBetter")}`}
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate(savedId ? `/history?a=${savedId}` : "/history")}
                className="nb-press nb-border bg-[#ffc53d] px-3 py-2 text-xs font-bold uppercase"
              >
                ➡️ {t("viewAnalysis")}
              </button>
              <button
                type="button"
                onClick={() => navigate(`/fields${fieldId ? `?f=${fieldId}` : ""}`)}
                className="nb-press nb-border bg-white px-3 py-2 text-xs font-bold uppercase"
              >
                🌱 {t("viewTimeline")}
              </button>
            </div>
          </section>
        )}

        {/* Reminder */}
        {fieldId && (!onlineReady || remQ !== undefined) && (
          <ReminderCard
            fieldId={fieldId}
            reminder={remQ}
            onChanged={() => undefined}
            hasConvexUrl={onlineReady}
          />
        )}
      </div>
    </PageShell>
  );
}

/** Reminder setup: 7 / 14 / 30 days or a custom date, with on/off. */
function ReminderCard({
  fieldId,
  reminder,
  hasConvexUrl,
}: {
  fieldId: string;
  reminder: { _id: Id<"monitorReminders">; frequencyDays?: number; customDate?: string; enabled: boolean; nextDate: number } | null | undefined;
  onChanged: () => void;
  hasConvexUrl: boolean;
}) {
  const { t } = useLang();
  const setReminder = useMutation(api.cropData.setReminder);
  const [freq, setFreq] = useState<string>(
    reminder?.frequencyDays ? String(reminder.frequencyDays) : reminder?.customDate ? "custom" : "7",
  );
  const [customDate, setCustomDate] = useState(reminder?.customDate ?? "");
  const [enabled, setEnabled] = useState(reminder?.enabled ?? true);

  const apply = async (nextEnabled: boolean) => {
    if (!hasConvexUrl) {
      setEnabled(nextEnabled);
      toast.info(nextEnabled ? "Reminder enabled for this demo session." : "Reminder disabled for this demo session.");
      return;
    }
    try {
      await withTimeout(setReminder({
        fieldId: fieldId as Id<"fields">,
        frequencyDays: freq === "custom" ? undefined : Number(freq),
        customDate: freq === "custom" ? customDate || undefined : undefined,
        enabled: nextEnabled,
      }));
      setEnabled(nextEnabled);
      toast.success(nextEnabled ? t("remOn") : t("remOff"));
    } catch {
      setEnabled(nextEnabled);
      toast.info("Reminder preference updated for this session; cloud sync is unavailable.");
    }
  };

  return (
    <section className="nb-shadow-sm nb-border bg-white p-4">
      <p className="font-display mb-2 text-sm uppercase">🔔 {t("remTitle")}</p>
      <div className="flex flex-wrap items-center gap-2">
        {["7", "14", "30", "custom"].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFreq(f)}
            className={`nb-border nb-press px-3 py-1.5 text-xs font-bold uppercase ${freq === f ? "bg-[#ffc53d]" : "bg-[#f5f0e6]"}`}
          >
            {f === "custom" ? t("remCustom") : t("remEvery", { days: f })}
          </button>
        ))}
      </div>
      {freq === "custom" && (
        <Input
          type="date"
          value={customDate}
          onChange={(e) => setCustomDate(e.target.value)}
          className="nb-border mt-2 bg-[#f5f0e6]"
        />
      )}
      <p className="mt-2 text-xs font-semibold text-[#5c574b]">
        💬 {t("remHint", { days: freq === "custom" ? customDate || "?" : freq })}
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => apply(true)}
          disabled={enabled}
          className="nb-press nb-border bg-[#b5e48c] px-3 py-2 text-xs font-bold uppercase disabled:opacity-60"
        >
          🔔 {t("remTurnOn")}
        </button>
        <button
          type="button"
          onClick={() => apply(false)}
          disabled={!enabled}
          className="nb-press nb-border bg-white px-3 py-2 text-xs font-bold uppercase disabled:opacity-60"
        >
          🔕 {t("remTurnOff")}
        </button>
      </div>
    </section>
  );
}
