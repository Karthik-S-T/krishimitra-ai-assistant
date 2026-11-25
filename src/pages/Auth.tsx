import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Leaf, Loader2, UserRound } from "lucide-react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/context/LanguageContext";
import { MethodStep } from "@/components/auth/MethodStep";
import { OtpStep } from "@/components/auth/OtpStep";
import { ProfileStep } from "@/components/auth/ProfileStep";
import { SuccessStep } from "@/components/auth/SuccessStep";
import {
  createDemoAccount,
  createDemoGuest,
  DemoAuthError,
  isDemoAuthEnabled,
  recoverDemoPassword,
  signInDemoAccount,
} from "@/lib/demoAuth";
import type { DemoAuthErrorCode } from "@/lib/demoAuth";
import type { Lang } from "@/lib/i18n";

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Indian mobiles start with 6-9 and are exactly 10 digits. */
export const IN_MOBILE_RE = /^[6-9]\d{9}$/;
export const digitsOnly = (s: string) => s.replace(/\D/g, "");
export const maskPhone = (p: string) =>
  p.length === 13 ? `+91 ${p.slice(3, 8)} ${p.slice(8)}` : p;

export const OTP_EXPIRY_S = 600; // matches provider maxAge (10 minutes)
export const OTP_RESEND_COOLDOWN_S = 30;

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

export type Method = "email" | "phone";

type Step =
  | { kind: "method" }
  | { kind: "otp"; method: Method }
  | { kind: "success" }
  | { kind: "profile" };

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

type DemoAuthMode = "login" | "create" | "recover";

type AuthFeedbackKey =
  | DemoAuthErrorCode
  | "passwordMismatch"
  | "operationFailed"
  | "invalidEmail"
  | "invalidPhone"
  | "emailSendFailed"
  | "phoneSendFailed"
  | "otpRequired"
  | "otpExpired"
  | "otpInvalid"
  | "guestFailed"
  | "profileSaveFailed";

