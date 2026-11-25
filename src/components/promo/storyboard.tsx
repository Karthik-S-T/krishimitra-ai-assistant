import { AnimatePresence, motion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * KrishiMitra AI — shared storyboard-video kit.
 *
 * A "storyboard video" is an animated, captioned scene sequence played by an
 * in-app player (no video file needed). This module holds everything the
 * language-specific pages share:
 *   - Scene type + useStoryboardPlayer() playback hook (timer, auto-advance,
 *     scene jump, mute, restart)
 *   - Device-speech narration (best-effort; captions always carry the message)
 *   - Visual helpers: SkyField, PhoneFrame, AppHeader, BrowserBar, Caption,
 *     SceneWrap
 *   - StoryboardPlayer: 16:9 or 9:16 stage with progress bar and controls
 *
 * Honesty rules are baked into the calling pages: AI results are labelled
 * "possible / suggestion", never guaranteed, and expert advice is promoted
 * for fertilizer and pesticide decisions.
 */

export type Scene = {
  id: string;
  seconds: number;
  vo: string; // narration / caption text
  render: () => ReactNode;
};

/* ------------------------------------------------------------------ */
/* Narration (device speech, best-effort)                              */
/* ------------------------------------------------------------------ */

export function speakNarration(text: string, lang: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    const prefix = lang.split("-")[0].toLowerCase();
    const voice = synth
      .getVoices()
      .find((v) => v.lang?.toLowerCase().startsWith(prefix));
    if (voice) u.voice = voice;
    u.rate = 0.92;
    synth.speak(u);
  } catch {
    /* voiceover is best-effort; captions always carry the message */
  }
}

/* ------------------------------------------------------------------ */
/* Playback hook                                                       */
/* ------------------------------------------------------------------ */

export function useStoryboardPlayer(scenes: Scene[]) {
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [sceneIdx, setSceneIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0); // seconds inside current scene
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const spokenRef = useRef<string>("");

  const scene = scenes[sceneIdx];
  const totalSeconds = useMemo(
    () => scenes.reduce((s, sc) => s + sc.seconds, 0),
    [scenes],
  );

  const goTo = useCallback(
    (idx: number, autoplay: boolean) => {
      const clamped = Math.max(0, Math.min(scenes.length - 1, idx));
      setSceneIdx(clamped);
      setElapsed(0);
      spokenRef.current = "";
      setPlaying(autoplay);
    },
    [scenes.length],
  );

  // playback timer + auto-advance
  useEffect(() => {
    if (!started || !playing) return;
    const iv = window.setInterval(() => {
      setElapsed((e) => {
        const next = e + 0.1;
        if (next >= scene.seconds) {
          if (sceneIdx < scenes.length - 1) {
            setSceneIdx(sceneIdx + 1);
            spokenRef.current = "";
            return 0;
          }
          setPlaying(false);
          return scene.seconds;
        }
        return next;
      });
    }, 100);
    return () => window.clearInterval(iv);
  }, [started, playing, sceneIdx, scene.seconds, scenes.length]);

  // narration per scene
  const narrationLang = useRef("en-US");
  useEffect(() => {
    if (!started || !playing || mutedRef.current) return;
    if (spokenRef.current === scene.id) return;
    spokenRef.current = scene.id;
    speakNarration(scene.vo, narrationLang.current);
  }, [started, playing, scene.id, scene.vo]);

  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const togglePlay = () => {
    if (!started) {
      setStarted(true);
      setPlaying(true);
      return;
    }
    if (playing) {
      window.speechSynthesis?.cancel();
      setPlaying(false);
    } else {
      if (!muted && elapsed < 0.15) spokenRef.current = "";
      setPlaying(true);
    }
  };

  const restart = () => {
    window.speechSynthesis?.cancel();
    goTo(0, true);
  };

  const toggleMute = () => {
    setMuted((m) => {
      if (!m) window.speechSynthesis?.cancel();
      return !m;
    });
  };

  const totalElapsed = useMemo(
    () =>
      scenes.slice(0, sceneIdx).reduce((s, sc) => s + sc.seconds, 0) + elapsed,
    [scenes, sceneIdx, elapsed],
  );

  return {
    started,
    playing,
    muted,
    sceneIdx,
    scene,
    totalElapsed,
    totalSeconds,
    narrationLang,
    togglePlay,
    restart,
    goTo,
    toggleMute,
  };
}

