import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2, Mail, Smartphone, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AUTH_INPUT, ErrorBox, InfoBox, StepHeader } from "./ui";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Indian mobiles start with 6-9, exactly 10 digits. */
export const IN_MOBILE_RE = /^[6-9]\d{9}$/;
export const digitsOnly = (s: string) => s.replace(/\D/g, "");

export type Method = "email" | "phone";

interface Props {
  t: (key: string, params?: Record<string, string | number>) => string;
  method: Method;
  setMethod: (m: Method) => void;
  email: string;
  setEmail: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  isLoading: boolean;
  error: string | null;
  info: string | null;
  onContinue: () => void;
  onGuest: () => void;
}

export function MethodStep({
  t,
  method,
  setMethod,
  email,
  setEmail,
  phone,
  setPhone,
  isLoading,
  error,
  info,
  onContinue,
  onGuest,
}: Props) {
  const valid =
    method === "email" ? EMAIL_RE.test(email.trim()) : IN_MOBILE_RE.test(phone);

  const hint =
    method === "email"
      ? "Please enter a valid email address."
      : "Enter a valid 10-digit Indian mobile number (starts 6-9).";

  return (
    <>
      <StepHeader
        bg="bg-[#2fa35c]"
        title="KrishiMitra AI"
        subtitle={t("authSub")}
        onLogoClick={() => (window.location.href = "/")}
      />
      <div className="px-6 py-6">
        {/* STEP 1 — login method selector */}
        <div className="nb-border grid grid-cols-2 bg-[#ede7d8] p-1">
          {(
            [
              { id: "email", label: "📧 Email" },
              { id: "phone", label: "📱 Phone" },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={`flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold uppercase tracking-wide transition-all duration-200 ${
                method === m.id
                  ? "nb-shadow-sm bg-[#2fa35c] text-white"
                  : "text-[#5c574b] hover:bg-white"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {method === "email" ? (
            <motion.div
              key="email"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <label className="mb-2 mt-5 block text-[11px] font-bold uppercase tracking-widest">
                Email
              </label>
              <Input
                placeholder="Enter your email address"
                type="email"
                inputMode="email"
                autoComplete="email"
                className={AUTH_INPUT}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && valid && !isLoading) onContinue();
                }}
              />
              {email.trim() !== "" && !EMAIL_RE.test(email.trim()) && (
                <p className="mt-1.5 text-[11px] font-semibold text-[#d64545]">
                  {hint}
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <label className="mb-2 mt-5 block text-[11px] font-bold uppercase tracking-widest">
                Phone Number
              </label>
              <div className="flex gap-2">
                <span className="nb-border grid h-11 shrink-0 place-items-center bg-[#ede7d8] px-3 text-sm font-bold">
                  +91
                </span>
                <Input
                  placeholder="Enter 10-digit mobile number"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  className={AUTH_INPUT}
                  value={phone}
                  onChange={(e) =>
                    setPhone(digitsOnly(e.target.value).slice(0, 10))
                  }
                  disabled={isLoading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && valid && !isLoading) onContinue();
                  }}
                />
              </div>
              {phone !== "" && !IN_MOBILE_RE.test(phone) && (
                <p className="mt-1.5 text-[11px] font-semibold text-[#d64545]">
                  {hint}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <ErrorBox msg={error} />
        <InfoBox msg={info} />

        {/* primary CTA — clearly visible */}
        <Button
          type="button"
          onClick={onContinue}
          disabled={isLoading || !valid}
          className="nb-press mt-5 h-11 w-full rounded-none border-2 border-[#141414] bg-[#2fa35c] font-display uppercase text-white hover:bg-[#288a4e]"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
            </>
          ) : method === "email" ? (
            <>
              {t("authContinue")} <ArrowRight className="ml-2 h-4 w-4" />
            </>
          ) : (
            <>
              {t("authSendOtp")} <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>

        {/* divider */}
        <div className="relative mt-5">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t-2 border-dashed border-[#141414]/30" />
          </div>
          <div className="relative flex justify-center">
            <span className="nb-chip bg-[#ede7d8]">{t("orDivider")}</span>
          </div>
        </div>

        {/* guest — fully functional (anonymous session) */}
        <Button
          type="button"
          variant="outline"
          className="nb-press mt-5 h-11 w-full rounded-none border-2 border-[#141414] bg-white font-bold uppercase"
          onClick={onGuest}
          disabled={isLoading}
        >
          <UserX className="mr-2 h-4 w-4" />
          {t("guestBtn")}
        </Button>
      </div>
    </>
  );
}
