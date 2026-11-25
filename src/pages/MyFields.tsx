import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLang } from "@/context/LanguageContext";
import { PageShell } from "@/components/dashboard/PageShell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  addDemoField,
  deleteDemoField,
  loadDemoFarmData,
  type DemoAnalysis,
  type DemoField,
} from "@/lib/demoFarmStore";
import { withTimeout } from "@/lib/demoAgronomy";

const HEALTH_EMOJI: Record<string, string> = {
  healthy: "😀",
  mild_stress: "🙂",
  moderate_stress: "😟",
  severe_stress: "🥵",
};

export default function MyFields() {
  const { t } = useLang();
  const [params] = useSearchParams();
  const selectedId = params.get("f");
  const hasConvexUrl = Boolean(import.meta.env.VITE_CONVEX_URL);
  const [demoData, setDemoData] = useState(loadDemoFarmData);

  const fieldsQuery = useQuery(api.cropData.listFields, hasConvexUrl ? {} : "skip");
  const analysesQuery = useQuery(api.cropData.listAnalyses, hasConvexUrl ? { limit: 200 } : "skip");
  const fields = (fieldsQuery ?? demoData.fields) as DemoField[];
  const analyses = (analysesQuery ?? demoData.analyses) as DemoAnalysis[];
  const onlineReady = hasConvexUrl && fieldsQuery !== undefined && analysesQuery !== undefined;
  const addField = useMutation(api.cropData.addField);
  const deleteField = useMutation(api.cropData.deleteField);

  const [open, setOpen] = useState(false);
  const [nfName, setNfName] = useState("");
  const [nfArea, setNfArea] = useState("");
  const [nfCrop, setNfCrop] = useState("");
  const [nfVariety, setNfVariety] = useState("");
  const [nfVillage, setNfVillage] = useState("");
  const [nfSowing, setNfSowing] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const byField = useMemo(() => {
    const map = new Map<string, DemoAnalysis[]>();
    for (const a of analyses) {
      const list = map.get(a.fieldId) ?? [];
      list.push(a);
      map.set(a.fieldId, list);
    }
    return map;
  }, [analyses]);

  const selected = selectedId ? fields.find((f) => f._id === selectedId) : undefined;

  const create = async () => {
    if (!nfName.trim()) return;
    const newField = {
      fieldName: nfName.trim(),
      area: nfArea ? Number(nfArea) : undefined,
      crop: nfCrop.trim() || undefined,
      variety: nfVariety.trim() || undefined,
      village: nfVillage.trim() || undefined,
      sowingDate: nfSowing || undefined,
    };
    const resetForm = () => {
      setOpen(false);
      setNfName("");
      setNfArea("");
      setNfCrop("");
      setNfVariety("");
      setNfVillage("");
      setNfSowing("");
    };
    if (!onlineReady) {
      setDemoData(addDemoField(newField));
      resetForm();
      toast.success(t("fieldAdded"));
      return;
    }
    try {
      await withTimeout(addField(newField));
      resetForm();
      toast.success(t("fieldAdded"));
    } catch {
      setDemoData(addDemoField(newField));
      resetForm();
      toast.info("Field added to this browser's demo data because cloud sync is unavailable.");
    }
  };

  const remove = async (fid: string) => {
    if (!onlineReady) {
      setDemoData(deleteDemoField(fid));
      setConfirmDel(null);
      toast.success(t("fieldDeleted"));
      return;
    }
    try {
      await withTimeout(deleteField({ fieldId: fid as Id<"fields"> }));
      toast.success(t("fieldDeleted"));
    } catch {
      setDemoData(deleteDemoField(fid));
      toast.info("Field removed from this browser's demo data; cloud sync is unavailable.");
    } finally {
      setConfirmDel(null);
    }
  };

  return (
    <PageShell title={t("navFields")} emoji="🌾">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl uppercase">🌾 {t("fieldsTitle")}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
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
              <div className="grid grid-cols-2 gap-3">
                <Input value={nfCrop} onChange={(e) => setNfCrop(e.target.value)} placeholder={t("fieldCropPh")} className="nb-border bg-white" />
                <Input value={nfVariety} onChange={(e) => setNfVariety(e.target.value)} placeholder={t("varietyPh")} className="nb-border bg-white" />
              </div>
              <label className="text-xs font-bold uppercase">{t("sowingDate")}</label>
              <Input type="date" value={nfSowing} onChange={(e) => setNfSowing(e.target.value)} className="nb-border bg-white" />
              <Button onClick={create} className="nb-border bg-[#ffc53d] font-bold text-[#141414]">
                {t("save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {fields.length === 0 ? (
        <p className="nb-border nb-shadow-sm bg-white p-6 text-center text-sm font-semibold">
          {t("noFields")}
        </p>
      ) : (
        <div className="space-y-5">
          {fields.map((f) => {
            const list = (byField.get(f._id) ?? []).sort(
              (a, b) => b.analyzedAt - a.analyzedAt,
            );
            return (
              <section key={f._id} className="nb-shadow-sm nb-border bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-base uppercase">
                      {f.fieldName}
                      {f.area ? ` — ${f.area} ${t("acres")}` : ""}
                    </p>
                    <p className="text-xs font-semibold text-[#5c574b]">
                      {[f.crop, f.variety, f.village, f.district].filter(Boolean).join(" · ") || "—"}
                      {f.sowingDate ? ` · 🌱 ${f.sowingDate}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      to={`/scan?f=${f._id}`}
                      className="nb-press nb-border bg-[#ffc53d] px-3 py-1.5 text-xs font-bold uppercase"
                    >
                      📸 {t("scanShort")}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setConfirmDel(f._id)}
                      className="nb-press nb-border bg-white px-2.5 py-1.5 text-xs font-bold uppercase"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {confirmDel === f._id && (
                  <div className="nb-border mt-3 bg-[#ffd6d6] p-3">
                    <p className="text-xs font-semibold">{t("delFieldConfirm")}</p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => remove(f._id)} className="nb-press nb-border bg-white px-3 py-1.5 text-xs font-bold uppercase">
                        {t("yesDelete")}
                      </button>
                      <button type="button" onClick={() => setConfirmDel(null)} className="nb-press nb-border bg-white px-3 py-1.5 text-xs font-bold uppercase">
                        {t("cancel")}
                      </button>
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase">🌱 {t("timelineTitle")}</p>
                  {list.length === 0 ? (
                    <p className="mt-2 text-xs font-semibold text-[#5c574b]">{t("noAnalysesYet")}</p>
                  ) : (
                    <ol className="mt-2 space-y-0">
                      {list.map((a, i) => (
                        <li key={a._id} className="relative flex gap-3 pb-4">
                          {/* connector */}
                          {i < list.length - 1 && (
                            <span className="absolute left-[13px] top-7 h-full w-0.5 bg-[#141414]/30" aria-hidden />
                          )}
                          <span className="z-10 grid h-7 w-7 shrink-0 place-items-center border-2 border-[#141414] bg-[#ffc53d] text-xs">
                            📸
                          </span>
                          <div className="nb-border min-w-0 flex-1 bg-[#f5f0e6] p-2.5">
                            <p className="text-[11px] font-bold uppercase">
                              {new Date(a.analyzedAt).toLocaleDateString()}
                            </p>
                            <p className="mt-0.5 text-sm font-semibold">
                              {HEALTH_EMOJI[a.healthStatus] ?? "•"} {t(`health_${a.healthStatus}`)}
                              {a.yieldLowQa != null && (
                                <span className="ml-2 font-normal">
                                  · 📊 {a.yieldLowQa}–{a.yieldHighQa} {t("qPerAcre")}
                                </span>
                              )}
                            </p>
                            {a.growthStage && (
                              <p className="text-xs text-[#5c574b]">
                                {t("stageLabel")}: {a.growthStage}
                              </p>
                            )}
                            <Link
                              to={`/history?a=${a._id}`}
                              className="mt-1 inline-block text-xs font-bold uppercase underline"
                            >
                              ➡️ {t("viewAnalysis")}
                            </Link>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {selected && (
        <p className="sr-only">{selected.fieldName}</p>
      )}
    </PageShell>
  );
}
