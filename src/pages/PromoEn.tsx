import { motion } from "framer-motion";
import { Link } from "react-router";
import {
  AppHeader,
  BrowserBar,
  PhoneFrame,
  SceneWrap,
  SkyField,
  StoryboardPlayer,
  type Scene,
  type PlayerLabels,
} from "@/components/promo/storyboard";

/**
 * KrishiMitra AI — vertical (9:16) tutorial / awareness video, English.
 *
 * 10 scenes · ~90 seconds · very simple English only (narration, subtitles
 * and on-screen text). Built for WhatsApp Status, Instagram Reels and YouTube
 * Shorts. AI results are always labelled "possible problem" / "AI-based
 * suggestion" — never guaranteed — and expert advice is promoted for serious
 * crop problems and fertilizer use.
 */

/* ------------------------------------------------------------------ */
/* Scenes                                                              */
/* ------------------------------------------------------------------ */

function S1Problem() {
  const chips = ["Soil?", "Fertilizer?", "Disease?", "Pests?"];
  return (
    <SceneWrap caption={SCENES[0].vo}>
      <SkyField>
        <div className="absolute left-1/2 top-[14%] -translate-x-1/2 text-center">
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            className="text-7xl"
          >
            🧑‍🌾
          </motion.div>
          <p className="mt-1 text-3xl">😕</p>
        </div>
        <div className="absolute inset-x-0 top-[6%] flex flex-wrap items-start justify-center gap-2 px-4">
          {chips.map((t, i) => (
            <motion.span
              key={t}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + i * 1.6 }}
              className="nb-border bg-white px-2.5 py-1 text-[11px] font-bold"
            >
              🤔 {t}
            </motion.span>
          ))}
        </div>
        {/* affected plant close-up hints */}
        <span className="absolute bottom-[40%] left-[12%] text-3xl">🍂</span>
        <span className="absolute bottom-[45%] right-[14%] text-3xl">🐛</span>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-[46%] left-1/2 -translate-x-1/2"
        >
          <span className="nb-border bg-[#ffc53d] px-2.5 py-1 text-[10px] font-bold uppercase">
            Yellow leaves · pests
          </span>
        </motion.span>
      </SkyField>
    </SceneWrap>
  );
}

function S2Open() {
  return (
    <SceneWrap caption={SCENES[1].vo}>
      <div className="flex h-full items-center justify-center bg-[#ede7d8] py-4">
        <PhoneFrame>
          <BrowserBar />
          <div className="flex flex-col items-center gap-3 bg-[#f5f0e6] px-4 py-8 text-center">
            <motion.span
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="nb-shadow-sm grid h-16 w-16 place-items-center border-2 border-[#141414] bg-[#ffc53d] text-3xl"
            >
              🌾
            </motion.span>
            <p className="font-display text-base uppercase">KrishiMitra AI</p>
            <p className="text-[10px] font-semibold text-[#5c574b]">
              Your Digital Farming Assistant
            </p>
            <span className="nb-border bg-[#2fa35c] px-3 py-1.5 text-[10px] font-bold uppercase text-white">
              ▶ Get Started
            </span>
          </div>
        </PhoneFrame>
      </div>
    </SceneWrap>
  );
}

