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
 * KrishiMitra AI — promotional / tutorial video (storyboard player).
 *
 * 10 scenes · ~90 seconds · simple spoken Kannada (North Karnataka / Haveri).
 * Voiceover uses the device speech engine (kn-IN if available); every scene
 * also shows the full caption on screen so the video works even without
 * audio. AI results are always labelled "ಸಂಭಾವ್ಯ" / "ಶಿಫಾರಸು" — never
 * guaranteed — and expert advice is recommended for fertilizer decisions.
 */

const SITE = "https://krishimitraai.freebuff.app/";

/* ------------------------------------------------------------------ */
/* Scenes                                                              */
/* ------------------------------------------------------------------ */

function S1Worry() {
  const q = ["ಮಣ್ಣು?", "ಗೊಬ್ಬರ?", "ರೋಗ?", "ಕೀಟ?"];
  return (
    <SceneWrap caption={SCENES[0].vo}>
      <SkyField>
        <div className="absolute left-1/2 top-[16%] -translate-x-1/2 text-center">
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            className="text-7xl sm:text-8xl"
          >
            🧑‍🌾
          </motion.div>
          <p className="mt-1 text-3xl">😕</p>
        </div>
        <div className="absolute inset-x-0 top-[8%] flex flex-wrap items-start justify-center gap-2 px-4">
          {q.map((t, i) => (
            <motion.span
              key={t}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + i * 1.4 }}
              className="nb-border bg-white px-2.5 py-1 text-xs font-bold"
            >
              🤔 {t}
            </motion.span>
          ))}
        </div>
        {/* yellowing leaf + pest */}
        <span className="absolute bottom-[40%] left-[12%] text-3xl">🍂</span>
        <span className="absolute bottom-[45%] right-[14%] text-3xl">🐛</span>
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
              ನಿಮ್ಮ ಸ್ಮಾರ್ಟ್ ಕೃಷಿ ಸಹಾಯಕ
            </p>
            <span className="nb-border bg-[#2fa35c] px-3 py-1.5 text-[10px] font-bold uppercase text-white">
              ▶ ಪ್ರಾರಂಭಿಸಿ
            </span>
          </div>
        </PhoneFrame>
      </div>
    </SceneWrap>
  );
}

