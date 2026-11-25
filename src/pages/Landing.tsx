import { motion } from "framer-motion";
import {
  ArrowRight,
  Bird,
  Bot,
  CloudSunRain,
  FlaskConical,
  IndianRupee,
  MapPin,
  MapPinned,
  Mic,
  Play,
  Sprout,
  Trees,
  Wheat,
} from "lucide-react";
import { Link } from "react-router";
import { AnimatedFarmerWalkthrough } from "@/components/AnimatedFarmerWalkthrough";
import { IconBadge } from "@/components/IconBadge";
import { LangSwitcher } from "@/components/LangSwitcher";
import { useLang } from "@/context/LanguageContext";
import { ProjectDemoPanel } from "@/components/ProjectDemoPanel";
import type { Lang } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { isDemoAuthEnabled } from "@/lib/demoAuth";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.45 },
} as const;

const HOW_STEPS = ["how1", "how2", "how3", "how4", "how5"] as const;
const HOW_ICONS = [MapPin, CloudSunRain, Sprout, Bot, Wheat] as const;

const FEATURES = [
  { icon: Sprout, title: "f1Title", desc: "f1Desc", chip: "statusLive", tone: "emerald" },
  { icon: FlaskConical, title: "f2Title", desc: "f2Desc", chip: "statusLive", tone: "gold" },
  { icon: CloudSunRain, title: "f3Title", desc: "f3Desc", chip: "statusLive", tone: "mint" },
  { icon: IndianRupee, title: "f4Title", desc: "f4Desc", chip: "statusLive", tone: "amber" },
] as const;

/** Cinematic-intro CTA label per locale. Kept here next to its use because the
 *  Kannada/Hindi blocks in i18n.ts resist inline edits (script punctuation),
 *  and translate() falls back gracefully anyway. */
const ENTRY_LABEL: Record<Lang, string> = {
  en: "Watch the farm intro",
  kn: "ಹೊಲದ ಪರಿಚಯ ನೋಡಿ",
  hi: "फार्म का परिचय देखें",
};

