import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/context/LanguageContext";
import { PageShell } from "@/components/dashboard/PageShell";
import { SCHEMES, STATE_RESOURCES, type Scheme } from "@/lib/schemes";
import { type DemoField } from "@/lib/demoFarmStore";

/**
 * Schemes For You — real Government of India schemes with official links.
 * Personalization is tag-based from the farmer profile (state, crop,
 * irrigation) and only ever produces "potentially relevant" wording —
 * never an eligibility claim.
 */
export default function Schemes() {
  const { t } = useLang();
  const hasConvexUrl = Boolean(import.meta.env.VITE_CONVEX_URL);
  const user = useQuery(api.users.currentUser, hasConvexUrl ? {} : "skip");
  const fieldsQuery = useQuery(api.cropData.listFields, hasConvexUrl ? {} : "skip");
  const fields = fieldsQuery as DemoField[] | undefined;

  const [expanded, setExpanded] = useState<string | null>(null);

  // Light personalization from real profile data (never fabricates a match).
  const profileTags = useMemo(() => {
    const tags = new Set<string>(["all-farmers"]);
    const crop = fields?.find((f) => f.crop)?.crop;
    if (crop) tags.add("crop-insurance");
    if (fields?.some((f) => f.irrigationType && f.irrigationType !== "rainfed"))
      tags.add("irrigation");
    if (user?.village || user?.district) tags.add("landholders");
    return tags;
  }, [user, fields]);

  const sorted = [...SCHEMES].sort((a, b) => {
    const aScore = a.relevance.filter((r) => profileTags.has(r)).length;
    const bScore = b.relevance.filter((r) => profileTags.has(r)).length;
    return bScore - aScore;
  });

  const stateRes = user?.state ? STATE_RESOURCES[user.state] ?? [] : [];

  return (
    <PageShell title={t("schTitle")} emoji="📋">
      <h1 className="font-display mb-1 text-2xl uppercase">📋 {t("schTitle")}</h1>
      <p className="mb-4 text-xs font-semibold text-[#5c574b]">{t("schSub")}</p>

      <div className="nb-border mb-4 bg-[#ffc53d] px-4 py-3">
        <p className="text-xs font-bold text-[#141414]">⚠️ {t("schDisclaimer")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sorted.map((s: Scheme) => {
          const open = expanded === s.id;
          return (
            <article key={s.id} className="nb-border nb-shadow-sm bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="nb-shadow-sm grid h-11 w-11 shrink-0 place-items-center border-2 border-[#141414] bg-[#f5f0e6] text-xl">
                  {s.emoji}
                </span>
                <div className="min-w-0">
                  <p className="font-display text-base uppercase leading-tight">{s.name}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#5c574b]">{s.department}</p>
                </div>
              </div>

              <p className="mt-3 text-sm">{s.description}</p>

              <div className="nb-border mt-3 bg-[#ede7d8] px-3 py-2">
                <p className="text-[11px] font-bold uppercase">{t("schRelevant")}</p>
                <p className="text-xs font-semibold text-[#5c574b]">{t("schRelevantWhy")}</p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : s.id)}
                  className="nb-press nb-border bg-[#f5f0e6] px-3 py-1.5 text-[11px] font-bold uppercase"
                >
                  {open ? "▴" : "▾"} {t("schDetails")}
                </button>
                <a
                  href={s.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="nb-press nb-border inline-block bg-[#2fa35c] px-3 py-1.5 text-[11px] font-bold uppercase text-white"
                >
                  🌐 {t("schOfficialSite")}
                </a>
              </div>

              {open && (
                <div className="mt-3 space-y-2 border-t-2 border-dashed border-[#141414]/30 pt-3 text-xs">
                  <p>
                    <span className="font-bold uppercase">{t("schWho")}: </span>
                    <span className="font-semibold text-[#5c574b]">{s.whoMayBenefit}</span>
                  </p>
                  <p>
                    <span className="font-bold uppercase">{t("schDocs")}: </span>
                    <span className="font-semibold text-[#5c574b]">{s.documents.join(" · ")}</span>
                  </p>
                  <p>
                    <span className="font-bold uppercase">{t("schProcess")}: </span>
                    <span className="font-semibold text-[#5c574b]">{s.process}</span>
                  </p>
                  <p>
                    <span className="font-bold uppercase">{t("schSource")}: </span>
                    <span className="font-semibold text-[#5c574b]">{s.officialSource}</span>
                  </p>
                  <p className="text-[10px] font-semibold text-[#5c574b]">
                    🕒 {t("schReviewed")}: {s.lastReviewed}
                  </p>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {stateRes.length > 0 && (
        <section className="nb-border nb-shadow-sm mt-4 bg-white p-4">
          <p className="font-display mb-2 text-sm uppercase">
            🏛️ {t("schStateRes")} — {user?.state}
          </p>
          <div className="space-y-2">
            {stateRes.map((r) => (
              <a
                key={r.name}
                href={r.website}
                target="_blank"
                rel="noreferrer noopener"
                className="nb-press nb-border block bg-[#f5f0e6] px-3 py-2 text-xs font-bold"
              >
                🌐 {r.name}
              </a>
            ))}
          </div>
        </section>
      )}

      <p className="nb-border mt-4 bg-[#ede7d8] px-4 py-3 text-[11px] font-semibold text-[#5c574b]">
        {t("schVerifyNote")}
      </p>
    </PageShell>
  );
}
