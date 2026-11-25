import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/context/LanguageContext";
import { PageShell } from "@/components/dashboard/PageShell";
import { compressImage } from "@/lib/imageCompress";
import { speak } from "@/lib/voice";
import type { Lang } from "@/lib/i18n";
import { cropName } from "@/lib/i18n";
import { loadDemoFarmData } from "@/lib/demoFarmStore";
import {
  createOfflineLeafDiagnosis,
  localAgronomyReply,
  withTimeout,
} from "@/lib/demoAgronomy";

/* ------------------------------------------------------------------ */
/* Emergency categories                                                */
/* ------------------------------------------------------------------ */

const CATEGORIES = [
  { id: "pest", emoji: "🐛", key: "fhPest" },
  { id: "flood", emoji: "🌧️", key: "fhFlood" },
  { id: "damage", emoji: "🔥", key: "fhDamage" },
  { id: "water", emoji: "💧", key: "fhWater" },
  { id: "disease", emoji: "🌱", key: "fhDisease" },
  { id: "growth", emoji: "🌾", key: "fhGrowth" },
  { id: "assist", emoji: "📞", key: "fhAssist" },
] as const;

type CatId = (typeof CATEGORIES)[number]["id"];

/** Guided follow-up questions per category (localizable keys). */
const QUESTIONS: Record<Exclude<CatId, "assist">, string[]> = {
  pest: ["fhQPest1", "fhQPest2", "fhQPest3", "fhQPest4"],
  flood: ["fhQFlood1", "fhQFlood2", "fhQFlood3"],
  damage: ["fhQDamage1", "fhQDamage2"],
  water: ["fhQWater1", "fhQWater2", "fhQWater3"],
  disease: ["fhQ1", "fhQ2", "fhQ3", "fhQ4", "fhQ5", "fhQ6", "fhQ7"],
  growth: ["fhQGrowth1", "fhQGrowth2", "fhQGrowth3"],
};

interface PossibleCause {
  titleKey: string;
  bodyKey: string;
}

/** Qualitative possible causes — always hedged, never a diagnosis. */
const CAUSES: Record<Exclude<CatId, "assist">, PossibleCause[]> = {
  pest: [
    { titleKey: "fhCPest1t", bodyKey: "fhCPest1b" },
    { titleKey: "fhCPest2t", bodyKey: "fhCPest2b" },
    { titleKey: "fhCPest3t", bodyKey: "fhCPest3b" },
  ],
  flood: [
    { titleKey: "fhCFlood1t", bodyKey: "fhCFlood1b" },
    { titleKey: "fhCFlood2t", bodyKey: "fhCFlood2b" },
  ],
  damage: [
    { titleKey: "fhCDamage1t", bodyKey: "fhCDamage1b" },
    { titleKey: "fhCDamage2t", bodyKey: "fhCDamage2b" },
  ],
  water: [
    { titleKey: "fhCWater1t", bodyKey: "fhCWater1b" },
    { titleKey: "fhCWater2t", bodyKey: "fhCWater2b" },
  ],
  disease: [
    { titleKey: "fhCD1t", bodyKey: "fhCD1b" },
    { titleKey: "fhCD2t", bodyKey: "fhCD2b" },
    { titleKey: "fhCD3t", bodyKey: "fhCD3b" },
  ],
  growth: [
    { titleKey: "fhCG1t", bodyKey: "fhCG1b" },
    { titleKey: "fhCG2t", bodyKey: "fhCG2b" },
  ],
};

/** Verified national helplines — real published numbers only. */
const HELPLINES = [
  { name: "Kisan Call Centre (DIC)", phone: "18001801551", hours: "06:00–22:00" },
  { name: "Karnataka Kisan Call Centre", phone: "18004251660", hours: "06:00–22:00" },
];

