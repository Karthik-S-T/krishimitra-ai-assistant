import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { useLang } from "@/context/LanguageContext";
import { LangSwitcher } from "@/components/LangSwitcher";
import { GuestBanner } from "@/components/GuestBanner";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/use-auth";

/**
 * Shared page shell for the farmer sections (Fields / History / Compare /
 * Profile): same neobrutalist header as the dashboard, plus the bottom nav.
 */
export function PageShell({
  title,
  emoji,
  children,
}: {
  title: string;
  emoji: string;
  children: ReactNode;
}) {
  const { t } = useLang();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  return (
    <div className="nb-dots min-h-screen bg-[#f5f0e6] pb-20 text-[#141414]">
      <header className="border-b-2 border-[#141414] bg-[#f5f0e6]/95">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="nb-shadow-sm grid h-11 w-11 place-items-center border-2 border-[#141414] bg-[#ffc53d] text-xl">
              {emoji}
            </div>
            <div className="leading-tight">
              <p className="font-display text-lg uppercase">KrishiMitra AI</p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5c574b]">
                {title}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LangSwitcher />
            <button
              type="button"
              onClick={async () => {
                await signOut();
                navigate("/");
              }}
              className="nb-press bg-white px-3 py-1.5 text-xs font-bold uppercase"
            >
              ⎋ {t("signOut")}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <GuestBanner />
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
