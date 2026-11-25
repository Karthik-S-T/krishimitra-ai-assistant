import { useAction, useQuery } from "convex/react";
import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/context/LanguageContext";
import { PageShell } from "@/components/dashboard/PageShell";
import { loadDemoFarmData } from "@/lib/demoFarmStore";
import type { DemoAnalysis, DemoField } from "@/lib/demoFarmStore";
import { localAgronomyReply, withTimeout } from "@/lib/demoAgronomy";

const HEALTH_ORDER = ["severe_stress", "moderate_stress", "mild_stress", "healthy"] as const;
const healthRank = (s: string) =>
  HEALTH_ORDER.indexOf(s as (typeof HEALTH_ORDER)[number]);

interface AnalysisLite {
  _id: string;
  fieldId: string;
  analyzedAt: number;
  images: string[];
  crop: string;
  growthStage?: string;
  healthStatus: string;
  healthScore?: number;
  observations: string[];
  fertilizerAdvice?: string;
  irrigationAdvice?: string;
  yieldLowQa?: number;
  yieldHighQa?: number;
  confidence?: number;
}

/** BEFORE | AFTER swipe viewer: drag the handle to reveal the after photo. */
function BeforeAfter({ before, after }: { before: string; after: string }) {
  const { t } = useLang();
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const move = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos(Math.min(96, Math.max(4, ((clientX - rect.left) / rect.width) * 100)));
  };

  return (
    <div>
      <div
        ref={ref}
        className="nb-border relative aspect-[4/3] w-full cursor-ew-resize touch-none select-none overflow-hidden bg-[#ede7d8]"
        onPointerDown={(e) => {
          dragging.current = true;
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          move(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && move(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <img src={after} alt="after" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pos}%` }}>
          <img
            src={before}
            alt="before"
            className="absolute inset-0 h-full object-cover"
            style={{ width: `${10000 / pos}%` }}
            draggable={false}
          />
        </div>
        <div className="absolute inset-y-0 w-1 bg-[#141414]" style={{ left: `${pos}%` }} aria-hidden>
          <span className="absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center border-2 border-[#141414] bg-[#ffc53d] text-xs">
            ↔
          </span>
        </div>
        <span className="absolute left-2 top-2 border-2 border-[#141414] bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase">
          {t("beforeLabel")}
        </span>
        <span className="absolute right-2 top-2 border-2 border-[#141414] bg-[#ffc53d] px-1.5 py-0.5 text-[10px] font-bold uppercase">
          {t("afterLabel")}
        </span>
      </div>
      <p className="mt-1 text-center text-[11px] font-semibold text-[#5c574b]">↔ {t("swipeHint")}</p>
    </div>
  );
}

export default function Compare() {
  const { t, lang } = useLang();
  const [params] = useSearchParams();
  const presetA = params.get("a");
  const hasConvexUrl = Boolean(import.meta.env.VITE_CONVEX_URL);
  const [demoData] = useState(loadDemoFarmData);

  const fieldsQuery = useQuery(api.cropData.listFields, hasConvexUrl ? {} : "skip");
  const analysesQuery = useQuery(api.cropData.listAnalyses, hasConvexUrl ? { limit: 200 } : "skip");
  const fields = (fieldsQuery ?? demoData.fields) as DemoField[];
  const analyses = (analysesQuery ?? demoData.analyses) as DemoAnalysis[];
  const onlineReady = hasConvexUrl && fieldsQuery !== undefined && analysesQuery !== undefined;
  const advice = useAction(api.cropPhoto.compareAdvice);

  const [fieldId, setFieldId] = useState(() => hasConvexUrl ? "" : demoData.fields[0]?._id ?? "");
  const [idA, setIdA] = useState(() => hasConvexUrl ? "" : demoData.analyses[1]?._id ?? "");
  const [idB, setIdB] = useState(() => hasConvexUrl ? "" : demoData.analyses[0]?._id ?? "");
  const [adviceText, setAdviceText] = useState("");
  const [adviceEngine, setAdviceEngine] = useState<"llm" | "offline" | null>(null);
  const [adviceBusy, setAdviceBusy] = useState(false);
  const [selectionTouched, setSelectionTouched] = useState(false);

  const presetTarget = presetA ? analyses.find((analysis) => analysis._id === presetA) : undefined;
  const presetSiblings = presetTarget
    ? analyses
      .filter((analysis) => analysis.fieldId === presetTarget.fieldId)
      .sort((a, b) => b.analyzedAt - a.analyzedAt)
    : [];
  const presetIndex = presetTarget
    ? presetSiblings.findIndex((analysis) => analysis._id === presetA)
    : -1;
  const presetOlder = presetIndex >= 0 ? presetSiblings[presetIndex + 1] : undefined;
  const activeFieldId = !selectionTouched && presetTarget
    ? presetTarget.fieldId
    : onlineReady
      ? fieldId
      : fieldId || demoData.fields[0]?._id || "";
  const activeIdA = !selectionTouched && presetTarget
    ? presetOlder?._id ?? ""
    : onlineReady
      ? idA
      : idA || demoData.analyses[1]?._id || "";
  const activeIdB = !selectionTouched && presetTarget
    ? presetTarget._id
    : onlineReady
      ? idB
      : idB || demoData.analyses[0]?._id || "";

  const fieldRows = useMemo(
    () => analyses.filter((a) => !activeFieldId || (a.fieldId as string) === activeFieldId),
    [analyses, activeFieldId],
  );

  const A = fieldRows.find((a) => a._id === activeIdA) ?? null;
  const B = fieldRows.find((a) => a._id === activeIdB) ?? null;
  const olderFirst = A && B ? A.analyzedAt <= B.analyzedAt : true;
  const P = (olderFirst ? A : B) as AnalysisLite | null; // previous
  const C = (olderFirst ? B : A) as AnalysisLite | null; // current

  const trendData = useMemo(() => {
    if (!activeFieldId) return [];
    return fieldRows
      .filter((a) => (a.fieldId as string) === activeFieldId && a.healthScore != null)
      .sort((a, b) => a.analyzedAt - b.analyzedAt)
      .map((a) => ({
        date: new Date(a.analyzedAt).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
        }),
        health: a.healthScore as number,
      }));
  }, [fieldRows, activeFieldId]);

  const runAdvice = async () => {
    if (!P || !C) return;
    setAdviceBusy(true);
    if (!onlineReady) {
      const direction = healthRank(C.healthStatus) > healthRank(P.healthStatus)
        ? (lang === "kn" ? "ಆರೋಗ್ಯ ಸುಧಾರಿಸಿದೆ" : lang === "hi" ? "स्वास्थ्य में सुधार हुआ" : "health improved")
        : healthRank(C.healthStatus) < healthRank(P.healthStatus)
          ? (lang === "kn" ? "ಆರೋಗ್ಯ ಹದಗೆಟ್ಟಿದೆ" : lang === "hi" ? "स्वास्थ्य बिगड़ा है" : "health declined")
          : (lang === "kn" ? "ಆರೋಗ್ಯ ಸ್ಥಿತಿ ಬಹುತೇಕ ಒಂದೇ ಇದೆ" : lang === "hi" ? "स्वास्थ्य स्थिति लगभग समान है" : "health is broadly unchanged");
      setAdviceText(`${direction}: ${t(`health_${P.healthStatus}`)} → ${t(`health_${C.healthStatus}`)}. ${localAgronomyReply("disease", lang, { crop: C.crop })}`);
      setAdviceEngine("offline");
      setAdviceBusy(false);
      return;
    }
    try {
      const res = await withTimeout(advice({
        crop: C.crop,
        prev: {
          date: new Date(P.analyzedAt).toLocaleDateString(),
          healthStatus: P.healthStatus,
          observations: P.observations,
          growthStage: P.growthStage,
          yieldLow: P.yieldLowQa,
          yieldHigh: P.yieldHighQa,
        },
        curr: {
          date: new Date(C.analyzedAt).toLocaleDateString(),
          healthStatus: C.healthStatus,
          observations: C.observations,
          growthStage: C.growthStage,
          yieldLow: C.yieldLowQa,
          yieldHigh: C.yieldHighQa,
        },
        lang,
      }));
      setAdviceText(res.advice || t("aiAdvisoryFallback"));
      setAdviceEngine(res.engine);
    } catch {
      setAdviceText(`${t("aiAdvisoryFallback")} ${localAgronomyReply("disease", lang, { crop: C.crop })}`);
      setAdviceEngine("offline");
      toast.info("Comparison guidance is using the local agronomy fallback.");
    } finally {
      setAdviceBusy(false);
    }
  };

  const row = (label: string, prevVal: string, currVal: string) => (
    <tr key={label} className="border-t border-[#141414]/20">
      <td className="py-1.5 pr-2 font-semibold">{label}</td>
      <td className="py-1.5 pr-2">{prevVal}</td>
      <td className="py-1.5">{currVal}</td>
    </tr>
  );

  return (
    <PageShell title={t("navCompare")} emoji="📊">
      <h1 className="font-display mb-4 text-2xl uppercase">📊 {t("compareTitle")}</h1>

      {/* Selectors */}
      <section className="nb-shadow-sm nb-border bg-white p-4">
        <label className="text-xs font-bold uppercase">{t("scanPickField")}</label>
        <select
          value={activeFieldId}
          onChange={(e) => {
            setSelectionTouched(true);
            setFieldId(e.target.value);
            setIdA("");
            setIdB("");
          }}
          className="nb-border mt-1 w-full bg-[#f5f0e6] px-3 py-2 text-sm font-semibold"
        >
          <option value="">{t("allFields")}</option>
          {fields.map((f) => (
            <option key={f._id} value={f._id}>{f.fieldName}</option>
          ))}
        </select>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-bold uppercase">{t("prevShort")}</label>
            <select
              value={activeIdA}
              onChange={(e) => {
                setSelectionTouched(true);
                setIdA(e.target.value);
              }}
              className="nb-border mt-1 w-full bg-[#f5f0e6] px-3 py-2 text-sm font-semibold"
            >
              <option value="">{t("pickAnalysis")}</option>
              {fieldRows.map((a) => (
                <option key={a._id} value={a._id}>
                  {new Date(a.analyzedAt).toLocaleDateString()} · {t(`health_${a.healthStatus}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase">{t("currShort")}</label>
            <select
              value={activeIdB}
              onChange={(e) => {
                setSelectionTouched(true);
                setIdB(e.target.value);
              }}
              className="nb-border mt-1 w-full bg-[#f5f0e6] px-3 py-2 text-sm font-semibold"
            >
              <option value="">{t("pickAnalysis")}</option>
              {fieldRows.map((a) => (
                <option key={a._id} value={a._id}>
                  {new Date(a.analyzedAt).toLocaleDateString()} · {t(`health_${a.healthStatus}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={fieldRows.length < 2}
            onClick={() => {
              setSelectionTouched(true);
              const s = [...fieldRows].sort((a, b) => b.analyzedAt - a.analyzedAt);
              setIdB(s[0]?._id ?? "");
              setIdA(s[1]?._id ?? "");
            }}
            className="nb-border nb-press bg-[#f5f0e6] px-3 py-1.5 text-xs font-bold uppercase disabled:opacity-50"
          >
            {t("cmpLatestTwo")}
          </button>
          <button
            type="button"
            disabled={fieldRows.length < 2}
            onClick={() => {
              setSelectionTouched(true);
              const s = [...fieldRows].sort((a, b) => a.analyzedAt - b.analyzedAt);
              setIdA(s[0]?._id ?? "");
              setIdB(s[s.length - 1]?._id ?? "");
            }}
            className="nb-border nb-press bg-[#f5f0e6] px-3 py-1.5 text-xs font-bold uppercase disabled:opacity-50"
          >
            {t("cmpFirstLast")}
          </button>
        </div>
      </section>

      {/* Comparison */}
      {P && C ? (
        <section className="nb-shadow-sm nb-border mt-4 bg-white p-4">
          {P.images[0] && C.images[0] && (
            <BeforeAfter before={P.images[0]} after={C.images[0]} />
          )}

          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase">
                <th className="py-1">{t("parameter")}</th>
                <th className="py-1">{new Date(P.analyzedAt).toLocaleDateString()}</th>
                <th className="py-1">{new Date(C.analyzedAt).toLocaleDateString()}</th>
              </tr>
            </thead>
            <tbody>
              {row(t("healthLabel"), t(`health_${P.healthStatus}`), t(`health_${C.healthStatus}`))}
              {row(t("stageLabel"), P.growthStage ?? "—", C.growthStage ?? "—")}
              {P.yieldLowQa != null || C.yieldLowQa != null
                ? row(
                    t("yieldEstLabel"),
                    P.yieldLowQa != null ? `${P.yieldLowQa}–${P.yieldHighQa} ${t("qPerAcre")}` : "—",
                    C.yieldLowQa != null ? `${C.yieldLowQa}–${C.yieldHighQa} ${t("qPerAcre")}` : "—",
                  )
                : null}
              {P.healthScore != null || C.healthScore != null
                ? row(t("scanScore"), P.healthScore != null ? `${P.healthScore}/100` : "—", C.healthScore != null ? `${C.healthScore}/100` : "—")
                : null}
            </tbody>
          </table>

          {/* What improved / what changed — only from recorded observations */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="nb-border bg-[#e9f7d8] p-3">
              <p className="text-xs font-bold uppercase">📈 {t("cmpImproved")}</p>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {(C.observations.filter((o) => !P.observations.includes(o)).length
                  ? []
                  : [t("cmpNoChange")]
                ).map((x) => <li key={x}>{x}</li>)}
                {C.observations
                  .filter((o) => !P.observations.includes(o))
                  .map((o) => <li key={o}>{o}</li>)}
              </ul>
            </div>
            <div className="nb-border bg-[#fff3c4] p-3">
              <p className="text-xs font-bold uppercase">⚠️ {t("cmpChanged")}</p>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {(P.observations.filter((o) => !C.observations.includes(o)).length
                  ? []
                  : [t("cmpNoChange")]
                ).map((x) => <li key={x}>{x}</li>)}
                {P.observations
                  .filter((o) => !C.observations.includes(o))
                  .map((o) => <li key={o}>{o}</li>)}
              </ul>
            </div>
          </div>

          {P.yieldLowQa != null && C.yieldLowQa != null && (
            <div className="nb-border mt-3 bg-[#ede7d8] p-3 text-sm">
              <p className="text-xs font-bold uppercase">📉 {t("cmpYieldChange")}</p>
              <p className="mt-1">
                {t("prevShort")}: {P.yieldLowQa}–{P.yieldHighQa} {t("qPerAcre")} · {t("currShort")}:{" "}
                {C.yieldLowQa}–{C.yieldHighQa} {t("qPerAcre")}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#5c574b]">{t("cmpYieldCaution")}</p>
            </div>
          )}

          {/* Health trend chart */}
          <div className="mt-4">
            <p className="text-xs font-bold uppercase">📊 {t("trendTitle")}</p>
            {trendData.length >= 2 ? (
              <div className="nb-border mt-2 bg-white p-2" style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#14141422" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="health" stroke="#2f9e44" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-2 text-xs font-semibold text-[#5c574b]">{t("trendNeedMore")}</p>
            )}
          </div>

          {/* AI next steps */}
          <button
            type="button"
            onClick={runAdvice}
            disabled={adviceBusy}
            className="nb-press nb-border mt-4 w-full bg-[#ffc53d] px-4 py-3 font-display text-base uppercase disabled:opacity-50"
          >
            {adviceBusy ? `⏳…` : `🤖 ${t("cmpWhatNow")}`}
          </button>
          {adviceText && (
            <div className="nb-border mt-3 bg-white p-3 text-sm">
              <p className="whitespace-pre-line">{adviceText}</p>
              <p className="mt-2 text-[11px] font-semibold text-[#5c574b]">
                {adviceEngine === "offline" ? `⚙️ ${t("aiAdvisoryOffline")}` : `🤖 ${t("aiAdvisoryLabel")}`}
              </p>
            </div>
          )}
          <p className="mt-2 text-[11px] font-semibold text-[#5c574b]">⚠️ {t("scanDisclaimer")}</p>
        </section>
      ) : (
        (idA || idB) && (
          <p className="nb-border mt-4 bg-white p-4 text-sm font-semibold">{t("cmpPickTwo")}</p>
        )
      )}
    </PageShell>
  );
}
