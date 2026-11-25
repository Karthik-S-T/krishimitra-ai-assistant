import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/context/LanguageContext";
import { PageShell } from "@/components/dashboard/PageShell";
import { KARNATAKA_DISTRICTS } from "@/lib/districts";
import { cropName } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

const IRRIGATION_TYPES = ["rainfed", "canal", "borewell", "well", "other"] as const;
const STATES = ["Karnataka", "Maharashtra", "Telangana", "Andhra Pradesh", "Tamil Nadu", "Kerala", "Goa"];

export default function Profile() {
  const { t, lang, setLang } = useLang();
  const navigate = useNavigate();

  const user = useQuery(api.users.currentUser, {});
  const fields = useQuery(api.cropData.listFields, {});
  const analyses = useQuery(api.cropData.listAnalyses, { limit: 200 });
  const due = useQuery(api.cropData.dueReminders, {});
  const saveProfile = useMutation(api.profile.completeProfile);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    village: "",
    district: "Haveri",
    state: "Karnataka",
    preferredLanguage: "en",
    landAreaAcres: "",
    irrigationType: "rainfed",
    currentCrop: "",
    sowingDate: "",
  });

  // Populate the form from the loaded profile (once).
  useEffect(() => {
    if (!user || form.name !== "") return;
    setForm({
      name: user.name ?? "",
      village: user.village ?? "",
      district: user.district ?? "Haveri",
      state: user.state ?? "Karnataka",
      preferredLanguage: user.preferredLanguage ?? lang,
      landAreaAcres: user.landAreaAcres != null ? String(user.landAreaAcres) : "",
      irrigationType: user.irrigationType ?? "rainfed",
      currentCrop: user.currentCrop ?? "",
      sowingDate: user.sowingDate ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const save = async () => {
    setSaving(true);
    try {
      await saveProfile({
        name: form.name,
        village: form.village,
        district: form.district,
        state: form.state,
        preferredLanguage: form.preferredLanguage,
        landAreaAcres: form.landAreaAcres ? Number(form.landAreaAcres) : undefined,
        irrigationType: form.irrigationType || undefined,
        currentCrop: form.currentCrop || undefined,
        sowingDate: form.sowingDate || undefined,
      });
      if (["en", "kn", "hi"].includes(form.preferredLanguage)) {
        setLang(form.preferredLanguage as Lang);
      }
      toast.success(t("profSaved"));
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("profSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const links = [
    { to: "/dashboard", label: `🏠 ${t("navHome")}` },
    { to: "/scan", label: `📸 ${t("scanShort")}` },
    { to: "/fields", label: `🌾 ${t("navFields")}` },
    { to: "/history", label: `📋 ${t("navHistory")}` },
    { to: "/compare", label: `📊 ${t("navCompare")}` },
    { to: "/farm", label: `🗺️ ${t("farmTitle")}` },
    { to: "/alerts", label: `🔔 ${t("alertsTitle")}` },
    { to: "/schemes", label: `📋 ${t("schTitle")}` },
    { to: "/nearby", label: `📍 ${t("nbTitle")}` },
    { to: "/help", label: `🆘 ${t("fhTitle")}` },
  ];

  return (
    <PageShell title={t("navProfile")} emoji="👤">
      <h1 className="font-display mb-4 text-2xl uppercase">👤 {t("navProfile")}</h1>

      <section className="nb-shadow-sm nb-border bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-base uppercase">
              {user?.name ?? t("profileFarmer")}
            </p>
            <p className="text-sm font-semibold text-[#5c574b]">
              {user?.email ?? user?.phone ?? "—"}
            </p>
          </div>
          {!user?.isAnonymous && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="nb-press nb-border shrink-0 bg-[#ffc53d] px-3 py-1.5 text-[11px] font-bold uppercase"
            >
              ✏️ {editing ? t("profCancel") : t("profEdit")}
            </button>
          )}
        </div>

        {!editing ? (
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="nb-border bg-[#f5f0e6] p-3">
              <p className="font-display text-xl">{fields?.length ?? 0}</p>
              <p className="text-xs font-bold uppercase">{t("navFields")}</p>
            </div>
            <div className="nb-border bg-[#f5f0e6] p-3">
              <p className="font-display text-xl">{analyses?.length ?? 0}</p>
              <p className="text-xs font-bold uppercase">{t("navHistory")}</p>
            </div>
            <div className="nb-border bg-[#f5f0e6] p-3">
              <p className="font-display text-xl">
                {user?.landAreaAcres != null ? user.landAreaAcres : "—"}
              </p>
              <p className="text-xs font-bold uppercase">{t("profLand")}</p>
            </div>
            <div className="nb-border bg-[#f5f0e6] p-3">
              <p className="font-display text-xl truncate">
                {user?.irrigationType ? t(`irr_${user.irrigationType}`) : "—"}
              </p>
              <p className="text-xs font-bold uppercase">{t("profIrrigation")}</p>
            </div>
            <div className="nb-border col-span-2 bg-[#f5f0e6] p-3 sm:col-span-2">
              <p className="text-sm font-bold">
                {user?.village ? `${user.village}, ${user.district ?? ""}` : "—"}
              </p>
              <p className="text-xs font-bold uppercase">{t("profVillage")}</p>
            </div>
            <div className="nb-border col-span-2 bg-[#f5f0e6] p-3 sm:col-span-2">
              <p className="text-sm font-bold">
                {user?.currentCrop
                  ? `${cropName(user.currentCrop, lang)}${user.sowingDate ? ` · ${user.sowingDate}` : ""}`
                  : "—"}
              </p>
              <p className="text-xs font-bold uppercase">{t("profCrop")}</p>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3 border-t-2 border-dashed border-[#141414]/30 pt-3">
            <label className="block text-xs font-bold uppercase">
              {t("profName")}
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="nb-border mt-1 w-full bg-[#f5f0e6] px-3 py-2 text-sm font-semibold outline-none"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold uppercase">
                {t("profVillage")}
                <input
                  value={form.village}
                  onChange={(e) => setForm({ ...form, village: e.target.value })}
                  className="nb-border mt-1 w-full bg-[#f5f0e6] px-3 py-2 text-sm font-semibold outline-none"
                />
              </label>
              <label className="block text-xs font-bold uppercase">
                {t("profDistrict")}
                <select
                  value={form.district}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                  className="nb-border mt-1 w-full bg-[#f5f0e6] px-3 py-2 text-sm font-semibold outline-none"
                >
                  {KARNATAKA_DISTRICTS.map((d) => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold uppercase">
                {t("profState")}
                <select
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="nb-border mt-1 w-full bg-[#f5f0e6] px-3 py-2 text-sm font-semibold outline-none"
                >
                  {STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold uppercase">
                {t("profLanguage")}
                <select
                  value={form.preferredLanguage}
                  onChange={(e) => setForm({ ...form, preferredLanguage: e.target.value })}
                  className="nb-border mt-1 w-full bg-[#f5f0e6] px-3 py-2 text-sm font-semibold outline-none"
                >
                  <option value="en">English</option>
                  <option value="kn">ಕನ್ನಡ</option>
                  <option value="hi">हिंदी</option>
                </select>
              </label>
              <label className="block text-xs font-bold uppercase">
                {t("profLand")}
                <input
                  type="number"
                  min="0"
                  value={form.landAreaAcres}
                  onChange={(e) => setForm({ ...form, landAreaAcres: e.target.value })}
                  className="nb-border mt-1 w-full bg-[#f5f0e6] px-3 py-2 text-sm font-semibold outline-none"
                />
              </label>
              <label className="block text-xs font-bold uppercase">
                {t("profIrrigation")}
                <select
                  value={form.irrigationType}
                  onChange={(e) => setForm({ ...form, irrigationType: e.target.value })}
                  className="nb-border mt-1 w-full bg-[#f5f0e6] px-3 py-2 text-sm font-semibold outline-none"
                >
                  {IRRIGATION_TYPES.map((i) => (
                    <option key={i} value={i}>{t(`irr_${i}`)}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold uppercase">
                {t("profCrop")}
                <input
                  value={form.currentCrop}
                  onChange={(e) => setForm({ ...form, currentCrop: e.target.value })}
                  placeholder="maize / cotton / …"
                  className="nb-border mt-1 w-full bg-[#f5f0e6] px-3 py-2 text-sm font-semibold outline-none"
                />
              </label>
              <label className="block text-xs font-bold uppercase">
                {t("profSowing")}
                <input
                  type="date"
                  value={form.sowingDate}
                  onChange={(e) => setForm({ ...form, sowingDate: e.target.value })}
                  className="nb-border mt-1 w-full bg-[#f5f0e6] px-3 py-2 text-sm font-semibold outline-none"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="nb-press nb-border bg-[#2fa35c] px-4 py-2 text-xs font-bold uppercase text-white disabled:opacity-50"
            >
              {saving ? "⏳" : "💾"} {t("profSave")}
            </button>
          </div>
        )}
      </section>

      <section className="nb-shadow-sm nb-border mt-4 bg-white p-4">
        <p className="font-display mb-2 text-sm uppercase">🔔 {t("remTitle")}</p>
        {due === undefined ? (
          <p className="text-sm font-semibold">⏳…</p>
        ) : due.length === 0 ? (
          <p className="text-sm font-semibold text-[#5c574b]">{t("remNoneDue")}</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-semibold">{t("remDueHint")}</p>
            <button
              type="button"
              onClick={() => navigate("/scan")}
              className="nb-press nb-border bg-[#ffc53d] px-3 py-2 text-xs font-bold uppercase"
            >
              📸 {t("scanShort")}
            </button>
          </div>
        )}
      </section>

      <section className="nb-shadow-sm nb-border mt-4 bg-white p-4">
        <p className="font-display mb-2 text-sm uppercase">🧭 {t("quickLinks")}</p>
        <div className="grid grid-cols-2 gap-2">
          {links.map((l) => (
            <button
              key={l.to}
              type="button"
              onClick={() => navigate(l.to)}
              className="nb-press nb-border bg-[#f5f0e6] px-3 py-2 text-xs font-bold uppercase"
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
