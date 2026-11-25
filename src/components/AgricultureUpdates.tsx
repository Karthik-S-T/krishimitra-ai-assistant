import { motion } from "framer-motion";
import { useLang } from "@/context/LanguageContext";

/**
 * 📰 AGRICULTURE UPDATES — landing section.
 * Links ONLY official government agriculture portals (no invented news, no
 * scraped headlines). Shows the date the links were last verified so farmers
 * always know where the information comes from.
 */

/** Official portal URLs — verified 2026-09-23. */
const PORTALS: { url: string; key: string; icon: string; block: string }[] = [
  {
    url: "https://raitamitra.karnataka.gov.in/",
    key: "updKarnataka",
    icon: "🏛️",
    block: "bg-[#2fa35c]",
  },
  {
    url: "https://agriwelfare.gov.in/",
    key: "updAgriMin",
    icon: "🌐",
    block: "bg-[#ffc53d]",
  },
  {
    url: "https://agmarknet.gov.in/",
    key: "updAgmarknet",
    icon: "💰",
    block: "bg-[#5fa8e8]",
  },
  {
    url: "https://mausam.imd.gov.in/",
    key: "updImd",
    icon: "🌦️",
    block: "bg-[#e2694e]",
  },
];

export function AgricultureUpdates() {
  const { t } = useLang();
  const checked = "2026-09-23";

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h2 className="font-display text-center text-2xl uppercase sm:text-3xl">
        {t("updTitle")}
      </h2>
      <p className="mt-2 text-center text-sm font-medium text-[#5c574b]">
        {t("updSub")}
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PORTALS.map((p, i) => (
          <motion.a
            key={p.key}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
            className="nb-card nb-press flex flex-col p-5"
          >
            <div
              className={`nb-shadow-sm mb-4 grid h-12 w-12 place-items-center border-2 border-[#141414] text-2xl ${p.block}`}
            >
              {p.icon}
</div>
            <h3 className="font-display text-base leading-snug">
              {t(p.key)}
            </h3>
            <p className="mt-1 flex-1 text-[11px] font-semibold text-[#5c574b]">
              {new URL(p.url).hostname}
            </p>
            <span className="mt-3 text-xs font-bold uppercase text-[#2fa35c]">
              {t("updVisit")} →
            </span>
          </motion.a>
        ))}
      </div>
      <p className="mt-4 text-center text-[11px] font-medium text-[#5c574b]">
        {t("updLastCheck")}: {checked}
      </p>
    </section>
  );
}