/* ------------------------------------------------------------------ */
/* Shared visual helpers                                               */
/* ------------------------------------------------------------------ */

export function SkyField({
  children,
  healthy = false,
}: {
  children?: ReactNode;
  healthy?: boolean;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-[#8ecae6] via-[#bde0fe] to-[#e9f5db]">
      {/* sun */}
      <div className="absolute right-6 top-5 text-4xl">☀️</div>
      {/* hills */}
      <div className="absolute bottom-[38%] left-0 right-0 h-16 rounded-[100%] bg-[#a7c957]/60" />
      {/* field rows */}
      <div
        className={`absolute inset-x-0 bottom-0 h-[38%] ${healthy ? "bg-[#588157]" : "bg-[#90a955]"}`}
      />
      <div className="absolute inset-x-0 bottom-0 flex h-[38%] items-end justify-around px-2 text-3xl sm:text-4xl">
        {Array.from({ length: 7 }).map((_, i) => (
          <motion.span
            key={i}
            animate={{ rotate: [-2, 2, -2] }}
            transition={{ duration: 3 + (i % 3), repeat: Infinity }}
            className="origin-bottom"
          >
            🌽
          </motion.span>
        ))}
      </div>
      {children}
    </div>
  );
}

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto w-[240px] max-w-[80%] sm:w-[280px]">
      <div className="nb-shadow-lg overflow-hidden rounded-[28px] border-[6px] border-[#141414] bg-white">
        <div className="flex items-center justify-center gap-1 bg-[#141414] py-1.5">
          <span className="h-1.5 w-10 rounded-full bg-white/40" />
        </div>
        {children}
      </div>
      <span className="absolute -right-2 top-24 h-10 w-1.5 rounded bg-[#141414]" />
      <span className="absolute -left-2 top-20 h-6 w-1.5 rounded bg-[#141414]" />
      <span className="absolute -left-2 top-28 h-6 w-1.5 rounded bg-[#141414]" />
    </div>
  );
}

export function AppHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 border-b-2 border-[#141414] bg-[#f5f0e6] px-3 py-2">
      <span className="grid h-7 w-7 place-items-center border-2 border-[#141414] bg-[#ffc53d] text-sm">
        🌾
      </span>
      <p className="font-display text-[11px] uppercase tracking-wide">
        KrishiMitra AI
      </p>
      <p className="ml-auto text-[9px] font-bold uppercase text-[#5c574b]">
        {title}
      </p>
    </div>
  );
}

export function BrowserBar() {
  return (
    <div className="flex items-center gap-2 border-b-2 border-[#141414] bg-white px-3 py-1.5">
      <span className="text-[10px]">🔒</span>
      <p className="flex-1 truncate rounded-full border-2 border-[#141414] bg-[#ede7d8] px-2 py-0.5 text-[9px] font-semibold">
        https://krishimitraai.freebuff.app/
      </p>
    </div>
  );
}

export function Caption({ text }: { text: string }) {
  return (
    <p className="nb-border mx-auto max-w-3xl bg-[#141414]/90 px-4 py-2.5 text-center text-[13px] font-semibold leading-relaxed text-white sm:text-base">
      {text}
    </p>
  );
}