export default function Landing() {
  const { t, lang } = useLang();
  const demoMode = isDemoAuthEnabled();
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="nb-dots min-h-screen bg-[#E9F2EC] text-[#102318]">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between border-b border-[#1B4332]/10 bg-[#F6FBF8]/85 px-4 py-5">
        <div className="flex items-center gap-3">
          <IconBadge icon={Sprout} tone="gold" size="md" />
          <div className="leading-tight">
            <p className="font-display text-lg uppercase">KrishiMitra AI</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#496352]">
              Kannada · English · Hindi
            </p>
          </div>
        </div>
        <nav className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
          <a
            href="#farmer-walkthrough"
            className="rounded-full px-3 py-2 text-xs font-bold text-[#1B4332] transition-colors hover:bg-[#DDEBE1]"
          >
            Animated guide
          </a>
          <Link
            to={isAuthenticated ? "/dashboard" : "/auth"}
            className="rounded-full border border-[#1B4332]/20 bg-[#F6FBF8] px-3 py-2 text-xs font-bold text-[#1B4332] transition-colors hover:bg-[#DDEBE1]"
          >
            {isAuthenticated ? (user?.name || "Open dashboard") : "Sign in"}
          </Link>
          <LangSwitcher />
        </nav>
      </header>

      {/* Agriculture hero — layered sunrise landscape (pure CSS, lightweight) */}
      <section className="relative overflow-hidden border-y border-[#1B4332]">
        {/* sky: sunrise gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F2E1D] via-[#1B4332] to-[#9BBE9F]" />
        {/* sun glow */}
        <motion.div
          aria-hidden
          animate={{ scale: [1, 1.06, 1], opacity: [0.75, 0.95, 0.75] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-[12%] top-[8%] h-36 w-36 rounded-full bg-[radial-gradient(circle,#fff3d6_0%,#ffd98f_45%,transparent_70%)]"
        />
        {/* clouds */}
        {["8%", "58%", "78%"].map((left, i) => (
          <motion.div
            key={left}
            aria-hidden
            className="absolute h-10 w-40 rounded-full bg-white/70 blur-md"
            style={{ left, top: `${10 + i * 9}%` }}
            animate={{ x: [0, 90, 0] }}
            transition={{ duration: 46 + i * 18, repeat: Infinity, ease: "linear" }}
          />
        ))}
        {/* distant hills */}
        <div
          aria-hidden
          className="absolute bottom-[30%] left-0 right-0 h-24 bg-[#315B41]"
          style={{ borderRadius: "100% 100% 0 0 / 100% 100% 0 0", opacity: 0.85 }}
        />
        {/* tree line */}
        <div aria-hidden className="absolute bottom-[26%] left-0 right-0 flex justify-around opacity-90">
          {[0, 1, 2, 3, 4, 5].map((tree) => (
            <Trees key={tree} className="size-8 text-[#1B4332] sm:size-10" />
          ))}
        </div>
        {/* crop field with swaying crops */}
        <div aria-hidden className="absolute bottom-0 left-0 right-0 h-[26%] bg-gradient-to-b from-[#4D8B63] to-[#1B4332]" />
        <div aria-hidden className="absolute bottom-[4%] left-0 right-0 flex justify-around">
          {Array.from({ length: 14 }).map((_, i) => (
            <motion.div
              key={i}
              animate={{ rotate: [-4, 4, -4] }}
              transition={{ duration: 2.6 + (i % 5) * 0.4, repeat: Infinity, ease: "easeInOut" }}
              style={{ originX: 0.5, originY: 1 }}
            >
              {i % 2 === 0 ? (
                <Wheat className="size-7 text-[#EAB308] sm:size-9" />
              ) : (
                <Sprout className="size-7 text-[#DDEBE1] sm:size-9" />
              )}
            </motion.div>
          ))}
        </div>
        {/* farmer */}
        <motion.div
          aria-hidden
          className="absolute bottom-[6%] right-[10%] rounded-full border border-white/40 bg-[#1B4332]/50 p-3 text-white"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <Sprout className="size-10 sm:size-12" />
        </motion.div>
        {/* birds */}
        {["12%", "22%", "18%"].map((top, i) => (
          <motion.div
            key={top}
            aria-hidden
            className="absolute text-white/85"
            style={{ top }}
            animate={{ x: [-40, typeof window !== "undefined" ? window.innerWidth : 1200] }}
            transition={{ duration: 26 + i * 9, repeat: Infinity, ease: "linear", delay: i * 5 }}
          >
            <Bird className="size-5" />
          </motion.div>
        ))}

        {/* readability overlay + content */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F2E1D]/55 via-transparent to-[#0F2E1D]/75" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 text-center text-white sm:py-28">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="font-display text-4xl uppercase leading-tight drop-shadow-lg sm:text-6xl"
          >
            KrishiMitra AI
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="font-display mt-3 text-lg text-[#FDE68A] sm:text-2xl"
          >
            {t("heroLandscapeTitle")}
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.16 }}
            className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-relaxed text-white/90 sm:text-base"
          >
            {t("heroLandscapeSub")}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.22 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              to="/dashboard"
              className="nb-press bg-[#1B4332] px-6 py-3.5 font-display text-base uppercase text-white"
            >
              {demoMode ? "Try Demo" : t("heroCtaStart")}{" "}
              <ArrowRight className="ml-1 inline h-5 w-5" strokeWidth={3} />
            </Link>
            <Link
              to="/dashboard"
              className="nb-press bg-[#EAB308] px-6 py-3.5 font-display text-base uppercase text-[#102318]"
            >
              <Mic className="mr-2 inline size-5" /> {t("heroCtaAsk")}
            </Link>
            <Link
              to="/farm"
              className="nb-press bg-[#F6FBF8] px-6 py-3.5 font-display text-base uppercase text-[#1B4332]"
            >
              <MapPinned className="mr-2 inline size-5" /> {t("heroCtaFarm")}
            </Link>
            <Link
              to="/entry"
              className="nb-press bg-[#0F2E1D] px-6 py-3.5 font-display text-base uppercase text-white"
            >
              <Play className="mr-2 inline h-5 w-5" strokeWidth={3} />
              {ENTRY_LABEL[lang]}
            </Link>
          </motion.div>

          {/* stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {[
              { icon: Sprout, tone: "emerald" as const, key: "statCrops" },
              { icon: CloudSunRain, tone: "sky" as const, key: "statWeather" },
              { icon: IndianRupee, tone: "gold" as const, key: "statMarket" },
              { icon: FlaskConical, tone: "mint" as const, key: "statSoil" },
            ].map((s) => (
              <div
                key={s.key}
                className="flex items-center gap-2 rounded-xl border border-white/25 bg-[#0F2E1D]/45 px-3 py-3 text-left backdrop-blur-md"
              >
                <IconBadge icon={s.icon} tone={s.tone} size="sm" />
                <p className="text-[11px] font-bold leading-tight">{t(s.key)}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <AnimatedFarmerWalkthrough />

      {/* How it works */}
      <motion.section {...fadeUp} className="mx-auto max-w-6xl px-4 py-9">
        <h2 className="font-display mb-6 text-center text-2xl uppercase">
          {t("howTitle")}
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {HOW_STEPS.map((key, i) => (
            <div key={key} className="nb-card relative p-5">
              <span className="nb-shadow-sm absolute -left-2 -top-2 grid h-7 w-7 place-items-center rounded-full border border-[#1B4332] bg-[#1B4332] text-xs font-bold text-white">
                {i + 1}
              </span>
              <IconBadge icon={HOW_ICONS[i]} tone="emerald" size="sm" className="mb-3" />
              <p className="text-sm font-bold leading-snug">{t(key)}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Features */}
      <motion.section {...fadeUp} className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="font-display text-center text-2xl uppercase sm:text-3xl">
          {t("featuresTitle")}
        </h2>
        <p className="mt-2 text-center text-sm font-medium text-[#496352]">
          {t("featuresSub")}
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="nb-card flex flex-col p-5">
              <IconBadge icon={f.icon} tone={f.tone} size="lg" className="mb-4" />
              <h3 className="font-display text-base uppercase leading-snug">
                {t(f.title)}
              </h3>
              <p className="mt-2 flex-1 text-sm font-medium leading-relaxed text-[#355443]">
                {t(f.desc)}
              </p>
              <span className="nb-chip mt-4 self-start bg-[#DDF1E4] text-[#1B4332]">
                {t(f.chip)}
              </span>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Model evidence strip */}
      <motion.section {...fadeUp} className="mx-auto max-w-6xl px-4 py-8">
        <div className="nb-shadow-lg flex flex-col items-center gap-2 rounded-2xl border border-[#0F2E1D] bg-[#0F2E1D] px-6 py-6 text-center">
          <span className="nb-chip bg-[#EAB308] text-[#102318]">
            Phase 1 · {t("statusLive")}
          </span>
          <p className="font-display text-lg text-[#FDE68A] sm:text-xl">
            {t("modelChip", { acc: "99.5" })}
          </p>
          <p className="text-xs font-medium text-white/70">
            Gaussian Naive Bayes vs kNN vs centroid · 5-fold cross-validation ·
            2,200 records
          </p>
        </div>
      </motion.section>

      {/* Examiner-facing technical demo (architecture + data flow) */}
      <motion.section {...fadeUp} className="mx-auto max-w-6xl px-4 py-8">
        <ProjectDemoPanel compact />
      </motion.section>

      {/* Footer */}
      <footer className="border-t border-[#1B4332]/20 bg-[#DDEBE1]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs font-semibold text-[#496352] sm:flex-row">
          <span>{t("appName")} · {t("tagline")}</span>
          <span>{t("footerNote")}</span>
        </div>
      </footer>
    </div>
  );
}
