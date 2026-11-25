import { useMemo } from "react";
import { motion } from "framer-motion";
import { stageForDay } from "@/convex/lib/alertRules";
import { useLang } from "@/context/LanguageContext";

/**
 * 📅 MY FARM CALENDAR — Farm page tab.
 * Renders the 5 activity windows derived ONLY from the farmer's own saved
 * crop + sowing date via stageForDay() bands (germination <=15, vegetative
 * <=40, flowering <=75, fruiting <=105, maturity after). Qualitative only —
 * never doses, never invented dates. Without crop + sowing date it shows an
 * honest empty state.
 */

/** stageForDay() returns one of these keys; map to i18n stage labels. */
const STAGE_LABEL_KEY: Record<string, string> = {
  germination: "dfStageGermination",
  vegetative: "dfStageVegetative",
  flowering: "dfStageFlowering",
  fruiting: "dfStageFruiting",
  maturity: "dfStageMaturity",
};

/** One window per stage band: icon, i18n title key, day band, colour block. */
const WINDOWS: {
  icon: string;
  title: string;
  from: number;
  to: number;
  block: string;
}[] = [
  { icon: "🌱", title: "calSow", from: 0, to: 15, block: "bg-[#5fa8e8]" },
  { icon: "💧", title: "calIrrigation", from: 15, to: 40, block: "bg-[#5fa8e8]" },
  { icon: "🌿", title: "calNutrient", from: 40, to: 75, block: "bg-[#2fa35c]" },
  { icon: "🐛", title: "calMonitor", from: 75, to: 105, block: "bg-[#e2694e]" },
  { icon: "🌾", title: "calHarvest", from: 105, to: 9999, block: "bg-[#ffc53d]" },
];

export function FarmCalendarCard({
  crop,
  sowingDate,
}: {
  crop: string | undefined | null;
  sowingDate: string | undefined | null;
}) {
  const { t } = useLang();

  const ready = Boolean(crop && sowingDate);

  const day = useMemo(() => {
    if (!sowingDate) return null;
    const ms = Date.now() - Date.parse(sowingDate);
    if (!Number.isFinite(ms) || ms < 0) return null;
    return Math.floor(ms / 86_400_000);
  }, [sowingDate]);

  const stage = day != null ? stageForDay(day) : null;

  return (
    <div className="border-2 border-[#141414] bg-[#f5f0e6] p-3 nb-shadow-sm">
      <p className="font-display text-sm uppercase">📅 {t("calTitle")}</p>
      <p className="mb-3 mt-1 text-[11px] font-semibold text-[#5c574b]">{t("calSub")}</p>

      {!ready && (
        <p className="nb-border mb-3 bg-[#ffc53d]/35 px-3 py-2 text-xs font-semibold">
          {t("calNoCrop")}
        </p>
      )}

      {ready && (
        <>
          {/* current status strip */}
          <div className="nb-border mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 bg-white px-3 py-2 text-xs font-semibold">
            <span>
              🌾 <b>{crop}</b>
            </span>
            <span>
              🗓️ {t("calSowingDate")}: <b>{sowingDate}</b>
            </span>
            {day != null && (
              <span className="nb-chip bg-[#ffc53d]">{t("calDayN", { day })}</span>
            )}
            {stage && (
              <span>
                {t("calStageNow")}: <b>{t(STAGE_LABEL_KEY[stage] ?? stage)}</b>
              </span>
            )}
          </div>

          {/* stage progress bar (0–115+ days) */}
          {day != null && (
            <div className="nb-bar mb-3">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (day / 115) * 100)}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="bg-[#2fa35c]"
              />
            </div>
          )}

          {/* activity windows */}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {WINDOWS.map((w, i) => {
              const active =
                day != null && day >= w.from && day < Math.min(w.to, 9999);
              return (
                <motion.div
                  key={w.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className={`relative border-2 border-[#141414] bg-white p-3 ${
                    active ? "nb-shadow-lg" : "opacity-80"
                  }`}
                >
                  <span
                    className={`nb-shadow-sm absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center border-2 border-[#141414] text-xs ${w.block}`}
                  >
                    {active ? "●" : ""}
                  </span>
                  <p className="text-lg">{w.icon}</p>
                  <p className="text-xs font-bold uppercase leading-snug">
                    {t(w.title)}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold text-[#5c574b]">
                    {w.to >= 9999
                      ? `${t("calDay")} ${w.from}+`
                      : `${t("calDay")} ${w.from}–${w.to}`}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