export default function FarmerHelp() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const hasConvexUrl = Boolean(import.meta.env.VITE_CONVEX_URL);
  const [demoData] = useState(loadDemoFarmData);
  const askAssistant = useAction(api.assistant.askAssistant);
  const analyzePhoto = useAction(api.cropPhoto.analyzeCropPhoto);
  const saveAnalysis = useMutation(api.cropData.saveAnalysis);
  const fieldsQuery = useQuery(api.cropData.listFields, hasConvexUrl ? {} : "skip");
  const fields = fieldsQuery ?? demoData.fields;
  const onlineReady = hasConvexUrl && fieldsQuery !== undefined;

  const [cat, setCat] = useState<CatId | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoResult, setPhotoResult] = useState<{
    observations: string[];
    steps: string[];
    engine: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const askAi = useCallback(async (submittedText?: string) => {
    const text = (submittedText ?? desc).trim();
    if (!text || busy) return;
    setBusy(true);
    setAiReply(null);
    const month = new Date().getMonth();
    const season = month >= 5 && month <= 9
      ? "Rainy Season"
      : month >= 10 || month <= 1
        ? "Winter Season"
        : "Summer Season";
    const localReply = () => localAgronomyReply(text, lang as Lang, {
      crop: fields[0]?.crop ? cropName(fields[0].crop, lang) : undefined,
      season,
    });
    if (!onlineReady) {
      setAiReply(localReply());
      setBusy(false);
      return;
    }
    try {
      const ctx = {
        location: fields[0]?.village ?? null,
        temperature: null,
        humidity: null,
        topCrop: fields[0]?.crop ? cropName(fields[0].crop, lang) : null,
        topAlt1: null,
        topAlt2: null,
        topConfidence: null,
      };
      const res = await withTimeout(askAssistant({
        message: text,
        lang: lang as Lang,
        history: [],
        context: ctx,
      }));
      setAiReply(res.reply);
    } catch {
      setAiReply(localReply());
    } finally {
      setBusy(false);
    }
  }, [askAssistant, busy, desc, fields, lang, onlineReady]);

  const voice = useSpeechInput((text) => {
    setDesc(text);
    void askAi(text);
  });

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setPhoto(dataUrl);
      setBusy(true);
      setPhotoResult(null);
      const crop = fields[0]?.crop ?? "maize";
      const local = createOfflineLeafDiagnosis(crop, lang as Lang);
      const localResult = {
        observations: local.observations,
        steps: [local.fertilizerAdvice, local.irrigationAdvice].filter((step): step is string => Boolean(step)),
        engine: "offline",
      };
      if (!onlineReady) {
        setPhotoResult(localResult);
        return;
      }

      try {
        const res = await withTimeout(analyzePhoto({
          fileDataUrl: dataUrl,
          crop,
          lang: lang as Lang,
          notes: `${t("fhViaHelp")}: ${desc || "—"}`,
        }));
        if (!res.ok) throw new Error("Cloud photo analysis did not return a result.");
        setPhotoResult({
          observations: res.data.observations,
          steps: res.data.fertilizerAdvice
            ? [res.data.fertilizerAdvice, res.data.irrigationAdvice ?? ""].filter(Boolean)
            : ["fhNextInspect", "fhNextMoisture", "fhNextExpert"],
          engine: res.data.engine,
        });
        if (fields[0]) {
          try {
            await withTimeout(saveAnalysis({
              fieldId: fields[0]._id as Id<"fields">,
              images: [dataUrl],
              crop: res.data.crop,
              growthStage: res.data.growthStage ?? undefined,
              healthStatus: res.data.healthStatus,
              healthScore: res.data.healthScore ?? undefined,
              observations: res.data.observations,
              fertilizerAdvice: res.data.fertilizerAdvice ?? undefined,
              irrigationAdvice: res.data.irrigationAdvice ?? undefined,
              yieldLowQa: res.data.yieldBand?.low ?? undefined,
              yieldHighQa: res.data.yieldBand?.high ?? undefined,
              confidence: res.data.confidence ?? undefined,
              aiResponse: res.data.fullText,
              engine: res.data.engine,
            }));
          } catch {
            toast.info("Photo guidance is ready, but could not be saved to cloud history.");
          }
        }
      } catch {
        setPhotoResult(localResult);
        toast.info("Cloud photo analysis is unavailable; showing a cautious local checklist.");
      }
    } catch {
      toast.error(t("scanBadImage"));
    } finally {
      setBusy(false);
    }
  };

  const questions = cat && cat !== "assist" ? QUESTIONS[cat] : null;
  const causes = cat && cat !== "assist" ? CAUSES[cat] : null;

  const reset = () => {
    setCat(null);
    setStep(0);
    setAnswers({});
    setDesc("");
    setAiReply(null);
    setPhoto(null);
    setPhotoResult(null);
  };

  return (
    <PageShell title={t("fhTitle")} emoji="🆘">
      <h1 className="font-display mb-1 text-2xl uppercase">🆘 {t("fhTitle")}</h1>
      <p className="mb-4 text-xs font-semibold text-[#5c574b]">{t("fhSub")}</p>

      {/* Category grid */}
      {!cat && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCat(c.id)}
              className="nb-press nb-shadow-sm nb-border flex flex-col items-center gap-1 bg-white px-3 py-4"
            >
              <span className="text-3xl">{c.emoji}</span>
              <span className="text-xs font-bold uppercase">{t(c.key)}</span>
            </button>
          ))}
        </div>
      )}

      {cat && cat !== "assist" && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={reset}
            className="nb-press nb-border bg-white px-3 py-1.5 text-[11px] font-bold uppercase"
          >
            ← {t("fhBack")}
          </button>

          {/* Photo + description capture */}
          <section className="nb-border nb-shadow-sm bg-white p-4">
            <p className="font-display mb-2 text-sm uppercase">{t("fhWhatProblem")}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => camRef.current?.click()}
                className="nb-press nb-border bg-[#ffc53d] px-3 py-2 text-xs font-bold uppercase"
              >
                📸 {t("fhTakePhoto")}
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="nb-press nb-border bg-white px-3 py-2 text-xs font-bold uppercase"
              >
                📁 {t("fhUploadPhoto")}
              </button>
              <button
                type="button"
                onClick={voice.toggle}
                disabled={!voice.supported}
                className={`nb-press nb-border px-3 py-2 text-xs font-bold uppercase ${
                  voice.listening ? "bg-[#d64545] text-white" : "bg-[#ede7d8]"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                🎙️ {voice.listening ? t("fhListening") : t("fhSpeak")}
              </button>
            </div>
            {!voice.supported && (
              <p className="mt-1 text-[11px] font-semibold text-[#5c574b]">
                Voice input is not supported in this browser. You can type your question instead.
              </p>
            )}
            {voice.error && (
              <p className="mt-1 text-[11px] font-semibold text-[#8a5a00]">
                Microphone access was unavailable. Check browser permissions or type your question.
              </p>
            )}
            <input
              ref={camRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhoto}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhoto}
            />
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={t("fhDescribe")}
              rows={2}
              className="nb-border mt-3 w-full bg-[#f5f0e6] px-3 py-2 text-sm font-semibold outline-none"
            />
            <button
              type="button"
              onClick={() => void askAi()}
              disabled={busy || !desc.trim()}
              className="nb-press nb-border mt-2 bg-[#2fa35c] px-4 py-2 text-xs font-bold uppercase text-white disabled:opacity-50"
            >
              {busy ? "⏳" : "🤖"} {t("fhAnalyze")}
            </button>
          </section>

          {photo && (
            <section className="nb-border nb-shadow-sm bg-white p-4">
              <p className="font-display mb-2 text-sm uppercase">📷 {t("fhPhoto")}</p>
              <img src={photo} alt="crop" className="nb-border max-h-56 w-full object-cover" />
              {photoResult && (
                <>
                  <p className="mt-3 text-xs font-bold uppercase">{t("fhObserved")}:</p>
                  <ul className="mt-1 list-disc pl-5 text-xs font-semibold">
                    {photoResult.observations.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs font-bold uppercase">{t("fhNextSteps")}:</p>
                  <ul className="mt-1 list-disc pl-5 text-xs font-semibold">
                    {photoResult.steps.map((s) => (
                      <li key={s}>{s.startsWith("fh") ? t(s) : s}</li>
                    ))}
                  </ul>
                  <p className="nb-border mt-3 bg-[#ffc53d] px-3 py-2 text-[11px] font-bold">
                    ⚠️ {t("fhAiNote")}
                  </p>
                </>
              )}
            </section>
          )}

          {/* Guided follow-up questions */}
          {questions && step < questions.length && (
            <section className="nb-border nb-shadow-sm bg-white p-4">
              <p className="text-[11px] font-bold uppercase text-[#5c574b]">
                {t("fhQuestionOf", { n: step + 1, total: questions.length })}
              </p>
              <p className="font-display mt-1 text-sm">{t(questions[step]!)}</p>
              <input
                value={answers[questions[step]!] ?? ""}
                onChange={(e) =>
                  setAnswers((a) => ({ ...a, [questions[step]!]: e.target.value }))
                }
                onKeyDown={(e) => e.key === "Enter" && setStep((s) => s + 1)}
                className="nb-border mt-2 w-full bg-[#f5f0e6] px-3 py-2 text-sm font-semibold outline-none"
              />
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="nb-press nb-border mt-2 bg-[#ede7d8] px-4 py-2 text-xs font-bold uppercase"
              >
                ➜ {t("fhNext")}
              </button>
            </section>
          )}

          {/* Possible causes — hedged, needs verification */}
          {causes && step >= questions!.length && (
            <section className="nb-border nb-shadow-sm bg-white p-4">
              <p className="font-display mb-2 text-sm uppercase">🔍 {t("fhCauses")}</p>
              <div className="space-y-2">
                {causes.map((c, i) => (
                  <div key={c.titleKey} className="nb-border bg-[#f5f0e6] p-3">
                    <p className="text-xs font-black uppercase">
                      {t("fhPossible")} {i + 1}: {t(c.titleKey)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#5c574b]">{t(c.bodyKey)}</p>
                  </div>
                ))}
              </div>
              <p className="nb-border mt-3 bg-[#ffc53d] px-3 py-2 text-[11px] font-bold">
                ⚠️ {t("fhVerify")}
              </p>
            </section>
          )}

          {aiReply && (
            <section className="nb-border nb-shadow-sm bg-[#ede7d8] p-4">
              <p className="font-display mb-1 text-sm uppercase">🤖 {t("fhAiGuidance")}</p>
              <p className="whitespace-pre-wrap text-sm">{aiReply}</p>
              <button
                type="button"
                onClick={() => speak(aiReply, lang)}
                className="nb-press nb-border mt-3 bg-white px-3 py-1.5 text-[11px] font-bold uppercase"
              >
                🔊 {t("fhPlayResponse")}
              </button>
            </section>
          )}
        </div>
      )}

      {/* Agriculture assistance — verified resources */}
      {cat === "assist" && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={reset}
            className="nb-press nb-border bg-white px-3 py-1.5 text-[11px] font-bold uppercase"
          >
            ← {t("fhBack")}
          </button>
          <section className="nb-border nb-shadow-sm bg-white p-4">
            <p className="font-display mb-2 text-sm uppercase">📞 {t("fhGetAssist")}</p>
            <div className="space-y-2">
              {HELPLINES.map((h) => (
                <div key={h.phone} className="nb-border bg-[#f5f0e6] p-3">
                  <p className="text-sm font-bold">{h.name}</p>
                  <p className="text-xs font-semibold text-[#5c574b]">
                    🕒 {h.hours} · {t("fhTollfree")}
                  </p>
                  <a
                    href={`tel:${h.phone}`}
                    className="nb-press nb-border mt-2 inline-block bg-[#2fa35c] px-3 py-1.5 text-xs font-bold uppercase text-white"
                  >
                    📞 {h.phone}
                  </a>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => navigate("/nearby")}
              className="nb-press nb-border mt-3 bg-[#5fa8e8] px-4 py-2 text-xs font-bold uppercase text-white"
            >
              📍 {t("fhFindNearby")}
            </button>
            <p className="mt-3 text-[11px] font-semibold text-[#5c574b]">{t("fhHelplineNote")}</p>
          </section>
        </div>
      )}
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* Minimal speech input hook (reuse of Web Speech pattern)             */
/* ------------------------------------------------------------------ */

import { SPEECH_LOCALES } from "@/lib/voice";

function useSpeechInput(onFinal: (text: string) => void) {
  const recRef = useRef<unknown>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(false);
  const { lang } = useLang();

  const toggle = useCallback(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => unknown;
      webkitSpeechRecognition?: new () => unknown;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      setError(true);
      return;
    }
    if (listening) {
      try {
        (recRef.current as { stop: () => void } | null)?.stop();
        setListening(false);
      } catch {
        setError(true);
        setListening(false);
      }
      return;
    }
    const rec = new SR() as {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: ((e: { results: { 0: { transcript: string } } }) => void) | null;
      onend: (() => void) | null;
      onerror: (() => void) | null;
      start: () => void;
    };
    rec.lang = SPEECH_LOCALES[lang];
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = e.results[0].transcript;
      setListening(false);
      onFinal(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      setError(true);
    };
    recRef.current = rec;
    setError(false);
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
      setError(true);
    }
  }, [listening, lang, onFinal]);

  useEffect(() => () => {
    (recRef.current as { stop: () => void } | null)?.stop();
  }, []);

  const browser = typeof window === "undefined"
    ? null
    : window as unknown as {
        SpeechRecognition?: unknown;
        webkitSpeechRecognition?: unknown;
      };
  return {
    listening,
    toggle,
    supported: Boolean(browser?.SpeechRecognition ?? browser?.webkitSpeechRecognition),
    error,
  };
}
