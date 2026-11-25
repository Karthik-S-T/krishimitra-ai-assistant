import { motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { ErrorBox, InfoBox, StepHeader } from "./ui";
import type { Method } from "./MethodStep";

const maskPhone = (p: string) =>
  p.length === 13 ? `+91 ${p.slice(3, 8)} ${p.slice(8)}` : p;

interface Props {
  t: (key: string, params?: Record<string, string | number>) => string;
  method: Method;
  email: string;
  phone: string;
  otp: string;
  setOtp: (v: string) => void;
  isLoading: boolean;
  error: string | null;
  info: string | null;
  resent: boolean;
  cooldown: number;
  expiresIn: number;
  onVerify: () => void;
  onResend: () => void;
  onChange: () => void;
}

export function OtpStep({
  t,
  method,
  email,
  phone,
  otp,
  setOtp,
  isLoading,
  error,
  info,
  resent,
  cooldown,
  expiresIn,
  onVerify,
  onResend,
  onChange,
}: Props) {
  const maskedId = method === "email" ? email : maskPhone(phone);
  const expired = expiresIn <= 0;
  const expiryText = expired
    ? "This code has expired — resend to get a new one."
    : `Code expires in ${Math.floor(expiresIn / 60)}:${String(expiresIn % 60).padStart(2, "0")}`;

  return (
    <>
      <StepHeader
        bg={method === "email" ? "bg-[#5fa8e8]" : "bg-[#e2694e]"}
        title={method === "email" ? "Verify Email" : "Verify Mobile"}
        subtitle={`OTP has been sent to: ${maskedId}`}
        onLogoClick={() => window.location.assign("/")}
      />
      <div className="px-6 py-6">
        <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-widest">
          Enter 6-digit OTP
        </p>
        <div className="flex justify-center">
          <InputOTP
            value={otp}
            onChange={setOtp}
            maxLength={6}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                onVerify();
              }
            }}
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }).map((_, i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <p className="mt-2 text-center text-[10px] font-medium text-[#5c574b]">
          Auto-advances as you type · paste the full code anywhere
        </p>

        <ErrorBox msg={error} />
        {resent ? (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="nb-border mt-3 bg-[#ffc53d] px-3 py-2 text-xs font-bold text-[#141414]"
          >
            ✓ A new code has been sent.
          </motion.p>
        ) : (
          <InfoBox msg={info} />
        )}

        {/* expiry + resend cooldown */}
        <p className="mt-3 text-center text-[11px] font-semibold text-[#5c574b]">
          {expiryText}
        </p>
        <p className="mt-1 text-center text-[11px] font-semibold text-[#5c574b]">
          {cooldown > 0 ? (
            `Resend OTP in ${cooldown}s`
          ) : (
            <button
              type="button"
              onClick={onResend}
              disabled={isLoading}
              className="font-bold uppercase underline"
            >
              Resend OTP
            </button>
          )}
        </p>

        {/* VERIFY OTP — clearly visible */}
        <Button
          type="button"
          onClick={onVerify}
          disabled={isLoading || otp.length !== 6 || expired}
          className="nb-press mt-4 h-11 w-full rounded-none border-2 border-[#141414] bg-[#2fa35c] font-display uppercase text-white hover:bg-[#288a4e]"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("verifying")}
            </>
          ) : (
            <>
              {t("verify")} <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={onChange}
          disabled={isLoading}
          className="mt-2 w-full rounded-none font-bold uppercase"
        >
          {method === "email" ? t("diffEmail") : "Change Number"}
        </Button>
      </div>
    </>
  );
}