function S3Crop() {
  const rows = [
    { icon: "🌽", kn: "ಮೆಕ್ಕೆಜೋಳ", pick: true },
    { icon: "🌾", kn: "ಭತ್ತ", pick: false },
    { icon: "🫘", kn: "ತೊಗರಿ", pick: false },
    { icon: "🍅", kn: "ಟೊಮ್ಯಾಟೊ", pick: false },
  ];
  return (
    <SceneWrap caption={SCENES[2].vo}>
      <div className="flex h-full items-center justify-center bg-[#ede7d8] py-4">
        <PhoneFrame>
          <AppHeader title="ಬೆಳೆ ಆಯ್ಕೆ" />
          <div className="space-y-2 bg-[#f5f0e6] p-3">
            {rows.map((r, i) => (
              <motion.div
                key={r.kn}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.5 }}
                className={`flex items-center gap-2 border-2 border-[#141414] px-3 py-2 text-xs font-bold ${r.pick ? "bg-[#ffc53d]" : "bg-white"}`}
              >
                <span className="text-lg">{r.icon}</span>
                <span>{r.kn}</span>
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
    { icon: "📍", label: "ಸ್ಥಳ", value: "ಹಾವೇರಿ, ಕರ್ನಾಟಕ", auto: true },
    { icon: "🌦️", label: "ಹವಾಮಾನ", value: "28°C · ಮಳೆ 5mm", auto: true },
    { icon: "🌱", label: "ಜಮೀನಿನ ವಿಸ್ತೀರ್ಣ", value: "2 ಎಕರೆ", auto: false },
    { icon: "🗓️", label: "ಋತು", value: "ಖಾರೀಫ್", auto: false },
  ];
  return (
    <SceneWrap caption={SCENES[3].vo}>
      <div className="flex h-full items-center justify-center bg-[#ede7d8] py-4">
        <PhoneFrame>
          <AppHeader title="ಜಮೀನಿನ ಮಾಹಿತಿ" />
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
                    ಸ್ವಯಂ
                  </span>
                )}
              </motion.div>
            ))}
            <p className="pt-1 text-center text-[9px] font-semibold text-[#5c574b]">
              📍 GPS ಸ್ಥಳ ಮತ್ತು ಹವಾಮಾನ ತಾನಾಗಿಯೇ ಬರುತ್ತದೆ
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
              ಎಲೆಯ ಸ್ಪಷ್ಟ ಫೋಟೋ ತೆಗ್ಗಿ
            </p>
            {/* shutter */}
            <div className="flex items-center justify-center gap-6 bg-[#141414] py-3">
              <span className="text-lg">🖼️</span>
              <motion.button
                type="button"
                animate={{ scale: [1, 0.92, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, delay: 1 }}
                className="grid h-11 w-11 place-items-center rounded-full border-4 border-white bg-[#d64545]"
                aria-label="ಫೋಟೋ ತೆಗೆಯಿರಿ"
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
          <AppHeader title="AI ವಿಶ್ಲೇಷಣೆ" />
          <div className="space-y-2 bg-[#f5f0e6] p-3">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-2 border-2 border-[#141414] bg-white px-2.5 py-1.5"
            >
              <span className="text-base">🌽</span>
              <span className="text-[10px] font-bold">ಮೆಕ್ಕೆಜೋಳ · ಎಲೆ</span>
              <span className="ml-auto border-2 border-[#141414] bg-[#ffc53d] px-1.5 py-0.5 text-[8px] font-bold uppercase">
                ಮಧ್ಯಮ ಒತ್ತಡ
              </span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="border-2 border-[#141414] bg-white p-2"
            >
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#5c574b]">
                🔍 ಸಂಭಾವ್ಯ ಸಮಸ್ಯೆ
              </p>
              <p className="text-[11px] font-bold">
                ಪೋಷಕಾಂಶದ ಕೊರತೆ / ಎಲೆ ಕಾಳಿ ರೋಗದ ಲಕ್ಷಣ
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.8 }}
              className="border-2 border-[#141414] bg-[#7fb069]/30 p-2"
            >
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#5c574b]">
                ✅ ಶಿಫಾರಸು — ಮುಂದಿನ ಕ್ರಮ
              </p>
              <ul className="mt-1 space-y-1 text-[10px] font-semibold">
                <li>• ಕೆಳ ಎಲೆಗಳನ್ನು ಪರಿಶೀಲಿಸಿ ಫೋಟೋ ತೆಗ್ಗಿ</li>
                <li>• ಮಣ್ಣಿನ ತೇವಾಂಶ ಪರಿಶೀಲಿಸಿ</li>
                <li>• 7 ದಿನದಲ್ಲಿ ಮತ್ತೊಮ್ಮೆ ಫೋಟೋ ತೆಗ್ಗಿ</li>
              </ul>
            </motion.div>
            <p className="text-[8px] font-semibold leading-snug text-[#5c574b]">
              ⚠ AI ಸಲಹೆ ಸಂಭಾವ್ಯತೆ ಮಾತ್ರ — ತಜ್ಞರ ಸಲಹೆಯ ಬದಲು ಅಲ್ಲ
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
          <AppHeader title="ಮಣ್ಣಿನ ಮಾಹಿತಿ" />
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
                🧪 ಮಾಹಿತಿ: ಮಣ್ಣಿನ ಪರೀಕ್ಷೆ / ಮಣ್ಣಿನ ಆರೋಗ್ಯ ಕಾರ್ಡ
              </p>
              <p className="mt-1 text-[9px] font-semibold leading-snug text-[#5c574b]">
                GPS ಅಥವಾ ಉಪಗ್ರಹ N·P·K·pH ಅಳೆಯುವುದಿಲ್ಲ — ಮೌಲ್ಯಗಳು ಮಣ್ಣಿನ ಪರೀಕ್ಷೆಯಿಂದ ಮಾತ್ರ
              </p>
            </div>
            <div className="border-2 border-[#141414] bg-[#ffc53d]/50 px-2.5 py-2">
              <p className="text-[10px] font-bold leading-snug">
                👨‍🌾 ಗೊಬ್ಬರ ಬಳಸುವ ಮೊದಲು ಸ್ಥಳೀಯ ಕೃಷಿ ಅಧಿಕಾರಿಗಳ ಸಲಹೆ ಪಡೆಯಿರಿ
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
          <AppHeader title="ಕೃಷಿ ಪ್ರಶ್ನೆ" />
          <div className="space-y-2.5 bg-[#f5f0e6] p-3">
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="ml-6 border-2 border-[#141414] bg-[#ffc53d] px-3 py-2 text-[11px] font-bold leading-snug"
            >
              ನನ್ನ ಮೆಕ್ಕೆಜೋಳದ ಎಲೆಗಳು ಹಳದಿಯಾಗಿವೆ. ಏನು ಮಾಡಬೇಕು?
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
                ಹಳದಿ ಎಲೆಗಳಿಗೆ ಸಾಮಾನ್ಯ ಕಾರಣಗಳು: ಸಾರಜನಕ (N) ಕೊರತೆ, ನೀರ ಹೆಚ್ಚು/ಕಡಿಮೆ,
                ಅಥವಾ ಕೀಟ. ಸಂಭಾವ್ಯ ಕಾರಣ ತಿಳಿಯಲು ಎಲೆಯ ಫೋಟೋ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ ಮತ್ತು
                ಮಣ್ಣಿನ ಪರೀಕ್ಷೆ ಮಾಡಿಸಿ.
              </p>
              <p className="mt-1 text-[8px] font-semibold text-[#5c574b]">
                ⚠ ಸಂಭಾವ್ಯ ಸಲಹೆ — ಖಚಿತಪಡಿಸಲು ತಜ್ಞರನ್ನು ಕಾಣಿ
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.6 }}
              className="flex items-center gap-2 border-2 border-[#141414] bg-white px-2.5 py-1.5"
            >
              <span className="text-[10px] font-semibold text-[#5c574b]">
                ಪ್ರಶ್ನೆ ಬರೆಯಿರಿ ಅಥವಾ ಹೇಳಿ…
              </span>
              <span className="ml-auto text-sm">🎤</span>
            </motion.div>
          </div>
        </PhoneFrame>
      </div>
    </SceneWrap>
  );
}