function S3Crop() {
  const rows = [
    { icon: "🌽", label: "Maize", pick: true },
    { icon: "🌾", label: "Rice", pick: false },
    { icon: "🫘", label: "Chickpea", pick: false },
    { icon: "🍅", label: "Tomato", pick: false },
  ];
  return (
    <SceneWrap caption={SCENES[2].vo}>
      <div className="flex h-full items-center justify-center bg-[#ede7d8] py-4">
        <PhoneFrame>
          <AppHeader title="Select Crop" />
          <div className="space-y-2 bg-[#f5f0e6] p-3">
            {rows.map((r, i) => (
              <motion.div
                key={r.label}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.5 }}
                className={`flex items-center gap-2 border-2 border-[#141414] px-3 py-2 text-xs font-bold ${r.pick ? "bg-[#ffc53d]" : "bg-white"}`}
              >
                <span className="text-lg">{r.icon}</span>
                <span>{r.label}</span>
                {r.pick && (
                  <motion.span
                    animate={{ scale: [1, 1.25, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className="ml-auto text-sm"
                  >
                    ✓
                  </motion.span>
                )}
              </motion.div>
            ))}
          </div>
        </PhoneFrame>
      </div>
    </SceneWrap>
  );
}

function S4FarmInfo() {
  const fields = [
    { icon: "📍", label: "Location", value: "Haveri, Karnataka", auto: true },
    { icon: "🌦️", label: "Weather", value: "28°C · Rain 5 mm", auto: true },
    { icon: "🌱", label: "Field area", value: "2 acres", auto: false },
    { icon: "🗓️", label: "Season", value: "Kharif", auto: false },
  ];
  return (
    <SceneWrap caption={SCENES[3].vo}>
      <div className="flex h-full items-center justify-center bg-[#ede7d8] py-4">
        <PhoneFrame>
          <AppHeader title="Farm Information" />
          <div className="space-y-2 bg-[#f5f0e6] p-3">
            {fields.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.55 }}
                className="flex items-center gap-2 border-2 border-[#141414] bg-white px-2.5 py-2"
              >
                <span>{f.icon}</span>
                <div className="leading-tight">
                  <p className="text-[8px] font-bold uppercase tracking-widest text-[#5c574b]">
                    {f.label}
                  </p>
                  <p className="text-[11px] font-bold">{f.value}</p>
                </div>
                {f.auto && (
                  <span className="ml-auto border-2 border-[#141414] bg-[#7fb069]/50 px-1.5 py-0.5 text-[8px] font-bold uppercase">
                    Auto
                  </span>
                )}
              </motion.div>
            ))}
            <p className="pt-1 text-center text-[9px] font-semibold text-[#5c574b]">
              📍 Location and weather fill in automatically
            </p>
          </div>
        </PhoneFrame>
      </div>
    </SceneWrap>
  );
}

function S5Photo() {
  return (
    <SceneWrap caption={SCENES[4].vo}>
      <div className="flex h-full items-center justify-center bg-[#141414] py-4">
        <PhoneFrame>
          <div className="relative flex h-[300px] flex-col bg-[#3a5a40]">
            {/* viewfinder leaf */}
            <div className="flex flex-1 items-center justify-center">
              <motion.span
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-7xl"
              >
                🍂
              </motion.span>
            </div>
            {/* corner brackets */}
            {[
              "left-3 top-3 border-l-4 border-t-4",
              "right-3 top-3 border-r-4 border-t-4",
              "left-3 bottom-12 border-b-4 border-l-4",
              "right-3 bottom-12 border-b-4 border-r-4",
            ].map((c) => (
              <span
                key={c}
                className={`absolute h-8 w-8 border-[#ffc53d] ${c}`}
              />
            ))}
            <p className="absolute bottom-14 left-0 right-0 text-center text-[10px] font-bold uppercase tracking-widest text-white/80">
              Take a clear photo of the leaf
            </p>
            {/* shutter */}
            <div className="flex items-center justify-center gap-6 bg-[#141414] py-3">
              <span className="text-lg">🖼️</span>
              <motion.button
                type="button"
                animate={{ scale: [1, 0.92, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, delay: 1 }}
                className="grid h-11 w-11 place-items-center rounded-full border-4 border-white bg-[#d64545]"
                aria-label="Take photo"
              />
              <span className="text-lg">📷</span>
            </div>
          </div>
        </PhoneFrame>
      </div>
    </SceneWrap>
  );
}

function S6AI() {
  return (
    <SceneWrap caption={SCENES[5].vo}>
      <div className="flex h-full items-center justify-center bg-[#ede7d8] py-4">
        <PhoneFrame>
          <AppHeader title="AI Analysis" />
          <div className="space-y-2 bg-[#f5f0e6] p-3">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-2 border-2 border-[#141414] bg-white px-2.5 py-1.5"
            >
              <span className="text-base">🌽</span>
              <span className="text-[10px] font-bold">Maize · Leaf</span>
              <span className="ml-auto border-2 border-[#141414] bg-[#ffc53d] px-1.5 py-0.5 text-[8px] font-bold uppercase">
                Moderate stress
              </span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="border-2 border-[#141414] bg-white p-2"
            >
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#5c574b]">
                🔍 Possible problem
              </p>
              <p className="text-[11px] font-bold">
                Nutrient deficiency / early leaf-disease signs
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.8 }}
              className="border-2 border-[#141414] bg-[#7fb069]/30 p-2"
            >
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#5c574b]">
                ✅ Recommended next step
              </p>
              <ul className="mt-1 space-y-1 text-[10px] font-semibold">
                <li>• Check lower leaves and take a close-up photo</li>
                <li>• Check soil moisture</li>
                <li>• Take another photo in 7 days</li>
              </ul>
            </motion.div>
            <p className="text-[8px] font-semibold leading-snug text-[#5c574b]">
              ⚠ AI-based suggestion only — not a guaranteed diagnosis
            </p>
          </div>
        </PhoneFrame>
      </div>
    </SceneWrap>
  );
}

