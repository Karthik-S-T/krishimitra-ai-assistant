import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/context/LanguageContext";
import { KARNATAKA_DISTRICTS } from "@/lib/districts";
import { AUTH_INPUT, ErrorBox, StepHeader } from "./ui";

const STATES = [
  "Karnataka",
  "Andhra Pradesh",
  "Telangana",
  "Maharashtra",
  "Tamil Nadu",
  "Kerala",
  "Goa",
  "Other",
] as const;

const LANGS = [
  { value: "kn", label: "ಕನ್ನಡ (Kannada)" },
  { value: "en", label: "English" },
  { value: "hi", label: "हिंदी (Hindi)" },
] as const;

export interface ProfileData {
  name: string;
  village: string;
  district: string;
  state: string;
  preferredLanguage: string;
}

interface Props {
  onSubmit: (data: ProfileData) => void;
  submitting: boolean;
  error: string | null;
}

export function ProfileStep({ onSubmit, submitting, error }: Props) {
  const { t, setLang } = useLang();
  const [form, setForm] = useState<ProfileData>({
    name: "",
    village: "",
    district: "",
    state: "Karnataka",
    preferredLanguage: "kn",
  });

  const valid =
    form.name.trim().length >= 2 &&
    form.village.trim().length >= 2 &&
    Boolean(form.district) &&
    Boolean(form.state);

  return (
    <>
      <StepHeader
        bg="bg-[#ffc53d]"
        title="Complete Your Profile"
        subtitle="One-time setup · helps us personalize your advisory"
      />
      <div className="px-6 py-6">
        <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest">
          Full Name
        </label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Enter your name"
          autoComplete="name"
          className={AUTH_INPUT}
          disabled={submitting}
        />

        <label className="mb-2 mt-4 block text-[11px] font-bold uppercase tracking-widest">
          Village / Location
        </label>
        <Input
          value={form.village}
          onChange={(e) => setForm({ ...form, village: e.target.value })}
          placeholder="Enter village"
          className={AUTH_INPUT}
          disabled={submitting}
        />

        <label className="mb-2 mt-4 block text-[11px] font-bold uppercase tracking-widest">
          District
        </label>
        <select
          value={form.district}
          onChange={(e) => setForm({ ...form, district: e.target.value })}
          className={AUTH_INPUT + " w-full"}
          disabled={submitting}
        >
          <option value="">Select district</option>
          {KARNATAKA_DISTRICTS.map((d) => (
            <option key={d.name} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>

        <label className="mb-2 mt-4 block text-[11px] font-bold uppercase tracking-widest">
          State
        </label>
        <select
          value={form.state}
          onChange={(e) => setForm({ ...form, state: e.target.value })}
          className={AUTH_INPUT + " w-full"}
          disabled={submitting}
        >
          {STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label className="mb-2 mt-4 block text-[11px] font-bold uppercase tracking-widest">
          Preferred Language
        </label>
        <select
          value={form.preferredLanguage}
          onChange={(e) => {
            const v = e.target.value;
            setForm({ ...form, preferredLanguage: v });
            if (v === "en" || v === "kn" || v === "hi") setLang(v);
          }}
          className={AUTH_INPUT + " w-full"}
          disabled={submitting}
        >
          {LANGS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>

        <ErrorBox msg={error} />

        <Button
          type="button"
          onClick={() => onSubmit(form)}
          disabled={!valid || submitting}
          className="nb-press mt-5 h-11 w-full rounded-none border-2 border-[#141414] bg-[#2fa35c] font-display uppercase text-white hover:bg-[#288a4e]"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            <>
              {t("authSaveContinue")} <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </>
  );
}