const DEMO_AUTH_COPY: Record<Lang, {
  signIn: string;
  create: string;
  recover: string;
  fullName: string;
  identifier: string;
  namePlaceholder: string;
  identifierPlaceholder: string;
  password: string;
  newPassword: string;
  confirmPassword: string;
  passwordPlaceholder: string;
  newPasswordPlaceholder: string;
  confirmPasswordPlaceholder: string;
  forgot: string;
  guest: string;
  submitLogin: string;
  submitCreate: string;
  submitRecover: string;
  back: string;
  intro: string;
  description: string;
  subtitle: string;
  welcomeTitle: string;
  demoMode: string;
  guestAccess: string;
  languageLabel: string;
  authOptions: string;
  guestDivider: string;
  loading: string;
  passwordUpdated: string;
  codeSentEmail: string;
  codeSentPhone: string;
  showPassword: string;
  hidePassword: string;
  errors: Record<AuthFeedbackKey, string>;
}> = {
  en: {
    signIn: "Sign in",
    create: "Create account",
    recover: "Reset password",
    fullName: "Full name",
    identifier: "Username, email, or phone",
    namePlaceholder: "Enter your full name",
    identifierPlaceholder: "e.g. farmer123, 9876543210, or you@example.com",
    password: "Password",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    passwordPlaceholder: "Enter your password",
    newPasswordPlaceholder: "Choose a new password",
    confirmPasswordPlaceholder: "Enter the password again",
    forgot: "Forgot password?",
    guest: "Continue as Guest Farmer (Instant Demo)",
    submitLogin: "Sign in",
    submitCreate: "Create account",
    submitRecover: "Update password",
    back: "Back to sign in",
    intro: "Your farm tools, ready when you are.",
    description: "Create an account on this device, or continue as a guest to explore the farmer demo.",
    subtitle: "Sign in to continue to your farmer dashboard.",
    welcomeTitle: "Welcome back, farmer",
    demoMode: "KrishiMitra AI · Demo mode",
    guestAccess: "guest access",
    languageLabel: "Choose language",
    authOptions: "Authentication options",
    guestDivider: "or explore without an account",
    loading: "Loading sign-in…",
    passwordUpdated: "Password updated on this device. Sign in with your new password.",
    codeSentEmail: "Code sent to {value}",
    codeSentPhone: "Code sent to {value}",
    showPassword: "Show password",
    hidePassword: "Hide password",
    errors: {
      identifierRequired: "Enter your username, email, or phone number.",
      nameRequired: "Enter your full name.",
      passwordTooShort: "Use a password with at least 8 characters.",
      passwordMismatch: "The passwords do not match.",
      accountExists: "An account already exists for that username, email, or phone on this device.",
      invalidCredentials: "Username or password is incorrect.",
      accountMissing: "No local account was found for that username, email, or phone.",
      secureStorageUnavailable: "Secure password storage is unavailable in this browser.",
      accountDataInvalid: "Local account data is invalid. Clear this browser’s demo account data and try again.",
      operationFailed: "Could not complete the request. Please try again.",
      invalidEmail: "Please enter a valid email address.",
      invalidPhone: "Enter a valid 10-digit Indian mobile number (starts 6-9).",
      emailSendFailed: "Could not send the verification code. Please try again.",
      phoneSendFailed: "Could not send the OTP. Check the number and try again.",
      otpRequired: "Enter the complete 6-digit code.",
      otpExpired: "This code has expired. Please resend a new code.",
      otpInvalid: "Incorrect or expired code. Please try again.",
      guestFailed: "Failed to start guest mode. Please try again.",
      profileSaveFailed: "Could not save your profile. Please try again.",
    },
  },
  kn: {
    signIn: "ಸೈನ್ ಇನ್",
    create: "ಖಾತೆ ರಚಿಸಿ",
    recover: "ಪಾಸ್‌ವರ್ಡ್ ಮರುಹೊಂದಿಸಿ",
    fullName: "ಪೂರ್ಣ ಹೆಸರು",
    identifier: "ಬಳಕೆದಾರ ಹೆಸರು, ಇಮೇಲ್ ಅಥವಾ ಫೋನ್",
    namePlaceholder: "ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರನ್ನು ನಮೂದಿಸಿ",
    identifierPlaceholder: "ಉದಾ: ರೈತ123, 9876543210 ಅಥವಾ you@example.com",
    password: "ಪಾಸ್‌ವರ್ಡ್",
    newPassword: "ಹೊಸ ಪಾಸ್‌ವರ್ಡ್",
    confirmPassword: "ಪಾಸ್‌ವರ್ಡ್ ದೃಢೀಕರಿಸಿ",
    passwordPlaceholder: "ನಿಮ್ಮ ಪಾಸ್‌ವರ್ಡ್ ನಮೂದಿಸಿ",
    newPasswordPlaceholder: "ಹೊಸ ಪಾಸ್‌ವರ್ಡ್ ಆಯ್ಕೆಮಾಡಿ",
    confirmPasswordPlaceholder: "ಪಾಸ್‌ವರ್ಡ್ ಅನ್ನು ಮತ್ತೆ ನಮೂದಿಸಿ",
    forgot: "ಪಾಸ್‌ವರ್ಡ್ ಮರೆತಿರಾ?",
    guest: "ಅತಿಥಿ ರೈತರಾಗಿ ಮುಂದುವರಿಯಿರಿ (ತಕ್ಷಣದ ಡೆಮೋ)",
    submitLogin: "ಸೈನ್ ಇನ್",
    submitCreate: "ಖಾತೆ ರಚಿಸಿ",
    submitRecover: "ಪಾಸ್‌ವರ್ಡ್ ಬದಲಿಸಿ",
    back: "ಸೈನ್ ಇನ್‌ಗೆ ಹಿಂತಿರುಗಿ",
    intro: "ನಿಮ್ಮ ಕೃಷಿ ಸಾಧನಗಳು, ನಿಮಗಾಗಿ ಸಿದ್ಧವಾಗಿವೆ.",
    description: "ಈ ಸಾಧನದಲ್ಲಿ ಖಾತೆ ರಚಿಸಿ ಅಥವಾ ರೈತ ಡೆಮೋ ನೋಡಲು ಅತಿಥಿಯಾಗಿ ಮುಂದುವರಿಯಿರಿ.",
    subtitle: "ನಿಮ್ಮ ರೈತ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ ಮುಂದುವರಿಯಲು ಸೈನ್ ಇನ್ ಮಾಡಿ.",
    welcomeTitle: "ಮತ್ತೆ ಸ್ವಾಗತ, ರೈತರೆ",
    demoMode: "ಕೃಷಿಮಿತ್ರ AI · ಡೆಮೋ ಮೋಡ್",
    guestAccess: "ಅತಿಥಿ ಪ್ರವೇಶ",
    languageLabel: "ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ",
    authOptions: "ದೃಢೀಕರಣ ಆಯ್ಕೆಗಳು",
    guestDivider: "ಖಾತೆಯಿಲ್ಲದೆ ಡೆಮೋ ನೋಡಿ",
    loading: "ಸೈನ್ ಇನ್ ತೆರೆಯಲಾಗುತ್ತಿದೆ…",
    passwordUpdated: "ಈ ಸಾಧನದಲ್ಲಿ ಪಾಸ್‌ವರ್ಡ್ ಬದಲಾಗಿದೆ. ಹೊಸ ಪಾಸ್‌ವರ್ಡ್ ಬಳಸಿ ಸೈನ್ ಇನ್ ಮಾಡಿ.",
    codeSentEmail: "{value} ಗೆ ಕೋಡ್ ಕಳುಹಿಸಲಾಗಿದೆ",
    codeSentPhone: "{value} ಗೆ ಕೋಡ್ ಕಳುಹಿಸಲಾಗಿದೆ",
    showPassword: "ಪಾಸ್‌ವರ್ಡ್ ತೋರಿಸಿ",
    hidePassword: "ಪಾಸ್‌ವರ್ಡ್ ಮರೆಮಾಡಿ",
    errors: {
      identifierRequired: "ನಿಮ್ಮ ಬಳಕೆದಾರ ಹೆಸರು, ಇಮೇಲ್ ಅಥವಾ ಫೋನ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ.",
      nameRequired: "ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರನ್ನು ನಮೂದಿಸಿ.",
      passwordTooShort: "ಕನಿಷ್ಠ 8 ಅಕ್ಷರಗಳ ಪಾಸ್‌ವರ್ಡ್ ಬಳಸಿ.",
      passwordMismatch: "ಪಾಸ್‌ವರ್ಡ್‌ಗಳು ಹೊಂದಿಕೆಯಾಗುತ್ತಿಲ್ಲ.",
      accountExists: "ಈ ಸಾಧನದಲ್ಲಿ ಈ ಬಳಕೆದಾರ ಹೆಸರು, ಇಮೇಲ್ ಅಥವಾ ಫೋನ್‌ಗೆ ಖಾತೆ ಈಗಾಗಲೇ ಇದೆ.",
      invalidCredentials: "ಬಳಕೆದಾರ ಹೆಸರು ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್ ಸರಿಯಿಲ್ಲ.",
      accountMissing: "ಈ ಬಳಕೆದಾರ ಹೆಸರು, ಇಮೇಲ್ ಅಥವಾ ಫೋನ್‌ಗೆ ಸ್ಥಳೀಯ ಖಾತೆ ಕಂಡುಬಂದಿಲ್ಲ.",
      secureStorageUnavailable: "ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಸುರಕ್ಷಿತ ಪಾಸ್‌ವರ್ಡ್ ಸಂಗ್ರಹಣೆ ಲಭ್ಯವಿಲ್ಲ.",
      accountDataInvalid: "ಸ್ಥಳೀಯ ಖಾತೆ ಮಾಹಿತಿ ಸರಿಯಿಲ್ಲ. ಡೆಮೋ ಖಾತೆ ಮಾಹಿತಿಯನ್ನು ತೆರವುಗೊಳಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
      operationFailed: "ವಿನಂತಿಯನ್ನು ಪೂರ್ಣಗೊಳಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
      invalidEmail: "ದಯವಿಟ್ಟು ಸರಿಯಾದ ಇಮೇಲ್ ವಿಳಾಸ ನಮೂದಿಸಿ.",
      invalidPhone: "6-9 ಅಂಕಿಯಿಂದ ಆರಂಭವಾಗುವ 10 ಅಂಕಿಗಳ ಭಾರತೀಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ.",
      emailSendFailed: "ಪರಿಶೀಲನಾ ಕೋಡ್ ಕಳುಹಿಸಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
      phoneSendFailed: "OTP ಕಳುಹಿಸಲಾಗಲಿಲ್ಲ. ಸಂಖ್ಯೆಯನ್ನು ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
      otpRequired: "ಪೂರ್ಣ 6 ಅಂಕಿಗಳ ಕೋಡ್ ನಮೂದಿಸಿ.",
      otpExpired: "ಈ ಕೋಡ್ ಅವಧಿ ಮುಗಿದಿದೆ. ಹೊಸ ಕೋಡ್ ಕಳುಹಿಸಿ.",
      otpInvalid: "ಕೋಡ್ ತಪ್ಪಾಗಿದೆ ಅಥವಾ ಅವಧಿ ಮುಗಿದಿದೆ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
      guestFailed: "ಅತಿಥಿ ಮೋಡ್ ಪ್ರಾರಂಭಿಸಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
      profileSaveFailed: "ಪ್ರೊಫೈಲ್ ಉಳಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    },
  },
  hi: {
    signIn: "साइन इन",
    create: "खाता बनाएँ",
    recover: "पासवर्ड रीसेट करें",
    fullName: "पूरा नाम",
    identifier: "यूज़रनेम, ईमेल या फ़ोन",
    namePlaceholder: "अपना पूरा नाम दर्ज करें",
    identifierPlaceholder: "जैसे किसान123, 9876543210 या you@example.com",
    password: "पासवर्ड",
    newPassword: "नया पासवर्ड",
    confirmPassword: "पासवर्ड की पुष्टि करें",
    passwordPlaceholder: "अपना पासवर्ड दर्ज करें",
    newPasswordPlaceholder: "नया पासवर्ड चुनें",
    confirmPasswordPlaceholder: "पासवर्ड फिर से दर्ज करें",
    forgot: "पासवर्ड भूल गए?",
    guest: "अतिथि किसान के रूप में जारी रखें (तुरंत डेमो)",
    submitLogin: "साइन इन",
    submitCreate: "खाता बनाएँ",
    submitRecover: "पासवर्ड बदलें",
    back: "साइन इन पर वापस जाएँ",
    intro: "आपके खेती के साधन, आपके लिए तैयार हैं।",
    description: "इस डिवाइस पर खाता बनाएँ या किसान डेमो देखने के लिए अतिथि के रूप में जारी रखें।",
    subtitle: "अपने किसान डैशबोर्ड पर जाने के लिए साइन इन करें।",
    welcomeTitle: "किसान साथियों, आपका स्वागत है",
    demoMode: "कृषिमित्र AI · डेमो मोड",
    guestAccess: "अतिथि प्रवेश",
    languageLabel: "भाषा चुनें",
    authOptions: "प्रमाणीकरण विकल्प",
    guestDivider: "बिना खाते डेमो देखें",
    loading: "साइन-इन खुल रहा है…",
    passwordUpdated: "इस डिवाइस पर पासवर्ड बदल गया है। नए पासवर्ड से साइन इन करें।",
    codeSentEmail: "{value} पर कोड भेजा गया",
    codeSentPhone: "{value} पर कोड भेजा गया",
    showPassword: "पासवर्ड दिखाएँ",
    hidePassword: "पासवर्ड छिपाएँ",
    errors: {
      identifierRequired: "अपना यूज़रनेम, ईमेल या फ़ोन नंबर दर्ज करें।",
      nameRequired: "अपना पूरा नाम दर्ज करें।",
      passwordTooShort: "कम से कम 8 अक्षरों का पासवर्ड रखें।",
      passwordMismatch: "दोनों पासवर्ड मेल नहीं खाते।",
      accountExists: "इस डिवाइस पर इस यूज़रनेम, ईमेल या फ़ोन का खाता पहले से मौजूद है।",
      invalidCredentials: "यूज़रनेम या पासवर्ड सही नहीं है।",
      accountMissing: "इस यूज़रनेम, ईमेल या फ़ोन का स्थानीय खाता नहीं मिला।",
      secureStorageUnavailable: "इस ब्राउज़र में सुरक्षित पासवर्ड संग्रह उपलब्ध नहीं है।",
      accountDataInvalid: "स्थानीय खाता जानकारी अमान्य है। डेमो खाता डेटा हटाकर फिर प्रयास करें।",
      operationFailed: "अनुरोध पूरा नहीं हुआ। कृपया फिर से प्रयास करें।",
      invalidEmail: "कृपया सही ईमेल पता दर्ज करें।",
      invalidPhone: "6-9 से शुरू होने वाला 10 अंकों का भारतीय मोबाइल नंबर दर्ज करें।",
      emailSendFailed: "सत्यापन कोड नहीं भेजा जा सका। कृपया फिर प्रयास करें।",
      phoneSendFailed: "OTP नहीं भेजा जा सका। नंबर जाँचकर फिर प्रयास करें।",
      otpRequired: "पूरा 6 अंकों का कोड दर्ज करें।",
      otpExpired: "इस कोड की समय-सीमा समाप्त हो गई है। नया कोड भेजें।",
      otpInvalid: "कोड गलत है या उसकी समय-सीमा समाप्त हो गई है। फिर प्रयास करें।",
      guestFailed: "अतिथि मोड शुरू नहीं हो सका। कृपया फिर प्रयास करें।",
      profileSaveFailed: "प्रोफ़ाइल सहेजी नहीं जा सकी। कृपया फिर प्रयास करें।",
    },
  },
};

function AuthLanguageBar({
  lang,
  setLang,
}: {
  lang: Lang;
  setLang: (lang: Lang) => void;
}) {
  return (
    <div role="group" aria-label={DEMO_AUTH_COPY[lang].languageLabel} className="flex items-center rounded-full border border-[#1B4332]/20 bg-[#F6FBF8] p-1 shadow-md">
      {([
        { id: "kn", label: "ಕನ್ನಡ" },
        { id: "hi", label: "हिन्दी" },
        { id: "en", label: "English" },
      ] as const).map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => setLang(option.id)}
          aria-pressed={lang === option.id}
          className={`rounded-full px-3 py-2 text-xs font-extrabold transition-colors sm:px-5 sm:text-sm ${lang === option.id ? "bg-[#1B4332] text-[#FDE68A] shadow" : "text-[#1B4332] hover:bg-[#DDEBE1]"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DemoAuth({ redirectAfterAuth }: AuthProps = {}) {
  const navigate = useNavigate();
  const { lang, setLang } = useLang();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(searchParams.get("returnTo"), redirectAfterAuth);
  const [mode, setMode] = useState<DemoAuthMode>("login");
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<AuthFeedbackKey | null>(null);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const copy = DEMO_AUTH_COPY[lang];

  const changeMode = (next: DemoAuthMode) => {
    setMode(next);
    setErrorKey(null);
    setPasswordUpdated(false);
    setPassword("");
    setConfirmPassword("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorKey(null);
    setPasswordUpdated(false);
    if (!identifier.trim()) {
      setErrorKey("identifierRequired");
      return;
    }
    if (password.length < 8) {
      setErrorKey("passwordTooShort");
      return;
    }
    if (mode === "create" && name.trim().length < 2) {
      setErrorKey("nameRequired");
      return;
    }
    if (mode !== "login" && password !== confirmPassword) {
      setErrorKey("passwordMismatch");
      return;
    }

    setBusy(true);
    try {
      if (mode === "create") {
        await createDemoAccount(name, identifier, password);
        navigate(redirect);
      } else if (mode === "recover") {
        await recoverDemoPassword(identifier, password);
        changeMode("login");
        setPasswordUpdated(true);
      } else {
        await signInDemoAccount(identifier, password);
        navigate(redirect);
      }
    } catch (reason) {
      setErrorKey(reason instanceof DemoAuthError ? reason.code : "operationFailed");
    } finally {
      setBusy(false);
    }
  };

  const guestLogin = () => {
    if (busy) return;
    setErrorKey(null);
    try {
      createDemoGuest();
      navigate(redirect);
    } catch (reason) {
      setErrorKey(reason instanceof DemoAuthError ? reason.code : "operationFailed");
    }
  };

  const title = mode === "create"
    ? copy.create
    : mode === "recover"
      ? copy.recover
      : copy.welcomeTitle;

  return (
    <div className="nb-dots relative min-h-screen bg-[#E9F2EC] px-4 pb-10 pt-24 text-[#102318]">
      <div className="absolute inset-x-0 top-4 z-20 flex justify-center px-3">
        <AuthLanguageBar lang={lang} setLang={setLang} />
      </div>
      <div className="mx-auto grid min-h-[80vh] max-w-5xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.section
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden rounded-3xl bg-gradient-to-br from-[#0F2E1D] via-[#1B4332] to-[#356B4B] p-10 text-white shadow-xl lg:block"
        >
          <div className="mb-8 grid size-16 place-items-center rounded-2xl border border-white/20 bg-white/10">
            <Leaf className="size-9 text-[#FDE68A]" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FDE68A]">{copy.demoMode}</p>
          <h1 className="mt-4 font-display text-4xl leading-tight">{copy.intro}</h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/80">{copy.description}</p>
          <div className="mt-8 grid grid-cols-3 gap-3 text-center">
            {(lang === "kn" ? ["ಮಣ್ಣಿನ ಮಾಹಿತಿ", "ಬೆಳೆ ಯೋಜನೆ", "ಮಾರುಕಟ್ಟೆ ಅಂದಾಜು"] : lang === "hi" ? ["मिट्टी जानकारी", "फसल योजना", "बाज़ार अनुमान"] : ["Soil insights", "Crop plans", "Market estimates"]).map((item) => (
              <span key={item} className="rounded-xl border border-white/15 bg-white/10 px-3 py-4 text-xs font-bold">{item}</span>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-[#1B4332]/15 bg-[#F6FBF8] shadow-[0_20px_60px_-35px_rgba(16,35,24,0.65)]"
        >
          <div className="bg-gradient-to-r from-[#0F2E1D] to-[#1B4332] px-6 py-6 text-white">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-white/10"><SproutIcon /></span>
              <div>
                <p className="font-display text-xl uppercase">KrishiMitra AI</p>
                <p className="text-xs text-white/70">{copy.signIn} · {copy.create} · {copy.guestAccess}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 border-b border-[#1B4332]/10 bg-[#E9F2EC] p-2" role="tablist" aria-label={copy.authOptions}>
            {(["login", "create"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={mode === tab || (mode === "recover" && tab === "login")}
                onClick={() => changeMode(tab)}
                className={`rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${(mode === tab || (mode === "recover" && tab === "login")) ? "bg-[#1B4332] text-white shadow" : "text-[#1B4332] hover:bg-white/70"}`}
              >
                {tab === "login" ? copy.signIn : copy.create}
              </button>
            ))}
          </div>
          <form noValidate onSubmit={(event) => void submit(event)} className="space-y-4 p-6">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                <div>
                  <h2 className="font-display text-2xl">{title}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-[#496352]">
                    {mode === "recover"
                      ? (lang === "kn" ? "ಈ ಸಾಧನದಲ್ಲಿರುವ ಡೆಮೋ ಖಾತೆಯ ಪಾಸ್‌ವರ್ಡ್ ಬದಲಾಗುತ್ತದೆ; ಇಮೇಲ್ ಕಳುಹಿಸಲಾಗುವುದಿಲ್ಲ." : lang === "hi" ? "इस डिवाइस के डेमो खाते का पासवर्ड बदलेगा; कोई ईमेल नहीं भेजा जाएगा।" : "This changes the demo password saved on this device; no email is sent.")
                      : mode === "login"
                        ? copy.subtitle
                        : copy.description}
                  </p>
                </div>
                {mode === "create" && (
                  <label className="block text-xs font-bold">
                    {copy.fullName}
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="name"
                      placeholder={copy.namePlaceholder}
                      className="nb-input mt-1.5"
                      disabled={busy}
                      required
                    />
                  </label>
                )}
                <label className="block text-xs font-bold">
                  {copy.identifier}
                  <Input
                    type="text"
                    autoComplete="username"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder={copy.identifierPlaceholder}
                    className="nb-input mt-1.5"
                    disabled={busy}
                    required
                  />
                </label>
                <label className="block text-xs font-bold">
                  {mode === "recover" ? copy.newPassword : copy.password}
                  <span className="relative mt-1.5 block">
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={mode === "recover" ? copy.newPasswordPlaceholder : copy.passwordPlaceholder}
                      className="nb-input pr-11"
                      disabled={busy}
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((shown) => !shown)}
                      aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                      title={showPassword ? copy.hidePassword : copy.showPassword}
                      className="absolute inset-y-0 right-0 grid w-10 place-items-center text-[#496352] hover:text-[#1B4332]"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </span>
                </label>
                {mode !== "login" && (
                  <label className="block text-xs font-bold">
                    {copy.confirmPassword}
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder={copy.confirmPasswordPlaceholder}
                      className="nb-input mt-1.5"
                      disabled={busy}
                      minLength={8}
                      required
                    />
                  </label>
                )}
                {errorKey && (
                  <p role="alert" className="rounded-xl border border-[#B45309]/20 bg-[#FEF3C7] px-3 py-2 text-xs font-semibold text-[#854D0E]">
                    {copy.errors[errorKey]}
                  </p>
                )}
                {passwordUpdated && (
                  <p role="status" className="rounded-xl border border-[#1B4332]/15 bg-[#DDF1E4] px-3 py-2 text-xs font-semibold text-[#1B4332]">
                    {copy.passwordUpdated}
                  </p>
                )}
                <Button type="submit" disabled={busy} className="w-full rounded-xl bg-[#1B4332] py-5 font-bold text-white transition-colors hover:bg-[#0F2E1D]">
                  {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ArrowRight className="mr-2 size-4" />}
                  {mode === "create" ? copy.submitCreate : mode === "recover" ? copy.submitRecover : copy.submitLogin}
                </Button>
                {mode === "login" && (
                  <div className="flex flex-wrap justify-between gap-2 text-xs font-semibold text-[#1B4332]">
                    <button type="button" onClick={() => changeMode("recover")} className="underline underline-offset-2">{copy.forgot}</button>
                  </div>
                )}
                {mode === "recover" && (
                  <button type="button" onClick={() => changeMode("login")} className="w-full text-center text-xs font-semibold text-[#496352] underline underline-offset-2">
                    {copy.back}
                  </button>
                )}
              </motion.div>
            </AnimatePresence>
            <div className="relative py-1 text-center text-[10px] font-bold uppercase tracking-widest text-[#7B8C7F]">
              <span className="bg-[#F6FBF8] px-2">{copy.guestDivider}</span>
              <span className="absolute inset-x-0 top-1/2 -z-10 border-t border-[#1B4332]/15" />
            </div>
            <Button type="button" variant="outline" onClick={guestLogin} disabled={busy} className="w-full rounded-xl border-2 border-[#D97706]/50 bg-[#FFF8E1] py-5 font-bold text-[#1B4332] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#D97706] hover:bg-[#FEF3C7]">
              <UserRound className="mr-2 size-4" /> {copy.guest}
            </Button>
          </form>
        </motion.section>
      </div>
    </div>
  );
}

function SproutIcon() {
  return <Leaf className="size-6 text-[#FDE68A]" />;
}

function CloudAuth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const { t, lang, setLang } = useLang();
  const copy = DEMO_AUTH_COPY[lang];
  const navigate = useNavigate();
  const hasConvexUrl = !isDemoAuthEnabled();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const completeProfile = useMutation(api.profile.completeProfile);
  const profileStatus = useQuery(api.profile.profileStatus, hasConvexUrl ? {} : "skip");

  const [step, setStep] = useState<Step>({ kind: "method" });
  const [method, setMethod] = useState<Method>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [expiresIn, setExpiresIn] = useState(OTP_EXPIRY_S);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiryRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* After the success animation: first-time farmers complete their profile,
     returning farmers go straight to the dashboard. The query re-fires once
     the new session is authenticated, so profileStatus is authoritative. */
  const advancedFromSuccess = useRef(false);
  useEffect(() => {
    if (step.kind !== "success" || advancedFromSuccess.current) return;
    if (authLoading || profileStatus === undefined) return; // wait for data
    if (!isAuthenticated) return; // session not registered yet
    advancedFromSuccess.current = true;
    if (profileStatus?.needsProfile) {
      const timer = setTimeout(() => setStep({ kind: "profile" }), 1600);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => navigate(redirect), 1600);
    return () => clearTimeout(timer);
  }, [step, authLoading, isAuthenticated, profileStatus, navigate, redirect]);

  const startCooldowns = useCallback(() => {
    setCooldown(OTP_RESEND_COOLDOWN_S);
    setExpiresIn(OTP_EXPIRY_S);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    if (expiryRef.current) clearInterval(expiryRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    expiryRef.current = setInterval(() => {
      setExpiresIn((s) => {
        if (s <= 1) {
          if (expiryRef.current) clearInterval(expiryRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  useEffect(
    () => () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      if (expiryRef.current) clearInterval(expiryRef.current);
    },
    [],
  );

  /* ---------------- actions ---------------- */

  const requestOtp = async (m: Method) => {
    setError(null);
    setInfo(null);
    const valid =
      m === "email" ? EMAIL_RE.test(email.trim()) : IN_MOBILE_RE.test(phone);
    if (!valid) {
      setError(m === "email" ? copy.errors.invalidEmail : copy.errors.invalidPhone);
      return;
    }
    setIsLoading(true);
    try {
      const fd = new FormData();
      const identifier =
        m === "email" ? email.trim().toLowerCase() : `+91${phone}`;
      fd.append(m, identifier);
      await signIn(m === "email" ? "email-otp" : "phone-otp", fd);
      setOtp("");
      setInfo(
        m === "email"
          ? copy.codeSentEmail.replace("{value}", email.trim().toLowerCase())
          : copy.codeSentPhone.replace("{value}", maskPhone(`+91${phone}`)),
      );
      setStep({ kind: "otp", method: m });
      startCooldowns();
    } catch (e) {
      console.error("OTP request error", e);
      setError(m === "email" ? copy.errors.emailSendFailed : copy.errors.phoneSendFailed);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError(null);
    if (otp.length !== 6) {
      setError(copy.errors.otpRequired);
      return;
    }
    if (expiresIn <= 0) {
      setError(copy.errors.otpExpired);
      return;
    }
    setIsLoading(true);
    try {
      const isEmail = step.kind === "otp" && step.method === "email";
      const fd = new FormData();
      fd.append(isEmail ? "email" : "phone", isEmail ? email.trim().toLowerCase() : `+91${phone}`);
      fd.append("code", otp);
      await signIn(isEmail ? "email-otp" : "phone-otp", fd);
      /* Success animation shows briefly; the timer effect decides the next
         step: first-time farmers get profile setup, returning farmers go
         straight to the dashboard. */
      setStep({ kind: "success" });
    } catch (e) {
      console.error("OTP verification error", e);
      setError(copy.errors.otpInvalid);
      setOtp("");
    } finally {
      setIsLoading(false);
    }
  };

  const resendOtp = async () => {
    if (cooldown > 0 || step.kind !== "otp" || isLoading) return;
    setResent(true);
    setTimeout(() => setResent(false), 2500);
    await requestOtp(step.method);
  };

  const guestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (e) {
      console.error("Guest login error:", e);
      setError(copy.errors.guestFailed);
      setIsLoading(false);
    }
  };

  const submitProfile = async (data: {
    name: string;
    village: string;
    district: string;
    state: string;
    preferredLanguage: string;
  }) => {
    setSubmittingProfile(true);
    setProfileError(null);
    try {
      await completeProfile({ ...data });
      navigate(redirect);
    } catch (e) {
      console.error("Profile save error", e);
      setProfileError(copy.errors.profileSaveFailed);
      setSubmittingProfile(false);
    }
  };

  const stepKey =
    step.kind === "otp" ? `otp-${step.method}` : step.kind;

  return (
    <div className="nb-dots relative min-h-screen bg-[#E9F2EC] text-[#102318]">
      <div className="absolute inset-x-0 top-4 z-20 flex justify-center px-3">
        <AuthLanguageBar lang={lang} setLang={setLang} />
      </div>

      <div className="flex min-h-screen items-center justify-center px-4 pb-10 pt-24">
        <motion.div
          key={stepKey}
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="nb-card w-full max-w-sm"
        >
          {step.kind === "method" && (
            <MethodStep
              t={t}
              method={method}
              setMethod={setMethod}
              email={email}
              setEmail={setEmail}
              phone={phone}
              setPhone={setPhone}
              isLoading={isLoading}
              error={error}
              info={info}
              onContinue={() => void requestOtp(method)}
              onGuest={() => void guestLogin()}
            />
          )}

          {step.kind === "otp" && (
            <OtpStep
              t={t}
              method={step.method}
              email={email.trim().toLowerCase()}
              phone={`+91${phone}`}
              otp={otp}
              setOtp={setOtp}
              isLoading={isLoading}
              error={error}
              info={info}
              resent={resent}
              cooldown={cooldown}
              expiresIn={expiresIn}
              onVerify={() => void verifyOtp()}
              onResend={() => void resendOtp()}
              onChange={() => {
                setError(null);
                setInfo(null);
                setOtp("");
                setStep({ kind: "method" });
              }}
            />
          )}

          {step.kind === "success" && <SuccessStep />}

          {step.kind === "profile" && (
            <ProfileStep
              onSubmit={(d) => void submitProfile(d)}
              submitting={submittingProfile}
              error={profileError}
            />
          )}
        </motion.div>

        {/* cream footer — part of the KrishiMitra identity */}
        <p className="mt-6 text-center text-[11px] font-semibold text-[#5c574b]">
          {t("footerNote")}
        </p>
      </div>
    </div>
  );
}

function AuthPageContent(props: AuthProps) {
  return isDemoAuthEnabled() ? <DemoAuth {...props} /> : <CloudAuth {...props} />;
}

export default function AuthPage(props: AuthProps) {
  const { lang } = useLang();
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#E9F2EC] text-[#1B4332]">{DEMO_AUTH_COPY[lang].loading}</div>}>
      <AuthPageContent {...props} />
    </Suspense>
  );
}
