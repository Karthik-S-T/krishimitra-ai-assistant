import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLang } from "@/context/LanguageContext";
import { PageShell } from "@/components/dashboard/PageShell";
import { RULE_META, SEVERITY_META } from "@/lib/alertText";
import { cropName } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import { loadDemoFarmData, type DemoField } from "@/lib/demoFarmStore";
import { withTimeout } from "@/lib/demoAgronomy";

const fmtTime = (ms: number) =>
  new Date(ms).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

interface AlertRow {
  _id: Id<"farmAlerts">;
  ruleKey: string;
  severity: string;
  params: Record<string, string | number>;
  source: string;
  createdAt: number;
  readAt?: number;
}

export default function Alerts() {
  const { t, lang } = useLang();
  const hasConvexUrl = Boolean(import.meta.env.VITE_CONVEX_URL);
  const [demoFarm] = useState(loadDemoFarmData);
  const data = useQuery(api.alerts.listAlerts, hasConvexUrl ? {} : "skip");
  const sync = useMutation(api.alerts.syncAlerts);
  const markRead = useMutation(api.alerts.markRead);
  const markAllRead = useMutation(api.alerts.markAllRead);
  const dismiss = useMutation(api.alerts.dismissAlert);
  const setEnabled = useMutation(api.alerts.setAlertsEnabled);
  const getWeather = useAction(api.weather.getWeather);
  const getMandi = useAction(api.market.getMandiPrices);
  const fieldsQuery = useQuery(api.cropData.listFields, hasConvexUrl ? {} : "skip");
  const fields = (fieldsQuery ?? demoFarm.fields) as DemoField[];

  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [localAlerts, setLocalAlerts] = useState<AlertRow[]>(() => [
    {
      _id: "demo-alert-rain" as Id<"farmAlerts">,
      ruleKey: "rain",
      severity: "warning",
      params: { mm: 42, dayOffset: 1, light: 0 } as Record<string, string | number>,
      source: "Illustrative demo forecast",
      createdAt: Date.now() - 3_600_000,
    },
    {
      _id: "demo-alert-market" as Id<"farmAlerts">,
      ruleKey: "market",
      severity: "info",
      params: { crop: "pomegranate", commodity: "pomegranate", pct: 4, direction: "up" } as Record<string, string | number>,
      source: "Illustrative demo market trend",
      createdAt: Date.now() - 86_400_000,
    },
  ]);
  const [localEnabled, setLocalEnabled] = useState(true);
  const [useLocalAlerts, setUseLocalAlerts] = useState(!hasConvexUrl);

  // Sync derives alerts ONLY from real data: live forecast (if the farmer
  // grants location) + live mandi trend (if a crop is known). Missing inputs
  // simply skip those rules — nothing is invented.
  const doSync = useCallback(async () => {
    setSyncing(true);
    if (!hasConvexUrl || data === undefined) {
      if (!hasConvexUrl) setUseLocalAlerts(true);
      setSyncing(false);
      return;
    }
    try {
      let daily: { date: string; precipSum: number; tMax: number }[] | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation?.getCurrentPosition(resolve, reject, { timeout: 6000 });
        });
        const w = await withTimeout(getWeather({ lat: pos.coords.latitude, lon: pos.coords.longitude })) as {
          daily: { date: string; precipSum: number; tMax: number }[];
        };
        daily = w.daily.map((d) => ({ date: d.date, precipSum: d.precipSum, tMax: d.tMax }));
      } catch {
        /* location denied / weather failed → weather rules skipped */
      }

      let market: {
        crop: string;
        commodity: string;
        direction: "up" | "down" | "flat";
        pct: number;
        latestDate: string;
      } | undefined;
      try {
        // The farmer's own field crop is the relevant one for a market alert.
        const crop = fields?.find((f) => f.crop)?.crop ?? null;
        if (crop) {
          const m = await withTimeout(getMandi({ crop, state: "Karnataka" }));
          if (m.available && m.trend?.pct != null) {
            market = {
              crop,
              commodity: m.commodity,
              direction: m.trend.direction,
              pct: m.trend.pct,
              latestDate: m.latestDate,
            };
          }
        }
      } catch {
        /* market unavailable → market rule skipped */
      }

      await withTimeout(sync({ daily, market }));
      setUseLocalAlerts(false);
    } catch {
      setUseLocalAlerts(true);
      toast.info("Live alert sync is unavailable; showing the local demo alerts.");
    } finally {
      setSyncing(false);
    }
  }, [data, fields, getMandi, getWeather, hasConvexUrl, sync]);

  const alerts = (useLocalAlerts || data === undefined ? localAlerts : data.alerts) as AlertRow[];
  const enabled = useLocalAlerts || data === undefined ? localEnabled : data.enabled;
  const unread = useLocalAlerts || data === undefined
    ? alerts.filter((alert) => alert.readAt === undefined).length
    : data.unread;

  const updateRead = async (alert: AlertRow) => {
    if (useLocalAlerts || data === undefined || !hasConvexUrl) {
      setLocalAlerts((current) => current.map((item) =>
        item._id === alert._id ? { ...item, readAt: Date.now() } : item,
      ));
      return;
    }
    try {
      await withTimeout(markRead({ alertId: alert._id }));
    } catch {
      setUseLocalAlerts(true);
      setLocalAlerts((current) => current.map((item) =>
        item._id === alert._id ? { ...item, readAt: Date.now() } : item,
      ));
      toast.info("Alert marked read locally; cloud sync is unavailable.");
    }
  };

  const updateAllRead = async () => {
    if (useLocalAlerts || data === undefined || !hasConvexUrl) {
      setLocalAlerts((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? Date.now() })));
      return;
    }
    try {
      await withTimeout(markAllRead({}));
    } catch {
      setUseLocalAlerts(true);
      setLocalAlerts((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? Date.now() })));
      toast.info("Alerts marked read locally; cloud sync is unavailable.");
    }
  };

  const removeAlert = async (alert: AlertRow) => {
    if (useLocalAlerts || data === undefined || !hasConvexUrl) {
      setLocalAlerts((current) => current.filter((item) => item._id !== alert._id));
      setDetailsId((current) => current === alert._id ? null : current);
      return;
    }
    try {
      await withTimeout(dismiss({ alertId: alert._id }));
    } catch {
      setUseLocalAlerts(true);
      setLocalAlerts((current) => current.filter((item) => item._id !== alert._id));
      setDetailsId((current) => current === alert._id ? null : current);
      toast.info("Alert dismissed locally; cloud sync is unavailable.");
    }
  };

  const toggleAlerts = async () => {
    const nextEnabled = !enabled;
    if (useLocalAlerts || data === undefined || !hasConvexUrl) {
      setLocalEnabled(nextEnabled);
      return;
    }
    try {
      await withTimeout(setEnabled({ enabled: nextEnabled }));
    } catch {
      setUseLocalAlerts(true);
      setLocalEnabled(nextEnabled);
      toast.info("Alert preference updated locally; cloud sync is unavailable.");
    }
  };

  const localize = (a: AlertRow) => {
    const meta = RULE_META[a.ruleKey] ?? RULE_META.rain!;
    const p = { ...a.params };
    const cropId = typeof p.crop === "string" ? p.crop : null;
    if (cropId) {
      const local = cropName(cropId, lang);
      if (p.crop) p.crop = local;
      if (p.commodity) p.commodity = local;
    }
    const text = meta.text[lang as Lang](p);
    const sev = SEVERITY_META[a.severity] ?? SEVERITY_META.info!;
    return { meta, text, sev };
  };

  const openDetails = (a: AlertRow) => {
    setDetailsId(a._id);
    if (a.readAt === undefined) void updateRead(a);
  };

  return (
    <PageShell title={t("alertsTitle")} emoji="🔔">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl uppercase">🔔 {t("alertsTitle")}</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void doSync()}
            disabled={syncing}
            className="nb-press nb-border bg-white px-3 py-2 text-xs font-bold uppercase disabled:opacity-50"
          >
            {syncing ? "⏳" : "🔄"} {t("alertsRefresh")}
          </button>
          <button
            type="button"
            onClick={() => void updateAllRead()}
            disabled={unread === 0}
            className="nb-press nb-border bg-white px-3 py-2 text-xs font-bold uppercase disabled:opacity-50"
          >
            ✓ {t("alertsMarkAll")}
          </button>
        </div>
      </div>

      {/* Enable / disable notifications */}
      <div className="nb-border mb-4 flex items-center justify-between bg-white px-4 py-3">
        <p className="text-sm font-bold uppercase">{t("alertsEnable")}</p>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => void toggleAlerts()}
          className={`nb-border nb-press px-3 py-1.5 text-xs font-black uppercase ${
            enabled ? "bg-[#2fa35c] text-white" : "bg-[#ede7d8]"
          }`}
        >
          {enabled ? t("alertsOn") : t("alertsOff")}
        </button>
      </div>

      {alerts.length === 0 ? (
        <div className="nb-card flex flex-col items-center p-10 text-center">
          <span className="mb-3 text-5xl">🔕</span>
          <p className="font-display text-lg uppercase">{t("alertsEmpty")}</p>
          <p className="mt-2 max-w-sm text-sm font-medium text-[#5c574b]">
            {t("alertsEmptyHint")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => {
            const { meta, text, sev } = localize(a);
            const isUnread = a.readAt === undefined;
            return (
              <article
                key={a._id}
                className={`nb-border nb-shadow-sm bg-white p-4 ${isUnread ? "border-l-8 border-l-[#ffc53d]" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-base">
                      {meta.emoji} {text.title}
                    </p>
                    <p className="mt-1 text-sm">{text.body}</p>
                    <p className="mt-1 text-sm font-semibold text-[#2f6b3f]">➜ {text.action}</p>
                    <p className="mt-2 text-[11px] font-semibold text-[#5c574b]">
                      🕒 {fmtTime(a.createdAt)} · 📄 {a.source}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span
                      className={`nb-border px-2 py-0.5 text-[10px] font-black uppercase ${sev.chip}`}
                    >
                      {sev.dot} {sev.label[lang as Lang]}
                    </span>
                    {isUnread && (
                      <button
                        type="button"
                        onClick={() => void updateRead(a)}
                        className="nb-press bg-[#ede7d8] px-2 py-1 text-[10px] font-bold uppercase"
                      >
                        ✓ {t("alertsMarkRead")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void removeAlert(a)}
                      className="nb-press bg-white px-2 py-1 text-[10px] font-bold uppercase"
                    >
                      🗑 {t("alertsDismiss")}
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openDetails(a)}
                    className="nb-press nb-border bg-[#f5f0e6] px-3 py-1.5 text-[11px] font-bold uppercase"
                  >
                    {t("alertsDetails")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Details panel */}
      {detailsId && (() => {
        const a = alerts.find((x) => x._id === detailsId);
        if (!a) return null;
        const { text, sev } = localize(a);
        return (
          <div className="nb-border nb-shadow-sm mt-4 bg-[#f5f0e6] p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-display text-sm uppercase">{t("alertsDetails")}</p>
              <button
                type="button"
                onClick={() => setDetailsId(null)}
                className="nb-press bg-white px-2 py-1 text-[10px] font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-sm font-bold">
              {sev.dot} {text.title}
            </p>
            <p className="mt-1 text-sm">{text.body}</p>
            <p className="mt-1 text-sm font-semibold">➜ {text.action}</p>
            <p className="mt-2 text-[11px] font-semibold text-[#5c574b]">
              🕒 {fmtTime(a.createdAt)} · 📄 {a.source} · {sev.label[lang as Lang]}
            </p>
          </div>
        );
      })()}
    </PageShell>
  );
}
