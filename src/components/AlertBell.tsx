import { useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/context/LanguageContext";

/**
 * Notification bell for the dashboard header. Live unread count from Convex;
 * hidden entirely when signed out (query returns null user).
 */
export function AlertBell({ demoMode = false }: { demoMode?: boolean }) {
  const { t } = useLang();
  const navigate = useNavigate();
  const hasConvexUrl = Boolean(import.meta.env.VITE_CONVEX_URL?.trim());
  const data = useQuery(api.alerts.listAlerts, hasConvexUrl ? {} : "skip");
  const unread = demoMode ? 2 : data?.unread ?? 0;

  return (
    <button
      type="button"
      aria-label={t("alertsTitle")}
      title={t("alertsTitle")}
      onClick={() => navigate("/alerts")}
      className="nb-press relative grid h-10 w-10 place-items-center border-2 border-[#141414] bg-white text-lg"
    >
      🔔
      {unread > 0 && (
        <span className="nb-shadow-sm absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center border-2 border-[#141414] bg-[#ffc53d] px-1 text-[10px] font-black">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}
