import { Award, Bot, Database, Info, Sprout, Workflow } from "lucide-react";
import { useState } from "react";
import { IconBadge } from "@/components/IconBadge";
import { useLang } from "@/context/LanguageContext";

/**
 * ℹ️ HOW KRISHIMITRA WORKS — collapsible explanation panel for project
 * guides and external examiners (viva). Purely informational.
 */
export function HowItWorks() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  const steps = [
    { k: "hiw1", b: "hiw1b", icon: Database },
    { k: "hiw2", b: "hiw2b", icon: Workflow },
    { k: "hiw3", b: "hiw3b", icon: Bot },
    { k: "hiw4", b: "hiw4b", icon: Award },
    { k: "hiw5", b: "hiw5b", icon: Sprout },
    { k: "hiw6", b: "hiw6b", icon: Info },
  ];

  return (
    <section className="nb-card p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <span className="flex items-center gap-2 font-display text-sm uppercase">
          <Info className="size-4 text-[#1B4332]" /> {t("hiwTitle")}
        </span>
        <span className="nb-press nb-border bg-white px-2 py-0.5 text-[10px] font-bold uppercase">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div className="mt-4">
          <p className="mb-3 text-xs font-semibold text-[#5c574b]">{t("hiwSub")}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.k} className="rounded-xl border border-[#1B4332]/15 bg-[#E9F2EC] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <IconBadge icon={s.icon} tone={i === 3 ? "gold" : "emerald"} size="sm" />
                  <p className="text-[10px] font-black uppercase text-[#496352]">
                    Step {i + 1}
                  </p>
                </div>
                <p className="font-display text-sm uppercase">{t(s.k)}</p>
                <p className="mt-1 text-[11px] font-semibold text-[#5c574b]">{t(s.b)}</p>
              </div>
            ))}
          </div>
          <p className="nb-border mt-3 bg-[#ede7d8] px-3 py-2 text-[11px] font-bold">
            {t("hiwFlow")}
          </p>
        </div>
      )}
    </section>
  );
}
