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
 * KrishiMitra AI — vertical (9:16) tutorial / awareness video, Hindi.
 *
 * 10 scenes · ~90 seconds · Hindi only (narration, subtitles, on-screen
 * text) — brand name "KrishiMitra AI" and the website URL stay in Latin
 * script. Built for WhatsApp Status, Instagram Reels and YouTube Shorts.
 * AI results are always labelled "संभावित समस्या" / "AI आधारित सुझाव" —
 * never guaranteed — and expert advice is promoted for serious problems
 * and fertilizer use.
 */

/* ------------------------------------------------------------------ */
/* Scenes                                                              */
/* ------------------------------------------------------------------ */

function S1Problem() {
  const chips = ["मिट्टी?", "खाद?", "बीमारी?", "कीट?"];
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
          <span className="nb-border bg-[#ffc53d] px-2.5 py-1 text-[10px] font-bold">
            पीली पत्तियां · कीट
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
              आपका डिजिटल कृषि सहायक
            </p>
            <span className="nb-border bg-[#2fa35c] px-3 py-1.5 text-[10px] font-bold text-white">
              ▶ शुरू करें
            </span>
          </div>
        </PhoneFrame>
      </div>
    </SceneWrap>
  );
}

function S3Crop() {
  const rows = [
    { icon: "🌽", label: "मक्का", pick: true },
    { icon: "🌾", label: "धान", pick: false },
    { icon: "🫘", label: "चना", pick: false },
    { icon: "🍅", label: "टमाटर", pick: false },
  ];
  return (
    <SceneWrap caption={SCENES[2].vo}>
      <div className="flex h-full items-center justify-center bg-[#ede7d8] py-4">
        <PhoneFrame>
          <AppHeader title="फसल चुनें" />
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
    { icon: "📍", label: "स्थान", value: "हावेरी, कर्नाटक", auto: true },
    { icon: "🌦️", label: "मौसम", value: "28°C · बारिश 5 मिमी", auto: true },
    { icon: "🌱", label: "खेत का क्षेत्रफल", value: "2 एकड़", auto: false },
    { icon: "🗓️", label: "सीजन", value: "खरीफ", auto: false },
  ];
  return (
    <SceneWrap caption={SCENES[3].vo}>
      <div className="flex h-full items-center justify-center bg-[#ede7d8] py-4">
        <PhoneFrame>
          <AppHeader title="खेत की जानकारी" />
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
                  <span className="ml-auto border-2 border-[#141414] bg-[#7fb069]/50 px-1.5 py-0.5 text-[8px] font-bold">
                    ऑटो
                  </span>
                )}
              </motion.div>
            ))}
            <p className="pt-1 text-center text-[9px] font-semibold text-[#5c574b]">
              📍 स्थान और मौसम अपने आप भर जाता है
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
            <p className="absolute bottom-14 left-0 right-0 text-center text-[10px] font-bold tracking-widest text-white/80">
              पत्ते की साफ फोटो लें
            </p>
            {/* shutter */}
            <div className="flex items-center justify-center gap-6 bg-[#141414] py-3">
              <span className="text-lg">🖼️</span>
              <motion.button
                type="button"
                animate={{ scale: [1, 0.92, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, delay: 1 }}
                className="grid h-11 w-11 place-items-center rounded-full border-4 border-white bg-[#d64545]"
                aria-label="फोटो लें"
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
          <AppHeader title="AI विश्लेषण" />
          <div className="space-y-2 bg-[#f5f0e6] p-3">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-2 border-2 border-[#141414] bg-white px-2.5 py-1.5"
            >
              <span className="text-base">🌽</span>
              <span className="text-[10px] font-bold">मक्का · पत्ती</span>
              <span className="ml-auto border-2 border-[#141414] bg-[#ffc53d] px-1.5 py-0.5 text-[8px] font-bold">
                मध्यम तनाव
              </span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="border-2 border-[#141414] bg-white p-2"
            >
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#5c574b]">
                🔍 संभावित समस्या
              </p>
              <p className="text-[11px] font-bold">
                पोषक तत्वों की कमी / पत्ती रोग के लक्षण
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.8 }}
              className="border-2 border-[#141414] bg-[#7fb069]/30 p-2"
            >
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#5c574b]">
                ✅ आगे क्या करें
              </p>
              <ul className="mt-1 space-y-1 text-[10px] font-semibold">
                <li>• निचली पत्तियां देखें, करीब से फोटो लें</li>
                <li>• मिट्टी की नमी जांचें</li>
                <li>• 7 दिन बाद दोबारा फोटो लें</li>
              </ul>
            </motion.div>
            <p className="text-[8px] font-semibold leading-snug text-[#5c574b]">
              ⚠ AI आधारित सुझाव — गारंटीशुदा निदान नहीं
            </p>
          </div>
        </PhoneFrame>
      </div>
    </SceneWrap>
  );
}

