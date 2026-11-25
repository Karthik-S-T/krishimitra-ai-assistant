import { Sparkles } from "lucide-react";
import { Link, useLocation } from "react-router";
import { IconBadge } from "@/components/IconBadge";
import { useLang } from "@/context/LanguageContext";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";

/** Explains guest sessions and offline demo mode on pages using PageShell. */
export function GuestBanner({
  onLoadSampleFarm,
}: {
  onLoadSampleFarm?: () => void;
}) {
  const { t } = useLang();
  const { isLoading, user } = useAuth();
  const location = useLocation();
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const hasConvexUrl = Boolean(import.meta.env.VITE_CONVEX_URL?.trim());
  const isGuest = user?.isAnonymous === true;
  const isDemoMode = !hasConvexUrl || backendUnavailable;

  useEffect(() => {
    if (!isLoading) {
      setBackendUnavailable(false);
      return;
    }

    const timeout = window.setTimeout(() => setBackendUnavailable(true), 8000);
    return () => window.clearTimeout(timeout);
  }, [isLoading]);

  if (!isGuest && !isDemoMode) return null;

  const returnTo = `${location.pathname}${location.search}`;
  return (
    <div className="nb-border mb-5 flex flex-col items-start justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#FEF3C7] to-[#F6FBF8] px-4 py-3 sm:flex-row sm:items-center">
      <p className="flex items-center gap-2 text-xs font-bold text-[#102318]">
        <IconBadge icon={Sparkles} tone="gold" size="sm" />
        {isDemoMode
          ? "Demo mode: explore farmer tools; cloud data and sign-in are unavailable."
          : `👤 ${t("authGuestBanner")}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {onLoadSampleFarm && (
          <button
            type="button"
            onClick={onLoadSampleFarm}
            className="nb-press inline-flex items-center gap-2 shrink-0 bg-[#1B4332] px-4 py-2 text-[11px] font-bold uppercase text-white"
          >
            <Sparkles className="size-4" />
            Load Sample Farm (Devanahalli • Pomegranate)
          </button>
        )}
        {!isDemoMode && (
          <Link
            to={`/auth?returnTo=${encodeURIComponent(returnTo)}`}
            className="nb-press nb-shadow-sm shrink-0 bg-[#F6FBF8] px-3 py-1.5 text-[11px] font-bold uppercase text-[#1B4332]"
          >
            {t("authGuestSignIn")}
          </Link>
        )}
      </div>
    </div>
  );
}
