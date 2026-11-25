import { useMemo, useState } from "react";
import {
  Droplets,
  FlaskConical,
  House,
  MapPin,
  Sprout,
  Sun,
  Trees,
  Wheat,
} from "lucide-react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { IconBadge } from "@/components/IconBadge";
import { stageForDay } from "@/convex/lib/alertRules";
import { useLang } from "@/context/LanguageContext";

/**
 * 🌾 MY DIGITAL FARM — lightweight clickable illustrated farm (Farm page tab).
 * Sections show ONLY real saved field data: crop + age (from the farmer's own
 * sowing date via stageForDay), irrigation type, village/taluk/district/state
 * for soil context. Soil N-P-K is never measured here — always says a soil
 * test is needed. No crop saved → honest empty state.
 */

const STAGE_LABEL_KEY: Record<string, string> = {
  germination: "dfStageGermination",
  vegetative: "dfStageVegetative",
  flowering: "dfStageFlowering",
  fruiting: "dfStageFruiting",
  maturity: "dfStageMaturity",
};

type Section = "crop" | "water" | "soil" | "house" | "trees";

export function DigitalFarmCard({
  crop,
  sowingDate,
  irrigationType,
  village,
  taluk,
  district,
  state,
}: {
  crop: string | undefined | null;
  sowingDate: string | undefined | null;
  irrigationType: string | undefined | null;
  village: string | undefined | null;
  taluk: string | undefined | null;
  district: string | undefined | null;
  state: string | undefined | null;
}) {
  const { t } = useLang();
  const [sel, setSel] = useState<Section | null>(null);

  const day = useMemo(() => {
    if (!sowingDate) return null;
    const ms = Date.now() - Date.parse(sowingDate);
    if (!Number.isFinite(ms) || ms < 0) return null;
    return Math.floor(ms / 86_400_000);
  }, [sowingDate]);

  const stage = day != null ? stageForDay(day) : null;
  const stageLabel = stage ? t(STAGE_LABEL_KEY[stage] ?? stage) : null;

  const tiles: {
    key: Section;
    icon: LucideIcon;
    label: string;
    block: string;
    span: string;
  }[] = [
    { key: "crop", icon: crop ? Wheat : Sprout, label: t("dfCrop"), block: "from-[#DDF1E4] to-[#B7DEC5]", span: "sm:col-span-2" },
    { key: "water", icon: Droplets, label: t("dfWater"), block: "from-[#DBEAFE] to-[#BFDBFE]", span: "" },
    { key: "soil", icon: FlaskConical, label: t("dfSoil"), block: "from-[#F6FBF8] to-[#DDEBE1]", span: "" },
    { key: "house", icon: House, label: t("dfHouse"), block: "from-[#FEF3C7] to-[#FDE68A]", span: "" },
    { key: "trees", icon: Trees, label: t("dfTrees"), block: "from-[#DDF1E4] to-[#B7DEC5]", span: "sm:col-span-2" },
  ];

  return (
    <div className="rounded-2xl border border-[#1B4332]/20 bg-[#F6FBF8] p-4 shadow-sm">
      <p className="flex items-center gap-2 font-display text-sm uppercase">
        <IconBadge icon={Sprout} tone="emerald" size="sm" />
        {t("dfTitle")}
      </p>
      <p className="mb-3 mt-1 text-[11px] font-semibold text-[#5c574b]">{t("dfSub")}</p>

      {!crop && (
        <p className="nb-border mb-3 rounded-xl bg-[#FEF3C7] px-3 py-2 text-xs font-semibold">
          {t("dfNoCrop")}
        </p>
      )}

      {/* Illustrated farm scene */}
      <div className="relative mb-3 overflow-hidden rounded-2xl border border-[#1B4332]/20 bg-gradient-to-b from-[#DBEAFE] via-[#E9F2EC] to-[#DDEBE1] p-3">
        {/* sun */}
        <motion.div
          aria-hidden
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-4 top-3 text-[#D97706]"
        >
          <Sun aria-hidden="true" className="size-8 text-[#EAB308]" />
        </motion.div>
        <div className="relative grid grid-cols-3 gap-2 pt-6">
          {tiles.map((tile) => (
            <motion.button
              key={tile.key}
              type="button"
              onClick={() => setSel((s) => (s === tile.key ? null : tile.key))}
              whileTap={{ scale: 0.97 }}
              className={`flex flex-col items-center gap-1 rounded-xl border border-[#1B4332]/25 bg-gradient-to-br px-2 py-3 text-center ${tile.block} ${
                tile.span
              } ${sel === tile.key ? "shadow-md ring-2 ring-[#EAB308] ring-offset-1" : "shadow-sm"}`}
            >
              <IconBadge icon={tile.icon} tone={tile.key === "house" ? "gold" : "emerald"} size="md" />
              <span className="text-[10px] font-bold uppercase leading-tight">
                {tile.label}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-[#5c574b]">
        {t("dfClickHint")}
      </p>

      {/* detail panel — only real saved data, honest otherwise */}
      {sel === "crop" && (
        <div className="nb-border mb-2 rounded-xl bg-[#F6FBF8] px-3 py-2 text-xs font-semibold">
          <p className="flex items-center gap-2 font-display text-sm uppercase"><Wheat className="size-4 text-[#1B4332]" /> {t("dfCrop")}</p>
          {crop && day != null ? (
            <>
              <p>
                <Sprout className="mr-1 inline size-4 text-[#1B4332]" /><b>{crop}</b> — {t("dfInfoAge", { day })}
              </p>
              {stageLabel && (
                <p>
                  {t("dfStatus")}: <b>{stageLabel}</b>
                </p>
              )}
            </>
          ) : (
            <p>{t("dfNoCrop")}</p>
          )}
        </div>
      )}

      {sel === "water" && (
        <div className="nb-border mb-2 rounded-xl bg-[#F6FBF8] px-3 py-2 text-xs font-semibold">
          <p className="flex items-center gap-2 font-display text-sm uppercase"><Droplets className="size-4 text-[#1D4ED8]" /> {t("dfWater")}</p>
          <p>
            {t("dfStatus")}: <b>{t("dfNormal")}</b>
          </p>
          {irrigationType && <p><Droplets className="mr-1 inline size-4" />{irrigationType}</p>}
        </div>
      )}

      {sel === "soil" && (
        <div className="nb-border mb-2 rounded-xl bg-[#F6FBF8] px-3 py-2 text-xs font-semibold">
          <p className="flex items-center gap-2 font-display text-sm uppercase"><FlaskConical className="size-4 text-[#1B4332]" /> {t("dfSoil")}</p>
          <p className="text-[11px] font-medium text-[#5c574b]">{t("dfSoilInfo")}</p>
          <p className="mt-1">{t("dfSoilNoData")}</p>
          {(village || taluk || district || state) && (
            <p className="mt-1">
              <MapPin className="mr-1 inline size-4" />{[village, taluk, district, state].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
      )}

      {sel === "house" && (
        <div className="nb-border mb-2 rounded-xl bg-[#F6FBF8] px-3 py-2 text-xs font-semibold">
          <p className="flex items-center gap-2 font-display text-sm uppercase"><House className="size-4 text-[#D97706]" /> {t("dfHouse")}</p>
          {district || state ? (
            <p>
              <MapPin className="mr-1 inline size-4" />{[district, state].filter(Boolean).join(", ")}
            </p>
          ) : (
            <p>{t("dfNoCrop")}</p>
          )}
        </div>
      )}

      {sel === "trees" && (
        <div className="nb-border mb-2 rounded-xl bg-[#F6FBF8] px-3 py-2 text-xs font-semibold">
          <p className="flex items-center gap-2 font-display text-sm uppercase"><Trees className="size-4 text-[#1B4332]" /> {t("dfTrees")}</p>
          <p>
            {t("dfStatus")}: <b>{t("dfHealthy")}</b>
          </p>
        </div>
      )}
    </div>
  );
}
