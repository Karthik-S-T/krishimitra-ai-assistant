import { useAction, useMutation, useQuery } from "convex/react";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLang } from "@/context/LanguageContext";
import { PageShell } from "@/components/dashboard/PageShell";
import { compressImage, validatePhoto } from "@/lib/imageCompress";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  appendDemoAnalysis,
  deleteDemoAnalysis,
  loadDemoFarmData,
  updateDemoAnalysis,
  type DemoAnalysis,
  type DemoField,
} from "@/lib/demoFarmStore";
import { createOfflineLeafDiagnosis, withTimeout } from "@/lib/demoAgronomy";

const HEALTH_EMOJI: Record<string, string> = {
  healthy: "❤️",
  mild_stress: "💛",
  moderate_stress: "🧡",
  severe_stress: "❗",
};

/** Shareable text report for one analysis (Web Share / clipboard). */
function buildReport(
  row: {
    crop: string;
    variety?: string;
    analyzedAt: number;
    healthStatus: string;
    growthStage?: string;
    observations: string[];
    fertilizerAdvice?: string;
    irrigationAdvice?: string;
    yieldLowQa?: number;
    yieldHighQa?: number;
    confidence?: number;
    farmerNotes?: string;
    village?: string;
    taluk?: string;
    district?: string;
    areaAcres?: number;
  },
  fieldName: string,
  L: (k: string, p?: Record<string, string | number>) => string,
): string {
  const lines: string[] = [];
  lines.push("🌱 KrishiMitra AI — " + L("shareReportTitle"));
  lines.push(`${L("scanStepField")}: ${fieldName} (${row.crop}${row.variety ? ` · ${row.variety}` : ""})`);
  lines.push(`📅 ${new Date(row.analyzedAt).toLocaleString()}`);
  if (row.village || row.district) {
    lines.push(`📍 ${[row.village, row.taluk, row.district].filter(Boolean).join(", ")}`);
  }
  if (row.areaAcres != null) lines.push(`🗺️ ${L("fieldAreaPh")}: ${row.areaAcres}`);
  lines.push(`❤️ ${L("healthLabel")}: ${L(`health_${row.healthStatus}`)}`);
  if (row.growthStage) lines.push(`🌿 ${L("stageLabel")}: ${row.growthStage}`);
  if (row.yieldLowQa != null) {
    lines.push(`📊 ${L("yieldEstLabel")}: ${row.yieldLowQa}–${row.yieldHighQa} ${L("qPerAcre")}`);
  }
  if (row.observations.length) {
    lines.push(`🦠 ${L("scanObservations")}:`);
    for (const o of row.observations) lines.push(`  • ${o}`);
  }
  if (row.fertilizerAdvice) lines.push(`🧪 ${row.fertilizerAdvice}`);
  if (row.irrigationAdvice) lines.push(`💧 ${row.irrigationAdvice}`);
  if (row.farmerNotes) lines.push(`📝 ${L("notesTitle")}: ${row.farmerNotes}`);
  if (row.confidence != null) {
    lines.push(`${L("scanConfidence")}: ${Math.round(row.confidence * 100)}%`);
  }
  lines.push("");
  lines.push("⚠️ " + L("scanDisclaimer"));
  return lines.join("\n");
}

