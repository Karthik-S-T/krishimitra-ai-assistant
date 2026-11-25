import { motion } from "framer-motion";

/** Green/yellow KrishiMitra header used by every auth step card. */
export function StepHeader({
  bg,
  title,
  subtitle,
  onLogoClick,
}: {
  bg: string;
  title: string;
  subtitle: string;
  onLogoClick?: () => void;
}) {
  return (
    <div
      className={`border-b-2 border-[#141414] px-6 py-6 text-center ${bg}`}
    >
      <div
        className="nb-shadow-sm mx-auto grid h-14 w-14 cursor-pointer place-items-center border-2 border-[#141414] bg-[#ffc53d] text-2xl"
        onClick={onLogoClick}
        title="KrishiMitra AI"
      >
        🌾
      </div>
      <p className="font-display mt-3 text-xl uppercase text-[#141414]">
        {title}
      </p>
      <p className="mt-1 text-xs font-semibold text-[#141414]/80">{subtitle}</p>
    </div>
  );
}

export function ErrorBox({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-border mt-3 bg-[#d64545] px-3 py-2 text-xs font-bold text-white"
    >
      ⚠ {msg}
    </motion.p>
  );
}

export function InfoBox({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-border mt-3 bg-[#2fa35c] px-3 py-2 text-xs font-bold text-white"
    >
      ✓ {msg}
    </motion.p>
  );
}

/** Shared input style for all auth fields. */
export const AUTH_INPUT =
  "h-11 rounded-none border-2 border-[#141414] bg-white font-semibold shadow-[3px_3px_0_#141414]";
