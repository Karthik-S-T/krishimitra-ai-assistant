import { useState } from "react";
import { useLang } from "@/context/LanguageContext";

const FLOW = [
  { k: "hiw1", icon: "📥" },
  { k: "hiw2", icon: "⚙️" },
  { k: "hiw3", icon: "🤖" },
  { k: "hiw4", icon: "🏆" },
  { k: "hiw5", icon: "🧠" },
  { k: "hiw6", icon: "👨‍🌾" },
] as const;

const TECH = [
  { label: "demoTechFrontend", val: "demoTechFrontendVal", icon: "⚛️" },
  { label: "demoTechMaps", val: "demoTechMapsVal", icon: "🗺️" },
  { label: "demoTechAi", val: "demoTechAiVal", icon: "🤖" },
  { label: "demoTechWeather", val: "demoTechWeatherVal", icon: "🌦️" },
  { label: "demoTechMarket", val: "demoTechMarketVal", icon: "💰" },
  { label: "demoTechDb", val: "demoTechDbVal", icon: "🗄️" },
  { label: "demoTechVoice", val: "demoTechVoiceVal", icon: "🎙️" },
] as const;

/** 🎓 PROJECT DEMO — collapsible architecture panel for guides/examiners. */
export function ProjectDemoPanel({ compact = false }: { compact?: boolean }) {
  const { t } = useLang();
  const [open, setOpen] = useState(!compact);

  return (
    <section className="nb-shadow-lg border-2 border-[#141414] bg-[#0d2b1a] p-5 text-white sm:p-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3"
      >
        <div className="text-left">
          <p className="font-display text-lg uppercase text-[#ffc53d]">
            🎓 {t("demoPanelTitle")}
          </p>
          <p className="mt-0.5 text-xs font-medium text-white/70">
            {t("demoPanelSub")}
          </p>
        </div>
        <span className="nb-border bg-white/10 px-2.5 py-1 text-[11px] font-bold uppercase">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <>
          {/* data flow */}
          <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {FLOW.map((f, i) => (
              <div
                key={f.k}
                className="rounded-lg border border-white/20 bg-white/10 p-3 text-center"
              >
                <p className="text-lg">{f.icon}</p>
                <p className="mt-1 text-[10px] font-black uppercase text-[#8ef0b6]">
                  {i + 1}
                </p>
                <p className="text-[11px] font-bold leading-tight">{t(f.k)}</p>
                <p className="mt-1 text-[10px] font-medium leading-snug text-white/60">
                  {t(`${f.k}b`)}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-lg border border-[#ffc53d]/40 bg-[#ffc53d]/10 px-3 py-2 text-center text-[11px] font-bold text-[#ffc53d]">
            {t("hiwFlow")}
          </p>

          {/* tech stack */}
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {TECH.map((x) => (
              <div
                key={x.label}
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-2.5"
              >
                <p className="text-[10px] font-black uppercase tracking-wide text-white/60">
                  {x.icon} {t(x.label)}
                </p>
                <p className="mt-0.5 text-xs font-bold leading-snug">{t(x.val)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