export default function History() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const detailId = params.get("a");
  const hasConvexUrl = Boolean(import.meta.env.VITE_CONVEX_URL);
  const [demoData, setDemoData] = useState(loadDemoFarmData);

  const analysesQuery = useQuery(api.cropData.listAnalyses, hasConvexUrl ? { limit: 100 } : "skip");
  const fieldsQuery = useQuery(api.cropData.listFields, hasConvexUrl ? {} : "skip");
  const analyses = (analysesQuery ?? demoData.analyses) as DemoAnalysis[];
  const fields = (fieldsQuery ?? demoData.fields) as DemoField[];
  const onlineReady = hasConvexUrl && analysesQuery !== undefined && fieldsQuery !== undefined;
  const deleteAnalysis = useMutation(api.cropData.deleteAnalysis);
  const saveNotes = useMutation(api.cropData.saveNotes);
  const saveAnalysis = useMutation(api.cropData.saveAnalysis);
  const analyzePhoto = useAction(api.cropPhoto.analyzeCropPhoto);

  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [rebusy, setRebusy] = useState(false);
  // "Analyze Again" also offers BOTH camera and gallery (gallery input has no
  // capture attribute so Android browsers open the photo picker, not the camera).
  const reCamRef = useRef<HTMLInputElement>(null);
  const reGalRef = useRef<HTMLInputElement>(null);
  const [rePickerOpen, setRePickerOpen] = useState(false);
  const [reTarget, setReTarget] = useState<{ _id: string; fieldId: Id<"fields">; crop: string; variety?: string } | null>(null);

  const detail = useMemo(
    () => analyses.find((a) => a._id === detailId) ?? null,
    [analyses, detailId],
  );
  const detailField = useMemo(
    () => (detail ? fields.find((f) => f._id === (detail.fieldId as string)) : null),
    [fields, detail],
  );

  const fieldName = (id: string) =>
    fields.find((f) => f._id === id)?.fieldName ?? "?";

  const share = async (row: NonNullable<typeof detail>) => {
    const text = buildReport(row, fieldName(row.fieldId as string), t);
    try {
      if (navigator.share) {
        await navigator.share({ title: "KrishiMitra AI", text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success(t("copied"));
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        toast.error(t("errGeneric"));
      }
    }
  };

  const addNotes = async () => {
    if (!detail) return;
    if (!onlineReady) {
      setDemoData(updateDemoAnalysis(detail._id, { farmerNotes: notesDraft }));
      setNotesOpen(false);
      toast.success(t("savedNotes"));
      return;
    }
    try {
      await withTimeout(saveNotes({ analysisId: detail._id as Id<"cropAnalyses">, notes: notesDraft }));
      setNotesOpen(false);
      toast.success(t("savedNotes"));
    } catch {
      setDemoData(updateDemoAnalysis(detail._id, { farmerNotes: notesDraft }));
      setNotesOpen(false);
      toast.info("Notes saved in this browser because cloud sync is unavailable.");
    }
  };

  const remove = async () => {
    if (!detail) return;
    if (!onlineReady) {
      setDemoData(deleteDemoAnalysis(detail._id));
      setConfirmDel(false);
      setParams({}, { replace: true });
      toast.success(t("deletedAnalysis"));
      return;
    }
    try {
      await withTimeout(deleteAnalysis({ analysisId: detail._id as Id<"cropAnalyses"> }));
      setConfirmDel(false);
      setParams({}, { replace: true });
      toast.success(t("deletedAnalysis"));
    } catch {
      setDemoData(deleteDemoAnalysis(detail._id));
      setConfirmDel(false);
      setParams({}, { replace: true });
      toast.info("Analysis removed from this browser's demo data; cloud sync is unavailable.");
    }
  };

  // "Analyze Again": new photo for the same field → append (never replace).
  const onReFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !reTarget) return;
    const invalid = validatePhoto(file);
    if (invalid === "not_image") {
      toast.error(t("photoErrType"));
      return;
    }
    if (invalid === "too_large") {
      toast.error(t("photoErrSize"));
      return;
    }
    setRebusy(true);
    try {
      const img = await compressImage(file);
      if (!onlineReady) {
        const local = createOfflineLeafDiagnosis(reTarget.crop, lang);
        setDemoData(appendDemoAnalysis({
          fieldId: reTarget.fieldId,
          crop: reTarget.crop,
          variety: reTarget.variety,
          growthStage: local.growthStage,
          images: [img],
          healthStatus: local.healthStatus,
          observations: local.observations,
          fertilizerAdvice: local.fertilizerAdvice ?? undefined,
          irrigationAdvice: local.irrigationAdvice ?? undefined,
          aiResponse: local.fullText,
          areaAcres: demoData.fields.find((f) => f._id === reTarget.fieldId)?.area,
        }));
        toast.info("A local checklist was added to demo history; no photo was uploaded.");
        setParams({}, { replace: true });
        return;
      }

      try {
        const res = await withTimeout(analyzePhoto({
          fileDataUrl: img,
          crop: reTarget.crop,
          variety: reTarget.variety,
          lang,
        }));
        if (!res.ok) throw new Error("Cloud photo analysis did not return a result.");
        await withTimeout(saveAnalysis({
          fieldId: reTarget.fieldId,
          crop: reTarget.crop,
          variety: reTarget.variety,
          growthStage: res.data.growthStage,
          images: [img],
          healthStatus: res.data.healthStatus,
          healthScore: res.data.healthScore ?? undefined,
          observations: res.data.observations,
          fertilizerAdvice: res.data.fertilizerAdvice ?? undefined,
          irrigationAdvice: res.data.irrigationAdvice ?? undefined,
          yieldLowQa: res.data.yieldBand?.low,
          yieldHighQa: res.data.yieldBand?.high,
          confidence: res.data.confidence ?? undefined,
          aiResponse: res.data.fullText || undefined,
          engine: res.data.engine,
        }));
        toast.success(t("scanSaved"));
      } catch {
        const local = createOfflineLeafDiagnosis(reTarget.crop, lang);
        setDemoData(appendDemoAnalysis({
          fieldId: reTarget.fieldId,
          crop: reTarget.crop,
          variety: reTarget.variety,
          growthStage: local.growthStage,
          images: [img],
          healthStatus: local.healthStatus,
          observations: local.observations,
          fertilizerAdvice: local.fertilizerAdvice ?? undefined,
          irrigationAdvice: local.irrigationAdvice ?? undefined,
          aiResponse: local.fullText,
          areaAcres: demoData.fields.find((f) => f._id === reTarget.fieldId)?.area,
        }));
        toast.info("Cloud analysis is unavailable; a local checklist was added to demo history.");
      }
      setParams({}, { replace: true });
    } catch {
      toast.error(t("scanBadImage"));
    } finally {
      setRebusy(false);
      setReTarget(null);
    }
  };

  return (
    <PageShell title={t("navHistory")} emoji="📋">
      <h1 className="font-display mb-4 text-2xl uppercase">📋 {t("historyTitle")}</h1>

      {analyses.length === 0 ? (
        <div className="nb-shadow-sm nb-border bg-white p-6 text-center">
          <p className="text-sm font-semibold">{t("noAnalysesYet")}</p>
          <button
            type="button"
            onClick={() => navigate("/scan")}
            className="nb-press nb-border mt-3 bg-[#ffc53d] px-4 py-2 text-sm font-bold uppercase"
          >
            📸 {t("scanShort")}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {analyses.map((a) => (
            <button
              key={a._id}
              type="button"
              onClick={() => setParams({ a: a._id })}
              className="nb-press nb-shadow-sm nb-border block w-full bg-white p-4 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-base uppercase">
                    {a.crop}
                    {a.variety ? ` · ${a.variety}` : ""} — {fieldName(a.fieldId as string)}
                  </p>
                  <p className="text-xs font-semibold text-[#5c574b]">
                    📅 {new Date(a.analyzedAt).toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {HEALTH_EMOJI[a.healthStatus] ?? "•"} {t("healthShort")}: {t(`health_${a.healthStatus}`)}
                  </p>
                  {a.yieldLowQa != null && (
                    <p className="text-sm">
                      📊 {t("yieldEstLabel")}: {a.yieldLowQa}–{a.yieldHighQa} {t("qPerAcre")}
                    </p>
                  )}
                  {a.observations.length > 0 && (
                    <p className="mt-0.5 truncate text-xs text-[#5c574b]">
                      🦠 {t("issueShort")}: {a.observations[0]}
                    </p>
                  )}
                </div>
                {a.images[0] && (
                  <img
                    src={a.images[0]}
                    alt=""
                    className="nb-border h-16 w-16 shrink-0 object-cover"
                    loading="lazy"
                  />
                )}
              </div>
              <p className="mt-2 text-xs font-bold uppercase underline">➡️ {t("viewAnalysis")}</p>
            </button>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={detail !== null} onOpenChange={(o) => !o && setParams({}, { replace: true })}>
        <DialogContent className="nb-border max-h-[85vh] overflow-y-auto bg-[#f5f0e6]">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display uppercase">
                  {detail.crop} — {fieldName(detail.fieldId as string)}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase">
                  📅 {new Date(detail.analyzedAt).toLocaleString()}
                  {detailField?.village || detail.village ? (
                    <span className="ml-2 font-normal normal-case">
                      📍 {[detail.village, detail.taluk, detail.district].filter(Boolean).join(", ")}
                    </span>
                  ) : null}
                </p>
                <div className="flex flex-wrap gap-2">
                  {detail.images.map((img, i) => (
                    <img key={i} src={img} alt="" className="nb-border h-28 w-28 object-cover" />
                  ))}
                </div>
                <div className="nb-border bg-white p-3 text-sm">
                  <p><span className="font-bold">❤️ {t("healthLabel")}:</span> {t(`health_${detail.healthStatus}`)}</p>
                  {detail.healthScore != null && <p><span className="font-bold">{t("scanScore")}:</span> {detail.healthScore}/100</p>}
                  {detail.growthStage && <p><span className="font-bold">🌿 {t("stageLabel")}:</span> {detail.growthStage}</p>}
                  {detail.areaAcres != null && <p><span className="font-bold">🗺️ {t("fieldAreaPh")}:</span> {detail.areaAcres} {t("acres")}</p>}
                  {detail.yieldLowQa != null && (
                    <p><span className="font-bold">📊 {t("yieldEstLabel")}:</span> {detail.yieldLowQa}–{detail.yieldHighQa} {t("qPerAcre")}</p>
                  )}
                  {detail.confidence != null && (
                    <p><span className="font-bold">{t("scanConfidence")}:</span> {Math.round(detail.confidence * 100)}%</p>
                  )}
                  {detail.observations.length > 0 && (
                    <div className="mt-2">
                      <p className="font-bold">🦠 {t("scanObservations")}</p>
                      <ul className="list-disc pl-5">
                        {detail.observations.map((o, i) => <li key={i}>{o}</li>)}
                      </ul>
                    </div>
                  )}
                  {detail.fertilizerAdvice && <p className="mt-2">🧪 {detail.fertilizerAdvice}</p>}
                  {detail.irrigationAdvice && <p className="mt-1">💧 {detail.irrigationAdvice}</p>}
                  {detail.aiResponse && <p className="mt-2 border-t border-dashed border-[#141414]/30 pt-2">{detail.aiResponse}</p>}
                  {detail.farmerNotes && (
                    <p className="mt-2 bg-[#ede7d8] p-2">📝 {detail.farmerNotes}</p>
                  )}
                  <p className="mt-2 text-[11px] font-semibold text-[#5c574b]">⚠️ {t("scanDisclaimer")}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => setReTarget({
                      _id: detail._id,
                      fieldId: detail.fieldId as Id<"fields">,
                      crop: detail.crop,
                      variety: detail.variety,
                    })}
                    className="nb-border bg-[#ffc53d] font-bold text-[#141414]"
                  >
                    🔄 {t("analyzeAgain")}
                  </Button>
                  <Button
                    onClick={() => navigate(`/compare?a=${detail._id}`)}
                    className="nb-border bg-white font-bold text-[#141414]"
                  >
                    📊 {t("compareTitle")}
                  </Button>
                  <Button
                    onClick={() => {
                      setNotesDraft(detail.farmerNotes ?? "");
                      setNotesOpen(true);
                    }}
                    className="nb-border bg-white font-bold text-[#141414]"
                  >
                    📝 {t("addNotes")}
                  </Button>
                  <Button onClick={() => share(detail)} className="nb-border bg-white font-bold text-[#141414]">
                    📤 {t("shareReportTitle")}
                  </Button>
                  <Button
                    onClick={() => setConfirmDel(true)}
                    className="nb-border col-span-2 bg-[#ffd6d6] font-bold text-[#141414]"
                  >
                    🗑️ {t("delete")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Notes dialog */}
      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="nb-border bg-[#f5f0e6]">
          <DialogHeader>
            <DialogTitle className="font-display uppercase">📝 {t("addNotes")}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            rows={4}
            className="nb-border bg-white"
            placeholder={t("notesPh")}
          />
          <Button onClick={addNotes} className="nb-border bg-[#ffc53d] font-bold text-[#141414]">
            {t("save")}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={confirmDel} onOpenChange={setConfirmDel}>
        <DialogContent className="nb-border bg-[#f5f0e6]">
          <DialogHeader>
            <DialogTitle className="font-display uppercase">🗑️ {t("delete")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm font-semibold">{t("delAnalysisConfirm")}</p>
          <div className="flex gap-2">
            <Button onClick={remove} className="nb-border bg-[#ffd6d6] font-bold text-[#141414]">{t("yesDelete")}</Button>
            <Button onClick={() => setConfirmDel(false)} className="nb-border bg-white font-bold text-[#141414]">{t("cancel")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden re-analysis inputs: camera + gallery */}
      <input
        ref={reCamRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onReFile}
      />
      <input
        ref={reGalRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onReFile}
      />
      {reTarget && (
        <Dialog open onOpenChange={(o) => !o && setReTarget(null)}>
          <DialogContent className="nb-border bg-[#f5f0e6]">
            <DialogHeader>
              <DialogTitle className="font-display uppercase">🔄 {t("analyzeAgain")}</DialogTitle>
            </DialogHeader>
            <p className="text-sm font-semibold">{t("reanalyzeHint")}</p>
            <div className="space-y-2">
              <button
                type="button"
                disabled={rebusy}
                onClick={() => setRePickerOpen(true)}
                className="nb-press nb-border w-full bg-[#ffc53d] px-4 py-3 text-sm font-bold uppercase disabled:opacity-50"
              >
                {rebusy ? `⏳ ${t("scanAnalyzing")}` : `📷 ${t("scanTakePhoto")}`}
              </button>
              {rePickerOpen && (
                <>
                  <button
                    type="button"
                    disabled={rebusy}
                    onClick={() => {
                      setRePickerOpen(false);
                      reCamRef.current?.click();
                    }}
                    className="nb-press nb-border w-full bg-[#ffc53d] px-4 py-2.5 text-left text-sm font-bold uppercase"
                  >
                    📷 {t("photoTakePhoto")}
                  </button>
                  <button
                    type="button"
                    disabled={rebusy}
                    onClick={() => {
                      setRePickerOpen(false);
                      reGalRef.current?.click();
                    }}
                    className="nb-press nb-border w-full bg-[#b5e48c] px-4 py-2.5 text-left text-sm font-bold uppercase"
                  >
                    🖼️ {t("photoChooseGallery")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRePickerOpen(false)}
                    className="nb-press nb-border w-full bg-white px-4 py-2 text-left text-sm font-bold uppercase"
                  >
                    ❌ {t("photoCancel")}
                  </button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </PageShell>
  );
}