export function SceneWrap({
  children,
  caption,
}: {
  children: ReactNode;
  caption: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1">{children}</div>
      <div className="px-3 pb-3 pt-1">
        <Caption text={caption} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Player UI                                                           */
/* ------------------------------------------------------------------ */

export type PlayerLabels = {
  playAria: string;
  watchTitle: string;
  watchSub: string;
  play: string;
  pause: string;
  restart: string;
  voiceOn: string;
  voiceOff: string;
  storyboardTitle: string;
  sceneWord: string; // "Scene" / "ದೃಶ್ಯ"
  footerNote: string;
};

export function StoryboardPlayer({
  scenes,
  aspect,
  narrationLang,
  labels,
}: {
  scenes: Scene[];
  aspect: "16:9" | "9:16";
  narrationLang: string;
  labels: PlayerLabels;
}) {
  const p = useStoryboardPlayer(scenes);
  p.narrationLang.current = narrationLang;

  const stage =
    aspect === "9:16"
      ? "relative mx-auto aspect-[9/16] w-full max-w-[300px] sm:max-w-[330px]"
      : "relative aspect-video w-full";

  return (
    <div className="nb-shadow-lg relative overflow-hidden border-2 border-[#141414] bg-white">
      <div className={stage}>
        <AnimatePresence mode="wait">
          <motion.div
            key={p.scene.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0"
          >
            {p.scene.render()}
          </motion.div>
        </AnimatePresence>

        {/* start cover (also satisfies speech autoplay policy) */}
        {!p.started && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#141414]/70 p-4 text-center">
            <button
              type="button"
              onClick={p.togglePlay}
              className="nb-press nb-shadow-lg grid h-20 w-20 place-items-center border-2 border-[#141414] bg-[#ffc53d] text-3xl"
              aria-label={labels.playAria}
            >
              ▶
            </button>
            <p className="font-display text-lg uppercase text-white">
              {labels.watchTitle}
            </p>
            <p className="max-w-md text-xs font-semibold text-white/80">
              {labels.watchSub}
            </p>
          </div>
        )}
      </div>

      {/* progress + controls */}
      <div className="border-t-2 border-[#141414] bg-[#f5f0e6] px-3 py-2.5">
        <div className="h-2 w-full border-2 border-[#141414] bg-white">
          <div
            className="h-full bg-[#2fa35c] transition-[width] duration-100"
            style={{
              width: `${Math.min(100, (p.totalElapsed / p.totalSeconds) * 100)}%`,
            }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={p.togglePlay}
            className="nb-press bg-[#ffc53d] px-3 py-1.5 text-xs font-bold uppercase"
          >
            {p.playing ? `⏸ ${labels.pause}` : `▶ ${labels.play}`}
          </button>
          <button
            type="button"
            onClick={p.restart}
            className="nb-press bg-white px-3 py-1.5 text-xs font-bold uppercase"
          >
            ↺ {labels.restart}
          </button>
          <button
            type="button"
            onClick={p.toggleMute}
            className="nb-press bg-white px-3 py-1.5 text-xs font-bold uppercase"
          >
            {p.muted ? `🔇 ${labels.voiceOff}` : `🔊 ${labels.voiceOn}`}
          </button>
          <p className="ml-auto text-[11px] font-bold text-[#5c574b]">
            {String(Math.floor(p.totalElapsed / 60)).padStart(2, "0")}:
            {String(Math.floor(p.totalElapsed % 60)).padStart(2, "0")} /{" "}
            {String(Math.floor(p.totalSeconds / 60)).padStart(2, "0")}:
            {String(p.totalSeconds % 60).padStart(2, "0")}
          </p>
        </div>
        {/* scene jump chips */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {scenes.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                window.speechSynthesis?.cancel();
                p.goTo(i, p.started);
              }}
              className={`border-2 border-[#141414] px-2 py-1 text-[10px] font-bold uppercase nb-shadow-sm ${i === p.sceneIdx ? "bg-[#ffc53d]" : "bg-white"}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* scene list / storyboard */}
      <div className="border-t-2 border-[#141414] bg-[#ede7d8] p-4">
        <h2 className="font-display mb-3 text-base uppercase">
          {labels.storyboardTitle}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {scenes.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                window.speechSynthesis?.cancel();
                p.goTo(i, p.started);
              }}
              className={`nb-card p-3 text-left ${i === p.sceneIdx ? "bg-[#ffc53d]/40" : ""}`}
            >
              <p className="font-display text-xs uppercase">
                {labels.sceneWord} {i + 1} · {s.seconds}s
              </p>
              <p className="mt-1 text-xs font-medium leading-relaxed text-[#3d3a33]">
                {s.vo}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* honesty footer */}
      <p className="border-t-2 border-[#141414] bg-[#ede7d8] px-4 py-3 text-[11px] font-semibold leading-relaxed text-[#5c574b]">
        ⚠ {labels.footerNote}
      </p>
    </div>
  );
}
