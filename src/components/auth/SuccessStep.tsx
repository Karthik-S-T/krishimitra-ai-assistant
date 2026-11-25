import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

/** Purely visual — the parent page controls when to advance. */
export function SuccessStep() {
  return (
    <div className="flex flex-col items-center gap-4 bg-[#2fa35c] px-6 py-12 text-white">
      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
      >
        <CheckCircle2 className="h-16 w-16" strokeWidth={2.5} />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="text-center"
      >
        <p className="font-display text-xl uppercase">Login Successful</p>
        <p className="mt-1 text-sm font-semibold text-white/90">
          Welcome to KrishiMitra AI 🌾
        </p>
      </motion.div>
    </div>
  );
}