function S9Success() {
  return (
    <SceneWrap caption={SCENES[8].vo}>
      <SkyField healthy>
        <motion.div
          animate={{ x: [-30, 30], y: [0, -4, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[30%] left-1/2 flex -translate-x-1/2 items-end gap-1 text-6xl sm:text-7xl"
        >
          <span>🧑‍🌾</span>
          <span className="text-5xl">👩‍🌾</span>
          <span className="text-4xl">🧒</span>
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
            🌿 ಆರೋಗ್ಯವಂತ ಬೆಳೆ
          </span>
        </motion.div>
      </SkyField>
    </SceneWrap>
  );
}

function S10CTA() {
  return (
    <SceneWrap caption={SCENES[9].vo}>
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#f5f0e6] px-4 py-6 text-center">
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          className="nb-shadow-sm grid h-20 w-20 place-items-center border-2 border-[#141414] bg-[#ffc53d] text-4xl"
        >
          🌾
        </motion.div>
        <p className="font-display text-3xl uppercase sm:text-4xl">
          KrishiMitra AI
        </p>
        <p className="text-base font-bold">ಕೃಷಿಗಾಗಿ ನಿಮ್ಮ ಡಿಜಿಟಲ್ ಸಹಾಯಕ</p>
        <Link
          to="/auth"
          className="nb-press mt-1 bg-[#2fa35c] px-6 py-3 font-display text-base uppercase text-white"
        >
          ಈಗಲೇ ಪ್ರಯತ್ನಿಸಿ →
        </Link>
        <p className="nb-border bg-white px-3 py-1.5 text-xs font-bold sm:text-sm">
          {SITE}
        </p>
        <p className="text-[10px] font-semibold text-[#5c574b]">
          ಕನ್ನಡ · English · हिन्दी
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
    vo: "ರೈತರಿಗೆ ಬೆಳೆ ಬೆಳೆಯುವಾಗ ಮಣ್ಣು, ಗೊಬ್ಬರ, ರೋಗ ಮತ್ತು ಕೀಟಗಳ ಬಗ್ಗೆ ಹಲವಾರು ಪ್ರಶ್ನೆಗಳು ಬರುತ್ತವೆ. ಇಂತಹ ಸಮಯದಲ್ಲಿ ನಿಮ್ಮ ಮೊಬೈಲ್‌ನಲ್ಲೇ ಕೃಷಿ ಸಹಾಯ ಪಡೆಯಲು KrishiMitra AI ಬಳಸಿ.",
    render: () => <S1Worry />,
  },
  {
    id: "s2",
    seconds: 6,
    vo: "ಮೊದಲು ನಿಮ್ಮ ಮೊಬೈಲ್‌ನಲ್ಲಿ KrishiMitra AI ಆಪ್ ತೆರೆಯಿರಿ.",
    render: () => <S2Open />,
  },
  {
    id: "s3",
    seconds: 6,
    vo: "ನೀವು ಬೆಳೆಯುತ್ತಿರುವ ಬೆಳೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ. ಉದಾಹರಣೆಗೆ ಮೆಕ್ಕೆಜೋಳ.",
    render: () => <S3Crop />,
  },
  {
    id: "s4",
    seconds: 8,
    vo: "ನಿಮ್ಮ ಜಮೀನಿನ ಸ್ಥಳ, ಬೆಳೆ ಮತ್ತು ಕೇಳಲಾಗುವ ಮಾಹಿತಿಯನ್ನು ನಮೂದಿಸಿ.",
    render: () => <S4FarmInfo />,
  },
  {
    id: "s5",
    seconds: 8,
    vo: "ಬೆಳೆಯಲ್ಲಿ ರೋಗ ಅಥವಾ ಕೀಟದ ಸಮಸ್ಯೆ ಇದ್ದರೆ, ಎಲೆಯ ಅಥವಾ ಬೆಳೆಯ ಸ್ಪಷ್ಟವಾದ ಫೋಟೋ ತೆಗೆದು ಆಪ್‌ಗೆ ನೀಡಿ.",
    render: () => <S5Photo />,
  },
  {
    id: "s6",
    seconds: 12,
    vo: "KrishiMitra AI ನಿಮ್ಮ ಮಾಹಿತಿಯನ್ನು ವಿಶ್ಲೇಷಿಸಿ, ಸಮಸ್ಯೆಯ ಬಗ್ಗೆ ಸರಳವಾಗಿ ತಿಳಿಸುತ್ತದೆ ಮತ್ತು ಮುಂದಿನ ಕ್ರಮಗಳ ಬಗ್ಗೆ ಮಾರ್ಗದರ್ಶನ ನೀಡುತ್ತದೆ.",
    render: () => <S6AI />,
  },
  {
    id: "s7",
    seconds: 12,
    vo: "ಮಣ್ಣಿನ ಮಾಹಿತಿ ಲಭ್ಯವಿದ್ದರೆ, N, P, K ಮತ್ತು pH ಮುಂತಾದ ಮಾಹಿತಿಯನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲು ಸಹಾಯ ಪಡೆಯಬಹುದು. ಗೊಬ್ಬರ ಬಳಸುವ ಮೊದಲು ಸ್ಥಳೀಯ ಕೃಷಿ ಅಧಿಕಾರಿಗಳ ಅಥವಾ ತಜ್ಞರ ಸಲಹೆಯನ್ನೂ ಪಡೆಯಿರಿ.",
    render: () => <S7Soil />,
  },
  {
    id: "s8",
    seconds: 10,
    vo: "ನಿಮಗೆ ಯಾವುದೇ ಕೃಷಿ ಪ್ರಶ್ನೆ ಇದ್ದರೆ, ಸರಳವಾಗಿ ಪ್ರಶ್ನೆಯನ್ನು ಕೇಳಿ.",
    render: () => <S8Chat />,
  },
  {
    id: "s9",
    seconds: 8,
    vo: "ಸರಿಯಾದ ಮಾಹಿತಿಯನ್ನು ಸರಿಯಾದ ಸಮಯದಲ್ಲಿ ಪಡೆದು, ನಿಮ್ಮ ಕೃಷಿ ನಿರ್ಧಾರಗಳನ್ನು ಇನ್ನಷ್ಟು ಸುಲಭವಾಗಿ ತೆಗೆದುಕೊಳ್ಳಿ.",
    render: () => <S9Success />,
  },
  {
    id: "s10",
    seconds: 10,
    vo: "KrishiMitra AI — ನಿಮ್ಮ ಕೃಷಿ ಪ್ರಶ್ನೆಗಳಿಗೆ ಡಿಜಿಟಲ್ ಸಹಾಯ.",
    render: () => <S10CTA />,
  },
];

const LABELS: PlayerLabels = {
  playAria: "ವೀಡಿಯೊ ಪ್ಲೇ ಮಾಡಿ",
  watchTitle: "ವೀಡಿಯೊ ನೋಡಿ",
  watchSub: "90 ಸೆಕೆಂಡು · ಕನ್ನಡದಲ್ಲಿ · ಫೋನ್‌ನಲ್ಲಿ ಕೃಷಿ ಸಹಾಯ ಹೇಗೆ ಪಡೆಯುವುದು",
  play: "ಪ್ಲೇ",
  pause: "ವಿರಾಮ",
  restart: "ಪುನಃ",
  voiceOn: "ಧ್ವನಿ ಆನ್",
  voiceOff: "ಧ್ವನಿ ಆಫ್",
  storyboardTitle: "ವೀಡಿಯೊ ಯೋಜನೆ (10 ದೃಶ್ಯಗಳು)",
  sceneWord: "ದೃಶ್ಯ",
  footerNote:
    "ಈ ವೀಡಿಯೊದಲ್ಲಿ AI ಸಲಹೆಗಳು \"ಸಂಭಾವ್ಯ\" ಮತ್ತು \"ಶಿಫಾರಸು\" ಎಂದೇ ತೋರಿಸಲಾಗಿದೆ — ಖಾತರಿ ಅಲ್ಲ. ಗೊಬ್ಬರ ಮತ್ತು ಕೀಟ ನಿರ್ವಹಣೆಗೆ ಸ್ಥಳೀಯ ಕೃಷಿ ಅಧಿಕಾರಿಗಳ ಸಲಹೆ ಪಡೆಯಿರಿ. ಧ್ವನಿ (voiceover) ನಿಮ್ಮ ಫೋನ್‌ನ ಕನ್ನಡ ವಾಕ್ ಎಂಜಿನ್ ಮೇಲೆ ಅವಲಂಬಿತವಾಗಿದೆ; ಧ್ವನಿ ಬಾರದಿದ್ದರೆ ಕ್ಯಾಪ್ಶನ್‌ನಲ್ಲಿ ಪೂರ್ತಿ ಮಾತು ಕಾಣಿಸುತ್ತದೆ.",
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Promo() {
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
              ವೀಡಿಯೊ · 90 ಸೆಕೆಂಡು
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/promo-hi"
            className="nb-press bg-white px-3 py-1.5 text-xs font-bold"
          >
            हिंदी ▸
          </Link>
          <Link
            to="/promo-en"
            className="nb-press bg-white px-3 py-1.5 text-xs font-bold uppercase"
          >
            English ▸
          </Link>
          <Link
            to="/"
            className="nb-press bg-white px-3 py-1.5 text-xs font-bold uppercase"
          >
            ← ಮುಖಪುಟ
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16">
        <StoryboardPlayer
          scenes={SCENES}
          aspect="16:9"
          narrationLang="kn-IN"
          labels={LABELS}
        />
      </main>
    </div>
  );
}
