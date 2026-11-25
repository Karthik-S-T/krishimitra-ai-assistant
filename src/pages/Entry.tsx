import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router";
import gsap from "gsap";
import { FarmScene } from "@/components/entry/FarmScene";
import { OVERLAY, DURATION_S } from "@/components/entry/timeline";

/* ------------------------------------------------------------------ */
/* Quality detection (mobile → fewer particles / simpler scene)        */
/* ------------------------------------------------------------------ */

function detectQuality(): "low" | "high" {
  if (typeof window === "undefined") return "high";
  const mobile =
    window.matchMedia("(max-width: 820px)").matches ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency ?? 4;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return mobile || cores <= 4 || reduce ? "low" : "high";
}

/* ------------------------------------------------------------------ */
/* Loading screen                                                      */
/* ------------------------------------------------------------------ */

function LeafLoader() {
  return (
    <div className="relative h-24 w-24">
      {/* rotating ring */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-emerald-200/30 border-t-emerald-400"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
      />
      {/* counter ring */}
      <motion.div
        className="absolute inset-2 rounded-full border-2 border-transparent border-b-lime-300/70"
        animate={{ rotate: -360 }}
        transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
      />
      {/* pulsing leaf */}
      <motion.div
        className="absolute inset-0 grid place-items-center text-3xl"
        animate={{ scale: [1, 1.18, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
      >
        🌱
      </motion.div>
    </div>
  );
}

function Loader({ done }: { done: boolean }) {
  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-[radial-gradient(120%_120%_at_50%_10%,#0d2b1a_0%,#07160f_70%)]"
          exit={{ opacity: 0, scale: 1.06 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        >
          <div className="flex flex-col items-center gap-6">
            <LeafLoader />
            <p className="font-display text-2xl tracking-[0.35em] text-emerald-100">
              KRISHIMITRA
            </p>
            <p className="text-sm font-medium text-emerald-200/70">
              Preparing your farm<span className="animate-pulse">...</span>
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* Camera zoom burst during exit                                       */
/* ------------------------------------------------------------------ */

import { useFrame, useThree } from "@react-three/fiber";
import type * as THREE from "three";

function BurstCamera({ burst }: { burst: React.RefObject<number> }) {
  const { camera } = useThree();
  useFrame(() => {
    const b = burst.current ?? 0;
    if (b > 0) {
      // accelerate forward through the farmer into the light
      camera.position.z -= b * b * 0.55;
      const cam = camera as THREE.PerspectiveCamera;
      cam.fov = 55 + b * 28;
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

/* ------------------------------------------------------------------ */
/* AI feature cards                                                    */
/* ------------------------------------------------------------------ */

const AI_CARDS = [
  { icon: "🌱", label: "Crop Recommendation", pos: "left-[4%] top-[24%]" },
  { icon: "🌦️", label: "Weather Forecast", pos: "right-[4%] top-[20%]" },
  { icon: "🧪", label: "Soil Analysis", pos: "left-[7%] top-[46%]" },
  { icon: "🐛", label: "Disease Detection", pos: "right-[7%] top-[44%]" },
  { icon: "📈", label: "Market Prices", pos: "left-[10%] bottom-[18%]" },
  { icon: "🎙️", label: "AI Voice Assistant", pos: "right-[10%] bottom-[20%]" },
] as const;

function AiCards({ show }: { show: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 hidden sm:block">
      {AI_CARDS.map((c, i) => (
        <motion.div
          key={c.label}
          className={`absolute ${c.pos}`}
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={
            show
              ? {
                  // appear one by one → hold with a gentle float → fade away
                  opacity: [0, 1, 1, 0],
                  y: [30, 0, -9, 0],
                  scale: [0.9, 1, 1, 0.94],
                }
              : { opacity: 0, y: 30, scale: 0.9 }
          }
          transition={
            show
              ? {
                  delay: 0.5 * i,
                  duration: 8.5,
                  times: [0, 0.09, 0.72, 1],
                  ease: "easeInOut",
                }
              : { duration: 0.3 }
          }
        >
          <div className="flex items-center gap-2.5 rounded-2xl border border-white/25 bg-white/12 px-4 py-3 shadow-[0_8px_32px_rgba(6,40,22,0.35)] backdrop-blur-md">
            <span className="text-xl">{c.icon}</span>
            <span className="text-sm font-semibold tracking-wide text-emerald-50">
              {c.label}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/** Compact floating chips for mobile (single column, less clutter). */
function AiCardsMobile({ show }: { show: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-4 top-16 z-20 flex flex-wrap justify-center gap-2 sm:hidden">
      {AI_CARDS.slice(0, 4).map((c, i) => (
        <motion.span
          key={c.label}
          transition={{ delay: 0.3 * i, duration: 6, times: [0, 0.12, 0.7, 1], ease: "easeInOut" }}
          animate={show ? { opacity: [0, 1, 1, 0], y: [12, 0, -4, 0] } : { opacity: 0 }}
          className="rounded-full border border-white/25 bg-white/12 px-3 py-1.5 text-[11px] font-semibold text-emerald-50 backdrop-blur-md"
        >
          {c.icon} {c.label}
        </motion.span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                           */
/* ------------------------------------------------------------------ */

export default function Entry() {
  const navigate = useNavigate();
  const quality = useMemo(detectQuality, []);
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  // master timeline
  const progress = useRef(0);
  const burst = useRef(0);
  const [phase, setPhase] = useState<"loading" | "intro" | "ready">("loading");
  const [showCards, setShowCards] = useState(false);
  const [started, setStarted] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [visible, setVisible] = useState(true);
  const [showSkip, setShowSkip] = useState(() => {
    // Returning visitors get SKIP INTRO immediately (spec: "SKIP INTRO for
    // users who have already visited") instead of waiting for the 3.5s timer.
    try {
      return localStorage.getItem("km-entry-visited") === "1";
    } catch {
      return false;
    }
  });
  const logoRef = useRef<HTMLHeadingElement>(null);
  const mottoRef = useRef<HTMLParagraphElement>(null);

  /* pause rendering when the tab is hidden */
  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  /* start the cinematic once the loader clears */
  useEffect(() => {
    const t = setTimeout(() => {
      setPhase("intro");
      setStarted(true);
    }, OVERLAY.loaderMinMs);
    return () => clearTimeout(t);
  }, []);

  /* overlay phase timers (skip logic mirrors reduced-motion) */
  useEffect(() => {
    if (!started || exiting) return;
    if (reduced) {
      progress.current = 1;
      setPhase("ready");
      setShowCards(true);
      setShowSkip(false);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const el = (performance.now() - t0) / 1000;
      progress.current = Math.min(1, el / DURATION_S);
      if (el >= OVERLAY.cards / 1000) setShowCards(true);
      setPhase((p) =>
        p !== "ready" && el >= OVERLAY.brand / 1000 ? "ready" : p,
      );
      // Timer only reveals SKIP for first-time visitors; returning visitors
      // already see it from mount (initialised above).
      if (el * 1000 >= OVERLAY.skip) setShowSkip(true);
      if (progress.current < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, exiting, reduced]);

  /* GSAP logo + motto reveal */
  useEffect(() => {
    if (phase !== "ready" || !logoRef.current || !mottoRef.current) return;
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.fromTo(
      logoRef.current,
      { opacity: 0, y: 34, letterSpacing: "0.75em", filter: "blur(6px)" },
      {
        opacity: 1,
        y: 0,
        letterSpacing: "0.28em",
        filter: "blur(0px)",
        duration: 1.4,
        textShadow:
          "0 0 18px rgba(110,231,183,0.85), 0 0 46px rgba(52,211,153,0.45)",
      },
    ).fromTo(
      mottoRef.current,
      { opacity: 0, y: 18, letterSpacing: "0.5em" },
      { opacity: 1, y: 0, letterSpacing: "0.12em", duration: 1.1 },
      "-=0.7",
    );
    return () => {
      tl.kill();
    };
  }, [phase]);

  const enter = () => {
    if (exiting) return;
    setExiting(true);
    try {
      // Returning visitors skip straight to the title/CTA next time.
      localStorage.setItem("km-entry-visited", "1");
    } catch {
      // ignore storage errors
    }
    // green particle burst + camera fly-through, then land in the app
    const burstEl = document.getElementById("km-burst");
    if (burstEl) {
      gsap.fromTo(
        burstEl,
        { opacity: 0, scale: 0.2 },
        {
          opacity: 1,
          scale: 3.2,
          duration: 0.9,
          ease: "power2.in",
          onComplete: () => navigate("/dashboard"),
        },
      );
      gsap.to(burstEl, { opacity: 0, duration: 0.4, delay: 0.9 });
    } else {
      setTimeout(() => navigate("/dashboard"), 900);
    }
    gsap.to(burst, { current: 1, duration: 1.0, ease: "power2.in" });
  };

  const skip = () => {
    try {
      // Same benefit as a full watch: returning visitors land on the CTA fast.
      localStorage.setItem("km-entry-visited", "1");
    } catch {
      // ignore storage errors
    }
    progress.current = 1;
    setPhase("ready");
  };

  const showAi = showCards || phase === "ready";

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0a1f14]">
      <Loader done={phase !== "loading"} />

      {/* 3D sunrise farm */}
      <Canvas
        shadows={quality === "high"}
        dpr={quality === "high" ? [1, 1.75] : [0.7, 1]}
        frameloop={visible ? "always" : "demand"}
        camera={{ fov: 55, near: 0.1, far: 400, position: [4.5, 3.4, 16] }}
        gl={{ antialias: quality === "high", powerPreference: "high-performance" }}
        className="absolute inset-0"
      >
        <Suspense fallback={null}>
          <FarmScene progressRef={progress} quality={quality} burst={burst} />
          <BurstCamera burst={burst} />
        </Suspense>
      </Canvas>

      {/* cinematic vignette */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(120%_100%_at_50%_45%,transparent_55%,rgba(4,20,12,0.55)_100%)]" />

      <AiCards show={showAi} />
      <AiCardsMobile show={showAi} />

      {/* title block */}
      <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col items-center pb-[9vh]">
        <AnimatePresence>
          {phase === "ready" && (
            <motion.div
              className="flex flex-col items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <h1
                ref={logoRef}
                className="font-display text-center text-4xl text-white opacity-0 sm:text-6xl"
                style={{ letterSpacing: "0.75em" }}
              >
                KRISHIMITRA
              </h1>
              <p className="mt-3 text-sm font-semibold tracking-[0.3em] text-emerald-200/90 sm:text-base">
                Your Intelligent Farming Companion
              </p>
              <p
                ref={mottoRef}
                className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-white/60 opacity-0 sm:text-sm"
              >
                Smart Farming. Better Decisions. Better Harvest.
              </p>

              {/* ENTER button — glassmorphism + emerald gradient + 3D hover */}
              <motion.button
                type="button"
                onClick={enter}
                initial={{ opacity: 0, y: 24, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                whileHover={{ scale: 1.045, rotateX: 6, y: -3 }}
                whileTap={{ scale: 0.97 }}
                transition={{ delay: reduced ? 0.6 : 3.4, duration: 0.6, ease: "easeOut" }}
                className="group mt-8 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-lime-400 p-[2px] shadow-[0_0_36px_rgba(52,211,153,0.45)]"
                style={{ perspective: 600 }}
              >
                <span className="flex items-center gap-3 rounded-full bg-emerald-950/45 px-9 py-4 font-display text-base tracking-[0.18em] text-white backdrop-blur-xl transition-colors group-hover:bg-emerald-950/25 sm:text-lg">
                  ENTER KRISHIMITRA
                  <span className="transition-transform duration-300 group-hover:translate-x-1.5">
                    →
                  </span>
                </span>
              </motion.button>
              <p className="mt-3 text-[11px] font-medium tracking-wide text-white/45">
                Smart farming for every Indian field
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* skip */}
      <AnimatePresence>
        {showSkip && phase !== "ready" && !exiting && (
          <motion.button
            type="button"
            onClick={skip}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute right-4 top-4 z-40 rounded-full border border-white/25 bg-black/25 px-4 py-2 text-xs font-semibold tracking-widest text-white/85 backdrop-blur-md hover:bg-black/40"
          >
            SKIP ⏭
          </motion.button>
        )}
      </AnimatePresence>

      {/* exit burst overlay */}
      <div
        id="km-burst"
        className="pointer-events-none fixed inset-0 z-[60] opacity-0"
        style={{
          background:
            "radial-gradient(circle at 50% 52%, #d9f99d 0%, #34d399 32%, #059669 58%, #064e3b 100%)",
        }}
      />
    </div>
  );
}