function S7Soil() {
  const tiles = [
    { k: "N", v: "240", u: "किग्रा/हे" },
    { k: "P", v: "38", u: "किग्रा/हे" },
    { k: "K", v: "220", u: "किग्रा/हे" },
    { k: "pH", v: "7.2", u: "" },
  ];
  return (
    <SceneWrap caption={SCENES[6].vo}>
      <div className="flex h-full items-center justify-center bg-[#ede7d8] py-4">
        <PhoneFrame>
          <AppHeader title="मिट्टी की जानकारी" />
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
                🧪 मिट्टी की जांच / मृदा स्वास्थ्य कार्ड से
              </p>
              <p className="mt-1 text-[9px] font-semibold leading-snug text-[#5c574b]">
                GPS या उपग्रह N·P·K·pH नहीं मापते — मान केवल मिट्टी जांच से
              </p>
            </div>
            <div className="border-2 border-[#141414] bg-[#ffc53d]/50 px-2.5 py-2">
              <p className="text-[10px] font-bold leading-snug">
                👨‍🌾 खाद का उपयोग मिट्टी की जांच और कृषि विशेषज्ञ की सलाह के
                अनुसार करें।
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
          <AppHeader title="सवाल पूछें" />
          <div className="space-y-2.5 bg-[#f5f0e6] p-3">
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="ml-6 border-2 border-[#141414] bg-[#ffc53d] px-3 py-2 text-[10px] font-bold leading-snug"
            >
              मेरी मक्के की पत्तियां पीली हो रही हैं। इसका कारण क्या हो सकता
              है?
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
                पीली पत्तियों के सामान्य कारण: नाइट्रोजन (N) की कमी, पानी कम या
                ज्यादा, या कीट। संभावित कारण जानने के लिए पत्ते की फोटो अपलोड
                करें और मिट्टी जांच कराएं।
              </p>
              <p className="mt-1 text-[8px] font-semibold text-[#5c574b]">
                ⚠ AI आधारित मार्गदर्शन — विशेषज्ञ से पुष्टि करें
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.6 }}
              className="flex items-center gap-2 border-2 border-[#141414] bg-white px-2.5 py-1.5"
            >
              <span className="text-[10px] font-semibold text-[#5c574b]">
                अपना सवाल लिखें या बोलें…
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
          <span className="nb-border bg-[#2fa35c] px-3 py-1.5 text-xs font-bold text-white">
            🌿 स्वस्थ फसल
          </span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.2 }}
          className="absolute inset-x-4 bottom-[44%]"
        >
          <p className="nb-border bg-white/95 px-3 py-2 text-center text-[10px] font-bold leading-snug">
            👨‍🌾 गंभीर समस्या होने पर स्थानीय कृषि अधिकारी या विशेषज्ञ से सलाह
            लें
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
        <p className="text-sm font-bold">आपका डिजिटल कृषि सहायक</p>
        <p className="text-[11px] font-semibold tracking-wide text-[#5c574b]">
          पूछें • समझें • सीखें • स्मार्ट खेती करें
        </p>
        <Link
          to="/auth"
          className="nb-press mt-1 bg-[#2fa35c] px-6 py-3 font-display text-sm text-white"
        >
          अभी इस्तेमाल करें →
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
    vo: "खेती करते समय किसानों को फसल की बीमारी, कीट, मिट्टी और खाद के बारे में कई सवाल होते हैं। KrishiMitra AI आपके मोबाइल पर कृषि संबंधी जानकारी प्राप्त करने में आपकी मदद कर सकता है।",
    render: () => <S1Problem />,
  },
  {
    id: "s2",
    seconds: 6,
    vo: "सबसे पहले अपने मोबाइल में KrishiMitra AI खोलें।",
    render: () => <S2Open />,
  },
  {
    id: "s3",
    seconds: 6,
    vo: "अपनी फसल चुनें। उदाहरण के लिए, मक्का।",
    render: () => <S3Crop />,
  },
  {
    id: "s4",
    seconds: 8,
    vo: "अपनी फसल, खेत और स्थान से जुड़ी उपलब्ध जानकारी दर्ज करें।",
    render: () => <S4FarmInfo />,
  },
  {
    id: "s5",
    seconds: 8,
    vo: "अगर आपकी फसल में बीमारी या कीट की समस्या है, तो प्रभावित पौधे या पत्ते की साफ फोटो लेकर ऐप में अपलोड करें।",
    render: () => <S5Photo />,
  },
  {
    id: "s6",
    seconds: 12,
    vo: "KrishiMitra AI आपकी जानकारी का विश्लेषण करके संभावित समस्या और आगे क्या करना चाहिए, इसकी जानकारी देता है।",
    render: () => <S6AI />,
  },
  {
    id: "s7",
    seconds: 12,
    vo: "अगर मिट्टी की जानकारी उपलब्ध है, तो N, P, K और pH जैसी जानकारी को समझने और खाद प्रबंधन में मदद लेने के लिए इसका उपयोग कर सकते हैं।",
    render: () => <S7Soil />,
  },
  {
    id: "s8",
    seconds: 10,
    vo: "आप अपने खेती से जुड़े सवाल भी सरल भाषा में पूछ सकते हैं और AI आधारित मार्गदर्शन प्राप्त कर सकते हैं।",
    render: () => <S8Chat />,
  },
  {
    id: "s9",
    seconds: 8,
    vo: "मिली जानकारी को मार्गदर्शन के रूप में उपयोग करें। गंभीर समस्या होने पर स्थानीय कृषि अधिकारी या विशेषज्ञ से सलाह लें।",
    render: () => <S9Confident />,
  },
  {
    id: "s10",
    seconds: 10,
    vo: "KrishiMitra AI — स्मार्ट खेती के लिए आपका डिजिटल सहायक। आज ही इस्तेमाल करें।",
    render: () => <S10CTA />,
  },
];