function S7Soil() {
  const tiles = [
    { k: "N", v: "240", u: "kg/ha" },
    { k: "P", v: "38", u: "kg/ha" },
    { k: "K", v: "220", u: "kg/ha" },
    { k: "pH", v: "7.2", u: "" },
  ];
  return (
    <SceneWrap caption={SCENES[6].vo}>
      <div className="flex h-full items-center justify-center bg-[#ede7d8] py-4">
        <PhoneFrame>
          <AppHeader title="Soil Information" />
          <div className="space-y-2 bg-[#f5f0e6] p-3">
            <div className="grid grid-cols-2 gap-2">
              {tiles.map((t, i) => (
                <motion.div
                  key={t.k}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + i * 0.4 }}
                  className="border-2 border-[#141414] bg-white px-2.5 py-2"
                >
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#5c574b]">
                    {t.k} {t.u && <span>· {t.u}</span>}
                  </p>
                  <p className="text-base font-bold">{t.v}</p>
                </motion.div>
              ))}
            </div>
            <div className="border-2 border-[#141414] bg-[#ede7d8] px-2.5 py-2">
              <p className="text-[10px] font-bold">
                🧪 From a soil test / Soil Health Card
              </p>
              <p className="mt-1 text-[9px] font-semibold leading-snug text-[#5c574b]">
                GPS or satellite do not measure N·P·K·pH — values come from a
                soil test only
              </p>
            </div>
            <div className="border-2 border-[#141414] bg-[#ffc53d]/50 px-2.5 py-2">
              <p className="text-[10px] font-bold leading-snug">
                👨‍🌾 Use fertilizer according to soil test results and expert
                advice
              </p>
            </div>
          </div>
        </PhoneFrame>
      </div>
    </SceneWrap>
  );
}

