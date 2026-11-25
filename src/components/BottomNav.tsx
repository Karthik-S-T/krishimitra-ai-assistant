import { useLocation, useNavigate } from "react-router";
import { useLang } from "@/context/LanguageContext";

const ITEMS = [
  { path: "/dashboard", icon: "🏠", key: "navHome" },
  { path: "/fields", icon: "🌾", key: "navFields" },
  { path: "/alerts", icon: "🔔", key: "alertsTitle" },
  { path: "/help", icon: "🆘", key: "fhTitle" },
  { path: "/profile", icon: "👤", key: "navProfile" },
] as const;

/** Mobile-first bottom navigation shared by all farmer pages. */
export function BottomNav() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-[#141414] bg-[#f5f0e6]/95 backdrop-blur"
      aria-label="Main"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-5">
        {ITEMS.map((item) => {
          const active = pathname === item.path;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className={`nb-press flex flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] font-bold uppercase ${
                active ? "bg-[#ffc53d]" : "bg-transparent"
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="leading-none">{t(item.key)}</span>
            </button>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
