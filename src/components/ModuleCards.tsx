import { useQuery } from "convex/react";
import {
  BellRing,
  Bot,
  CloudSunRain,
  FileCheck2,
  FlaskConical,
  IndianRupee,
  LifeBuoy,
  MapPin,
  Sprout,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { IconBadge } from "@/components/IconBadge";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/context/LanguageContext";
import { cropName } from "@/lib/i18n";
import { stageForDay } from "@/convex/lib/alertRules";

/**
 * Dashboard module cards (My Crop / Weather / Soil / Market / Alerts /
 * Schemes / Nearby / AI). Each card links into the corresponding module and
 * shows a REAL value when the farmer has it — otherwise an honest "open" hint.
 * A clearly-labelled demo chip can be toggled for presentations.
 */
export function ModuleCards({
  demoMode: demoOverride,
  onDemoModeChange,
}: {
  demoMode?: boolean;
  onDemoModeChange?: (enabled: boolean) => void;
}) {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const hasConvexUrl = Boolean(import.meta.env.VITE_CONVEX_URL?.trim());
  const queryArgs = hasConvexUrl ? {} : "skip";
  const user = useQuery(api.users.currentUser, queryArgs);
  const fields = useQuery(api.cropData.listFields, queryArgs);
  const alerts = useQuery(api.alerts.listAlerts, queryArgs);
  const rec = useQuery(api.recommend.recommendCrop, "skip") as
    | { top?: { crop: string; probability: number }[] }
    | undefined;

  // Demo mode is a per-session presentation toggle. When ON, cards show the
  // sample farmer (Devanahalli · pomegranate · 62 days · pH 6.4) — ALWAYS with the
  // "DEMO MODE" chip so sample data is never mistaken for real measurements.
  // It is never written to the database or mixed into real farmer data.
  const [localDemo, setLocalDemo] = useState(false);
  const demo = demoOverride ?? localDemo;

  const field = fields?.[0];
  const days = field?.sowingDate
    ? Math.round((Date.now() - Date.parse(field.sowingDate)) / 86_400_000)
    : null;

  const demoDays = 62;
  const demoCrop = "pomegranate";
  const cards = [
    {
      icon: Sprout,
      tone: "emerald",
      title: t("cardCrop"),
      value: demo
        ? `${cropName(demoCrop, lang)} · ${demoDays}d`
        : field?.crop
          ? `${cropName(field.crop, lang)}${days != null ? ` · ${days}d` : ""}`
          : user?.currentCrop ?? null,
      sub:
        demo
          ? stageForDay(demoDays)
          : days != null && field?.crop
            ? stageForDay(days)
            : t("cardNoCrop"),
      to: "/fields",
    },
    { icon: CloudSunRain, tone: "sky", title: t("cardWeather"), value: demo ? "27°C" : null, sub: demo ? t("demoNote") : t("cardGo"), to: "/farm" },
    { icon: FlaskConical, tone: "mint", title: t("cardSoil"), value: demo ? "pH 6.4" : null, sub: demo ? t("demoNote") : t("cardGo"), to: "/dashboard" },
    // Market card deep-links to the price-forecast tab on the dashboard.
    { icon: IndianRupee, tone: "gold", title: t("cardMarket"), value: demo ? "Mandi ready" : null, sub: demo ? t("demoNote") : t("cardGo"), to: "/dashboard?tab=forecast" },
    {
      icon: BellRing,
      tone: "amber",
      title: t("cardAlerts"),
      value: demo ? "2" : (alerts?.unread ?? 0) > 0 ? String(alerts?.unread) : null,
      sub: t("alertsTitle"),
      to: "/alerts",
    },
    { icon: FileCheck2, tone: "mint", title: t("cardSchemes"), value: null, sub: t("cardGo"), to: "/schemes" },
    { icon: MapPin, tone: "sky", title: t("cardNearby"), value: demo ? "Devanahalli" : null, sub: demo ? t("demoNote") : t("cardGo"), to: "/nearby" },
    { icon: Bot, tone: "emerald", title: t("cardAi"), value: null, sub: t("cardGo"), to: "/dashboard" },
    { icon: LifeBuoy, tone: "amber", title: t("cardHelp"), value: null, sub: t("cardGo"), to: "/help" },
  ] as const;

  return (
    <div className="mb-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={demo}
          onClick={() => {
            const next = !demo;
            if (onDemoModeChange) onDemoModeChange(next);
            else setLocalDemo(next);
          }}
          className={`nb-press px-3 py-1 text-[10px] font-black uppercase ${
            demo ? "bg-[#FEF3C7]" : "bg-[#F6FBF8]"
          }`}
        >
          <FlaskConical className="mr-1 inline size-3.5" /> {t("demoBadge")}: {demo ? t("alertsOn") : t("alertsOff")}
        </button>
        {demo && (
          <p className="inline-flex items-center gap-2 rounded-xl border border-[#1B4332]/20 bg-[#FEF3C7] px-3 py-1 text-[10px] font-bold text-[#102318]">
            <MapPin className="size-3.5" />
            Devanahalli, Karnataka · {cropName(demoCrop, lang)} · {demoDays}d · pH 6.4 — {t("demoNote")}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <button
            key={c.title}
            type="button"
            onClick={() => navigate(c.to)}
            className="nb-press flex flex-col items-start gap-1 bg-[#F6FBF8] px-4 py-3 text-left"
          >
            <IconBadge icon={c.icon} tone={c.tone} size="sm" />
            <span className="text-[10px] font-bold uppercase text-[#5c574b]">{c.title}</span>
            <span className="truncate text-sm font-bold">{c.value ?? c.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