function S8Chat() {
  return (
    <SceneWrap caption={SCENES[7].vo}>
      <div className="flex h-full items-center justify-center bg-[#ede7d8] py-4">
        <PhoneFrame>
          <AppHeader title="Ask a Question" />
          <div className="space-y-2.5 bg-[#f5f0e6] p-3">
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="ml-6 border-2 border-[#141414] bg-[#ffc53d] px-3 py-2 text-[10px] font-bold leading-snug"
            >
              My maize leaves are turning yellow. What could be the reason?
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.6 }}
              className="mr-6 border-2 border-[#141414] bg-white px-3 py-2"
            >
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#5c574b]">
                🤖 KrishiMitra AI
              </p>
              <p className="mt-1 text-[10px] font-semibold leading-snug">
                Common causes of yellow leaves: nitrogen (N) deficiency, too
                much or too little water, or pests. Upload a leaf photo to
                narrow down the possible cause, and get a soil test.
              </p>
              <p className="mt-1 text-[8px] font-semibold text-[#5c574b]">
                ⚠ AI-based guidance — confirm with an expert
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.6 }}
              className="flex items-center gap-2 border-2 border-[#141414] bg-white px-2.5 py-1.5"
            >
              <span className="text-[10px] font-semibold text-[#5c574b]">
                Type or speak your question…
              </span>
              <span className="ml-auto text-sm">🎤</span>
            </motion.div>
          </div>
        </PhoneFrame>
      </div>
    </SceneWrap>
  );
}

function S9Confident() {
  return (
    <SceneWrap caption={SCENES[8].vo}>
      <SkyField healthy>
        <motion.div
          animate={{ x: [-30, 30], y: [0, -4, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[30%] left-1/2 -translate-x-1/2"
        >
          <div className="flex items-end gap-1 text-6xl">
            <span>🧑‍🌾</span>
            <span className="text-5xl">📱</span>
          </div>
        </motion.div>
        <motion.span
          animate={{ rotate: [0, 8, -8, 0] }}
          transition={{ duration: 2.2, repeat: Infinity }}
          className="absolute right-[16%] top-[24%] text-4xl"
        >
          😊
        </motion.span>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="absolute left-1/2 top-[10%] -translate-x-1/2"
        >
          <span className="nb-border bg-[#2fa35c] px-3 py-1.5 text-xs font-bold uppercase text-white">
            🌿 Healthy crop
          </span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.2 }}
          className="absolute inset-x-4 bottom-[44%]"
        >
          <p className="nb-border bg-white/95 px-3 py-2 text-center text-[10px] font-bold leading-snug">
            👨‍🌾 For serious crop problems, consult a local agriculture expert
          </p>
        </motion.div>
      </SkyField>
    </SceneWrap>
  );
}

function S10CTA() {
  return (
    <SceneWrap caption={SCENES[9].vo}>
      <div className="flex h-full flex-col items-center justify-center gap-2.5 bg-[#f5f0e6] px-4 py-6 text-center">
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          className="nb-shadow-sm grid h-20 w-20 place-items-center border-2 border-[#141414] bg-[#ffc53d] text-4xl"
        >
          🌾
        </motion.div>
        <p className="font-display text-3xl uppercase">KrishiMitra AI</p>
        <p className="text-sm font-bold">Your Digital Farming Assistant</p>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5c574b]">
          Ask. Analyze. Learn. Farm Smarter.
        </p>
        <Link
          to="/auth"
          className="nb-press mt-1 bg-[#2fa35c] px-6 py-3 font-display text-sm uppercase text-white"
        >
          Try it now →
        </Link>
        <p className="nb-border bg-white px-3 py-1.5 text-[11px] font-bold">
          https://krishimitraai.freebuff.app/
        </p>
      </div>
    </SceneWrap>
  );
}

/* ------------------------------------------------------------------ */
/* Script                                                              */
/* ------------------------------------------------------------------ */