const LABELS: PlayerLabels = {
  playAria: "वीडियो चलाएं",
  watchTitle: "वीडियो देखें",
  watchSub:
    "90 सेकंड · हिंदी में · मोबाइल पर KrishiMitra AI कैसे इस्तेमाल करें",
  play: "चलाएं",
  pause: "रोकें",
  restart: "फिर से",
  voiceOn: "आवाज़ चालू",
  voiceOff: "मौन",
  storyboardTitle: "वीडियो स्टोरीबोर्ड (10 दृश्य)",
  sceneWord: "दृश्य",
  footerNote:
    "इस वीडियो में AI नतीजे \"संभावित समस्या\" और \"AI आधारित सुझाव\" के रूप में दिखाए गए हैं — कोई गारंटीशुदा निदान या उपज नहीं। खाद का उपयोग मिट्टी की जांच और कृषि विशेषज्ञ की सलाह के अनुसार करें। आवाज़ (voiceover) आपके फोन के हिंदी स्पीच इंजन पर निर्भर है; आवाज़ न होने पर पूरी बात सबटाइटल में दिखती है।",
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function PromoHi() {
  return (
    <div className="nb-dots min-h-screen bg-[#f5f0e6] text-[#141414]">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="nb-shadow-sm grid h-10 w-10 place-items-center border-2 border-[#141414] bg-[#ffc53d] text-lg">
            🌾
          </div>
          <div className="leading-tight">
            <p className="font-display text-base uppercase">KrishiMitra AI</p>
            <p className="text-[10px] font-semibold text-[#5c574b]">
              ट्यूटोरियल वीडियो · 9:16 · ~90 सेकंड
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/promo"
            className="nb-press bg-white px-3 py-1.5 text-xs font-bold"
          >
            ಕನ್ನಡ ▸
          </Link>
          <Link
            to="/promo-en"
            className="nb-press bg-white px-3 py-1.5 text-xs font-bold uppercase"
          >
            English ▸
          </Link>
          <Link
            to="/"
            className="nb-press bg-white px-3 py-1.5 text-xs font-bold"
          >
            ← होम
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16">
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <p className="nb-border bg-white px-3 py-2 text-center text-[11px] font-bold">
            📱 9:16 वर्टिकल
          </p>
          <p className="nb-border bg-white px-3 py-2 text-center text-[11px] font-bold">
            🌐 हिंदी में
          </p>
          <p className="nb-border bg-white px-3 py-2 text-center text-[11px] font-bold">
            🎬 10 दृश्य · ~90 सेकंड
          </p>
        </div>

        <StoryboardPlayer
          scenes={SCENES}
          aspect="9:16"
          narrationLang="hi-IN"
          labels={LABELS}
        />

        <p className="mt-4 text-center text-[11px] font-semibold text-[#5c574b]">
          WhatsApp Status, Instagram Reels और YouTube Shorts के लिए तैयार।
          प्रोडक्शन स्क्रिप्ट: <code>docs/promo-video-script-hi.md</code>
        </p>
      </main>
    </div>
  );
}