export const SCENES: Scene[] = [
  {
    id: "s1",
    seconds: 10,
    vo: "Farmers often have questions about crop diseases, pests, soil, fertilizers and crop management. KrishiMitra AI can help you get useful agricultural information using your smartphone.",
    render: () => <S1Problem />,
  },
  {
    id: "s2",
    seconds: 6,
    vo: "First, open KrishiMitra AI on your mobile phone.",
    render: () => <S2Open />,
  },
  {
    id: "s3",
    seconds: 6,
    vo: "Select the crop you are growing, such as maize.",
    render: () => <S3Crop />,
  },
  {
    id: "s4",
    seconds: 8,
    vo: "Enter the available information about your farm, crop and location.",
    render: () => <S4FarmInfo />,
  },
  {
    id: "s5",
    seconds: 8,
    vo: "If your crop has a disease or pest problem, take a clear photo of the affected plant and upload it.",
    render: () => <S5Photo />,
  },
  {
    id: "s6",
    seconds: 12,
    vo: "KrishiMitra AI analyzes the information and provides possible causes and recommended next steps.",
    render: () => <S6AI />,
  },
  {
    id: "s7",
    seconds: 12,
    vo: "You can also use available soil information such as N, P, K and pH to better understand your soil and fertilizer requirements.",
    render: () => <S7Soil />,
  },
  {
    id: "s8",
    seconds: 10,
    vo: "You can also ask your farming questions in simple language and get AI-based guidance.",
    render: () => <S8Chat />,
  },
  {
    id: "s9",
    seconds: 8,
    vo: "Use the information as a guide and make farming decisions carefully. For serious crop problems, consult a local agriculture expert.",
    render: () => <S9Confident />,
  },
  {
    id: "s10",
    seconds: 10,
    vo: "KrishiMitra AI — your digital assistant for smarter farming. Try it today.",
    render: () => <S10CTA />,
  },
];

const LABELS: PlayerLabels = {
  playAria: "Play video",
  watchTitle: "Watch the video",
  watchSub:
    "90 seconds · English · how to use KrishiMitra AI on your phone, step by step",
  play: "Play",
  pause: "Pause",
  restart: "Restart",
  voiceOn: "Voice on",
  voiceOff: "Mute",
  storyboardTitle: "Video storyboard (10 scenes)",
  sceneWord: "Scene",
  footerNote:
    "AI results in this video are shown as \"possible problem\" and \"AI-based suggestion\" — never a guaranteed diagnosis or yield. Use fertilizer according to soil test results and expert advice. Narration uses your device's English speech engine; if audio is unavailable, the full narration is always shown as on-screen subtitles.",
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function PromoEn() {
  return (
    <div className="nb-dots min-h-screen bg-[#f5f0e6] text-[#141414]">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="nb-shadow-sm grid h-10 w-10 place-items-center border-2 border-[#141414] bg-[#ffc53d] text-lg">
            🌾
          </div>
          <div className="leading-tight">
            <p className="font-display text-base uppercase">KrishiMitra AI</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#5c574b]">
              Tutorial video · 9:16 · ~90 s
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/promo"
            className="nb-press bg-white px-3 py-1.5 text-xs font-bold uppercase"
          >
            ಕನ್ನಡ ▸
          </Link>
          <Link
            to="/promo-hi"
            className="nb-press bg-white px-3 py-1.5 text-xs font-bold"
          >
            हिंदी ▸
          </Link>
          <Link
            to="/"
            className="nb-press bg-white px-3 py-1.5 text-xs font-bold uppercase"
          >
            ← Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16">
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <p className="nb-border bg-white px-3 py-2 text-center text-[11px] font-bold uppercase">
            📱 9:16 vertical
          </p>
          <p className="nb-border bg-white px-3 py-2 text-center text-[11px] font-bold uppercase">
            🌐 English only
          </p>
          <p className="nb-border bg-white px-3 py-2 text-center text-[11px] font-bold uppercase">
            🎬 10 scenes · ~90 s
          </p>
        </div>

        <StoryboardPlayer
          scenes={SCENES}
          aspect="9:16"
          narrationLang="en-US"
          labels={LABELS}
        />

        <p className="mt-4 text-center text-[11px] font-semibold text-[#5c574b]">
          Export-ready for WhatsApp Status, Instagram Reels and YouTube Shorts.
          Production script: <code>docs/promo-video-script-en.md</code>
        </p>
      </main>
    </div>
  );
}
