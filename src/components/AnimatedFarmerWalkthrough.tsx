import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bot,
  Camera,
  CloudSunRain,
  FlaskConical,
  IndianRupee,
  LifeBuoy,
  MapPin,
  Mic,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  Sprout,
  Volume2,
  VolumeX,
  Wheat,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { IconBadge } from "@/components/IconBadge";
import { speak, stopSpeaking } from "@/lib/voice";
import type { Lang } from "@/lib/i18n";

interface GuideStep {
  title: string;
  narration: string;
  target: string;
}

interface GuideCopy {
  title: string;
  subtitle: string;
  play: string;
  pause: string;
  restart: string;
  voiceOn: string;
  voiceOff: string;
  steps: GuideStep[];
}

const GUIDE_COPY: Record<Lang, GuideCopy> = {
  kn: {
    title: "Animated Farmer Walkthrough",
    subtitle: "ಆರು ದೃಶ್ಯಗಳಲ್ಲಿ ಕೃಷಿಮಿತ್ರ AI ನಿಮ್ಮ ಹೊಲಕ್ಕೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡುತ್ತದೆ ನೋಡಿ.",
    play: "ವೀಡಿಯೊ ಪ್ರಾರಂಭಿಸಿ",
    pause: "ವಿರಾಮ",
    restart: "ಮತ್ತೆ ಪ್ರಾರಂಭಿಸಿ",
    voiceOn: "ನಿರೂಪಣೆ ಆನ್",
    voiceOff: "ನಿರೂಪಣೆ ಆಫ್",
    steps: [
      {
        title: "GPS ಸ್ಥಳ ಮತ್ತು ಋತು",
        narration: "ನಮಸ್ಕಾರ ರೈತ ಬಂಧುಗಳೇ, ಕೃಷಿಮಿತ್ರ AIಗೆ ಸ್ವಾಗತ. “Auto-Detect My Farm” ಒತ್ತಿ ನಿಮ್ಮ ಗ್ರಾಮ ಮತ್ತು ಹೊಲದ ಸ್ಥಳವನ್ನು ಗುರುತಿಸಿ. ನಂತರ ಹವಾಮಾನ ಹಾಗೂ ಮಳೆ, ಚಳಿ ಅಥವಾ ಬೇಸಿಗೆ ಋತುವಿನ ಹೆಸರು ಒಂದೇ ಪರದೆಯಲ್ಲಿ ಕಾಣುತ್ತದೆ.",
        target: "Auto-Detect My Farm",
      },
      {
        title: "ಮಣ್ಣಿನ ಆರೋಗ್ಯ ಮತ್ತು ಬೆಳೆ ಆಯ್ಕೆ",
        narration: "ಮಣ್ಣಿನ ಆರೋಗ್ಯ ಕಾರ್ಡ್‌ನ N, P, K ಮತ್ತು pH ಮೌಲ್ಯಗಳನ್ನು ಇಲ್ಲಿ ನಮೂದಿಸಿ. ಈ ಮಾಹಿತಿ ಮಣ್ಣಿನ ಸ್ಥಿತಿಯನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ. ನಂತರ ನಿಮ್ಮ ಸ್ಥಳಕ್ಕೆ ಹೊಂದುವ ಮೂರು ಬೆಳೆ ಆಯ್ಕೆಗಳು ಮತ್ತು ಗೊಬ್ಬರ ಮಾರ್ಗದರ್ಶನವನ್ನು ಪರಿಶೀಲಿಸಿ.",
        target: "N-P-K · AI Crop Match",
      },
      {
        title: "ಎಲೆಯ ಫೋಟೋ ಪರಿಶೀಲನೆ",
        narration: "ಎಲೆಗಳಲ್ಲಿ ಹಳದಿ ಬಣ್ಣ ಅಥವಾ ಚುಕ್ಕೆ ಕಂಡರೆ “Scan Crop Camera” ಆಯ್ಕೆಮಾಡಿ. ನಿಮ್ಮ ಹೊಲದ ಸ್ಪಷ್ಟ ಫೋಟೋ ತೆಗೆದು ಸಾಧ್ಯವಾದ ರೋಗ ಸೂಚನೆ ಮತ್ತು ಆರೈಕೆ ಕ್ರಮಗಳನ್ನು ನೋಡಿ. ಇದು ಸಹಾಯಕ ಸೂಚನೆ ಮಾತ್ರ; ಚಿಕಿತ್ಸೆಗೂ ಮೊದಲು KVK ಅಥವಾ ಕೃಷಿ ಅಧಿಕಾರಿಯಿಂದ ದೃಢಪಡಿಸಿ.",
        target: "Scan Crop Camera",
      },
      {
        title: "ಇಳುವರಿ ಮತ್ತು ಆದಾಯದ ಅಂದಾಜು",
        narration: "ಫಾರ್ಮ್ ಪ್ಲಾನ್‌ನಲ್ಲಿ ಬೆಳೆ ಮತ್ತು ಎಕರೆ ಪ್ರಮಾಣವನ್ನು ಆಯ್ಕೆಮಾಡಿ. ಉದಾಹರಣೆಯಾಗಿ, ಎರಡೂವರೆ ಎಕರೆಯಲ್ಲಿ ಸುಮಾರು ನಲವತ್ತೆರಡು ಕ್ವಿಂಟಾಲ್ ಮತ್ತು ರೂಪಾಯಿ ಎರಡು ಲಕ್ಷ ನಲವತ್ತೈದು ಸಾವಿರದ ಅಂದಾಜು ಕಾಣುತ್ತದೆ. ಇವು ಪ್ರದರ್ಶನದ ಅಂದಾಜುಗಳು; ನಿಜವಾದ ಇಳುವರಿ ಮತ್ತು ಬೆಲೆ ಬದಲಾಗಬಹುದು.",
        target: "Farm Plan · Yield · Revenue",
      },
      {
        title: "ಮಾರುಕಟ್ಟೆ ಮತ್ತು ರೈತ ಸೇವೆಗಳು",
        narration: "Nearby ವಿಭಾಗದಲ್ಲಿ APMC ಮಾರುಕಟ್ಟೆ, ನೇರ ಖರೀದಿದಾರರು ಮತ್ತು ಮಣ್ಣಿನ ಪರೀಕ್ಷಾ ಕೇಂದ್ರಗಳನ್ನು ಹುಡುಕಿ. PM-KISAN ಸೇರಿದಂತೆ ಯೋಜನೆಗಳ ವಿವರವನ್ನು ಅಧಿಕೃತ ಸರ್ಕಾರಿ ಜಾಲತಾಣದಲ್ಲಿ ಪರಿಶೀಲಿಸಿ. ಪ್ರಯಾಣಿಸುವ ಮೊದಲು ವಿಳಾಸ, ಸಮಯ ಮತ್ತು ಅರ್ಹತೆಯನ್ನು ದೃಢಪಡಿಸಿ.",
        target: "APMC · Buyers · Soil Lab · Schemes",
      },
      {
        title: "ಧ್ವನಿ AI ಮತ್ತು ತುರ್ತು ಸಹಾಯ",
        narration: "ಮೈಕ್ ಒತ್ತಿ ಕನ್ನಡ, ಹಿಂದಿ ಅಥವಾ ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಕೃಷಿ ಪ್ರಶ್ನೆಯನ್ನು ಕೇಳಿ. ಸಹಾಯಕನು ಮಣ್ಣು, ಹವಾಮಾನ ಮತ್ತು ಋತುವಿನ ಮಾಹಿತಿಯನ್ನು ಗಮನಿಸಿ ಉತ್ತರಿಸಲು ಪ್ರಯತ್ನಿಸುತ್ತಾನೆ. ತುರ್ತು ಪರಿಸ್ಥಿತಿಯಲ್ಲಿ Help ವಿಭಾಗದ ಸಂಪರ್ಕ ಆಯ್ಕೆಗಳನ್ನು ಬಳಸಿ.",
        target: "Voice AI · Farmer Help",
      },
    ],
  },
  hi: {
    title: "Animated Farmer Walkthrough",
    subtitle: "छह दृश्यों में देखें कि कृषि मित्र AI आपके खेत में कैसे मदद करता है।",
    play: "वीडियो चलाएँ",
    pause: "रोकें",
    restart: "फिर से शुरू करें",
    voiceOn: "आवाज़ चालू",
    voiceOff: "आवाज़ बंद",
    steps: [
      {
        title: "GPS स्थान और मौसम",
        narration: "नमस्कार किसान साथियों, कृषि मित्र AI में आपका स्वागत है। “Auto-Detect My Farm” दबाकर अपना गाँव और खेत का स्थान पहचानें। इसके बाद मौसम और बरसात, सर्दी या गर्मी का आसान नाम एक ही स्क्रीन पर दिखता है।",
        target: "Auto-Detect My Farm",
      },
      {
        title: "मिट्टी की जाँच और फसल सुझाव",
        narration: "मृदा स्वास्थ्य कार्ड पर दिए N, P, K और pH मान यहाँ दर्ज करें। इनसे मिट्टी की स्थिति समझने में मदद मिलती है। फिर अपने क्षेत्र के अनुसार तीन फसल विकल्प और खाद से जुड़ी सलाह देखें।",
        target: "N-P-K · AI Crop Match",
      },
      {
        title: "पत्ती की फोटो जाँच",
        narration: "पत्तियों पर पीलापन या धब्बे दिखें, तो “Scan Crop Camera” चुनें। खेत की साफ फोटो लेकर संभावित रोग संकेत और देखभाल के उपाय देखें। यह केवल सहायक संकेत है; उपचार से पहले KVK या कृषि अधिकारी से पुष्टि करें।",
        target: "Scan Crop Camera",
      },
      {
        title: "उपज और कमाई का अनुमान",
        narration: "फार्म प्लान में फसल और एकड़ चुनें। उदाहरण के लिए, ढाई एकड़ पर लगभग बयालीस क्विंटल उपज और दो लाख पैंतालीस हजार रुपये का अनुमान दिखता है। ये डेमो के अनुमान हैं; असली उपज और भाव अलग हो सकते हैं।",
        target: "Farm Plan · Yield · Revenue",
      },
      {
        title: "मंडी, खरीदार और किसान सेवाएँ",
        narration: "Nearby में APMC मंडी, सीधे खरीदार और मिट्टी जाँच केंद्र खोजें। PM-KISAN सहित योजनाओं की जानकारी आधिकारिक सरकारी वेबसाइट पर जाँचें। यात्रा से पहले पता, समय और पात्रता की पुष्टि करें।",
        target: "APMC · Buyers · Soil Lab · Schemes",
      },
      {
        title: "वॉइस AI और आपात सहायता",
        narration: "माइक दबाकर खेती का सवाल कन्नड़, हिन्दी या अंग्रेज़ी में पूछें। सहायक मिट्टी, मौसम और मौसम-चक्र की जानकारी के आधार पर जवाब देने की कोशिश करेगा। आपात स्थिति में Help पेज के संपर्क विकल्पों का उपयोग करें।",
        target: "Voice AI · Farmer Help",
      },
    ],
  },
  en: {
    title: "Animated Farmer Walkthrough",
    subtitle: "Watch KrishiMitra AI help a farmer through six practical moments.",
    play: "Play video",
    pause: "Pause",
    restart: "Restart",
    voiceOn: "Narration on",
    voiceOff: "Narration off",
    steps: [
      {
        title: "GPS farm location and season",
        narration: "Welcome, farmers, to KrishiMitra AI. Tap “Auto-Detect My Farm” to identify your village and farm location. The screen then shows weather and a simple Rainy, Winter, or Summer season label.",
        target: "Auto-Detect My Farm",
      },
      {
        title: "Soil health and crop match",
        narration: "Enter the N, P, K, and pH values printed on your Soil Health Card. These readings help describe the condition of your soil. Then review three crop options and fertilizer guidance suited to your area.",
        target: "N-P-K · AI Crop Match",
      },
      {
        title: "Check a leaf photo",
        narration: "If leaves look yellow or spotted, choose “Scan Crop Camera.” Take a clear photo from your field to see possible disease signs and care steps. This is guidance, not a confirmed diagnosis, so check with your local KVK before treatment.",
        target: "Scan Crop Camera",
      },
      {
        title: "Estimate harvest and revenue",
        narration: "Choose your crop and acreage in Farm Plan. For example, two and a half acres may show an illustrative estimate of forty-two quintals and two lakh forty-five thousand rupees. These are demo estimates, and real harvests and prices can vary.",
        target: "Farm Plan · Yield · Revenue",
      },
      {
        title: "Find markets and farmer services",
        narration: "Use Nearby to find APMC markets, direct buyers, and soil-testing labs. Check PM-KISAN and other scheme details on official government websites. Confirm the address, hours, and eligibility before travelling.",
        target: "APMC · Buyers · Soil Lab · Schemes",
      },
      {
        title: "Voice AI and urgent help",
        narration: "Tap the microphone and ask a farm question in Kannada, Hindi, or English. The assistant uses available soil, weather, and season details to shape its reply. For urgent situations, use the contact options on the Help page.",
        target: "Voice AI · Farmer Help",
      },
    ],
  },
};

const LANGUAGES: { lang: Lang; label: string }[] = [
  { lang: "kn", label: "ಕನ್ನಡ" },
  { lang: "hi", label: "हिन्दी" },
  { lang: "en", label: "English" },
];

const SCENE_ICONS = [MapPin, FlaskConical, Camera, IndianRupee, CloudSunRain, LifeBuoy] as const;
const CURSOR_SPOTS = [
  { left: "18%", top: "23%" },
  { left: "38%", top: "38%" },
  { left: "25%", top: "63%" },
  { left: "76%", top: "46%" },
  { left: "72%", top: "70%" },
  { left: "48%", top: "63%" },
] as const;

function FarmerCharacter({
  lang,
  speaking,
}: {
  lang: Lang;
  speaking: boolean;
}) {
  const label = lang === "kn" ? "ನಿಮ್ಮ ರೈತ ಮಾರ್ಗದರ್ಶಿ" : lang === "hi" ? "आपका किसान गाइड" : "Your farmer guide";
  return (
    <motion.div
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      className="relative flex h-full flex-col items-center justify-end"
    >
      <svg viewBox="0 0 340 430" className="h-full max-h-full w-full max-w-[330px]" role="img" aria-label={label}>
        <ellipse cx="166" cy="408" rx="96" ry="15" fill="#020b07" opacity=".35" />
        <path d="M92 237Q93 198 131 191H199Q238 200 245 242L267 383H67Z" fill="#2f7548" stroke="#f6fbf8" strokeWidth="5" />
        <path d="M132 202 168 245 202 202 218 379H112Z" fill="#d79a4d" stroke="#70451e" strokeWidth="4" />
        <path d="M147 205 168 246 189 205" fill="none" stroke="#fbe8c7" strokeWidth="7" strokeLinecap="round" />
        <path d="M96 241Q68 260 56 310L81 323 125 270" fill="none" stroke="#2f7548" strokeWidth="27" strokeLinecap="round" />
        <motion.g
          animate={speaking ? { rotate: [0, -4, 2, 0] } : { rotate: [0, -1, 0] }}
          transition={{ duration: speaking ? 0.8 : 3.2, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "240px 240px" }}
        >
          <path d="M236 241Q260 249 280 196" fill="none" stroke="#2f7548" strokeWidth="27" strokeLinecap="round" />
          <path d="M279 198 309 181 322 184" fill="none" stroke="#c77d45" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M279 189Q288 171 296 181L298 190 311 175Q318 168 321 176L313 192 329 185Q338 183 337 191L320 204 294 207Z" fill="#c9844e" stroke="#754628" strokeWidth="3" strokeLinejoin="round" />
        </motion.g>
        <path d="M79 315 59 342" fill="none" stroke="#c77d45" strokeWidth="14" strokeLinecap="round" />
        <rect x="42" y="323" width="38" height="57" rx="6" fill="#153b2a" stroke="#f6fbf8" strokeWidth="3" transform="rotate(-12 42 323)" />
        <rect x="48" y="332" width="25" height="36" rx="2" fill="#8bd3b2" transform="rotate(-12 48 332)" />
        <path d="M151 154H187V205Q170 221 151 204Z" fill="#bd7745" />
        <ellipse cx="169" cy="117" rx="68" ry="79" fill="#c9844e" stroke="#754628" strokeWidth="4" />
        <path d="M101 110Q100 44 168 39Q236 44 237 112L214 94Q178 71 122 95Z" fill="#d98f32" stroke="#854f19" strokeWidth="5" />
        <path d="M111 82Q167 61 227 83M118 66Q170 48 219 68" fill="none" stroke="#f4c368" strokeWidth="7" strokeLinecap="round" />
        <path d="M101 112Q86 111 91 132Q96 146 108 139M236 112Q251 111 246 132Q241 146 229 139" fill="#c9844e" stroke="#754628" strokeWidth="4" />
        <motion.ellipse cx="145" cy="119" rx="6" ry="4" fill="#2b2118" animate={{ scaleY: [1, 1, 0.12, 1, 1] }} transition={{ duration: 4, repeat: Infinity, times: [0, 0.45, 0.5, 0.55, 1] }} />
        <motion.ellipse cx="193" cy="119" rx="6" ry="4" fill="#2b2118" animate={{ scaleY: [1, 1, 0.12, 1, 1] }} transition={{ duration: 4, repeat: Infinity, times: [0, 0.45, 0.5, 0.55, 1] }} />
        <path d="M133 103Q145 96 155 102M183 102Q194 96 205 103" fill="none" stroke="#51311e" strokeWidth="5" strokeLinecap="round" />
        <path d="M167 123 161 143 174 145" fill="none" stroke="#754628" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M139 151Q168 176 199 151Q190 181 168 181Q148 177 139 151Z" fill="#51311e" />
        <motion.ellipse cx="169" cy="163" rx="10" fill="#e47766" animate={speaking ? { ry: [3, 10, 4] } : { ry: 3 }} transition={speaking ? { duration: 0.32, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }} />
        <path d="M119 263Q97 298 85 310M226 250Q254 238 280 197" fill="none" stroke="#f5c99f" strokeWidth="6" strokeLinecap="round" opacity=".6" />
        <path d="M92 390Q165 372 243 390L254 410H80Z" fill="#172b20" />
        <path d="M99 393Q169 378 235 393" fill="none" stroke="#eab308" strokeWidth="5" />
        <path d="M64 325Q47 305 43 282Q63 277 73 296Q84 282 97 282Q98 307 79 325Z" fill="#6ba848" stroke="#d6e5a0" strokeWidth="3" />
        <path d="M48 318 91 290" stroke="#d6e5a0" strokeWidth="3" />
      </svg>
      <span className="absolute bottom-1 left-0 rounded-full border border-white/15 bg-black/30 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/80">
        {label}
      </span>
    </motion.div>
  );
}

function AppStage({ scene, lang }: { scene: number; lang: Lang }) {
  const [acreage, setAcreage] = useState(2.5);
  const cursorSpot = CURSOR_SPOTS[scene]!;
  const answer = lang === "kn"
    ? "ಮಣ್ಣು ಪರೀಕ್ಷಿಸಿ, ಹಂತವಾಗಿ ಗೊಬ್ಬರ ನೀಡಿ."
    : lang === "hi"
      ? "मिट्टी जाँचें और खाद चरणों में दें।"
      : "Test soil and apply nutrients in split doses.";

  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-2xl border border-[#A9D7B5]/30 bg-[#EAF4EC] p-2.5 text-[#102318] shadow-[0_20px_50px_-25px_rgba(0,0,0,.8)] sm:p-4">
      <div className="relative z-20 mb-2 flex items-center justify-between border-b border-[#1B4332]/15 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="grid size-6 place-items-center rounded-lg bg-[#1B4332] text-white"><Sprout className="size-4" /></span>
          <span className="text-[10px] font-black uppercase tracking-wide sm:text-xs">KrishiMitra AI</span>
        </div>
        <span className="rounded-full border border-[#1B4332]/15 bg-white px-2 py-1 text-[8px] font-bold uppercase text-[#1B4332] sm:text-[9px]">Interactive demo</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={scene}
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -18 }}
          transition={{ duration: 0.32 }}
          className="relative h-[calc(100%-2.25rem)]"
        >
          {scene === 0 && (
            <div className="grid h-full grid-cols-[1.05fr_.95fr] gap-2 sm:gap-3">
              <div className="flex flex-col justify-center">
                <p className="text-[8px] font-black uppercase tracking-wider text-[#52735c] sm:text-[10px]">Farm location</p>
                <div className="mt-2 rounded-xl bg-[#1B4332] p-2.5 text-white shadow sm:p-3">
                  <p className="text-[8px] font-bold uppercase sm:text-[10px]">⌖ Auto-Detect My Farm</p>
                  <p className="mt-1 text-[8px] text-white/70 sm:text-[10px]">GPS + weather + season</p>
                </div>
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-2 flex items-center gap-2 rounded-xl border border-[#1B4332]/10 bg-white p-2">
                  <MapPin className="size-4 shrink-0 text-[#D97706]" />
                  <span className="text-[9px] font-bold sm:text-xs">Devanahalli, Karnataka</span>
                </motion.div>
                <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.55 }} className="mt-2 flex items-center justify-between rounded-xl bg-[#DCEFE1] p-2">
                  <span className="text-[9px] font-bold sm:text-xs">26°C · Winter Season</span>
                  <CloudSunRain className="size-4 text-[#2F6B46]" />
                </motion.div>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-[#1B4332]/15 bg-[#CBE5D1]">
                <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(35deg, transparent 47%, #fff 48%, #fff 50%, transparent 51%), linear-gradient(125deg, transparent 47%, #fff 48%, #fff 50%, transparent 51%)", backgroundSize: "54px 54px" }} />
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.35 }} className="absolute left-[52%] top-[43%] grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#D97706] text-white shadow-lg ring-4 ring-[#D97706]/25">
                  <MapPin className="size-4" />
                </motion.div>
                <span className="absolute bottom-2 left-2 rounded-lg bg-white/90 px-2 py-1 text-[8px] font-bold sm:text-[10px]">Bengaluru Rural</span>
              </div>
            </div>
          )}

          {scene === 1 && (
            <div className="flex h-full flex-col justify-center">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { name: "N", value: "19", width: "72%" },
                  { name: "P", value: "20", width: "58%" },
                  { name: "K", value: "40", width: "84%" },
                ].map((item, index) => (
                  <div key={item.name} className="rounded-xl border border-[#1B4332]/10 bg-white p-2">
                    <div className="flex justify-between text-[9px] font-black"><span>{item.name}</span><span>{item.value}</span></div>
                    <div className="mt-2 h-1.5 rounded-full bg-[#E9F2EC]">
                      <motion.div initial={{ width: 0 }} animate={{ width: item.width }} transition={{ duration: 0.8, delay: index * 0.16 }} className="h-full rounded-full bg-gradient-to-r from-[#4D9B66] to-[#EAB308]" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between rounded-lg bg-[#1B4332] px-3 py-2 text-white">
                <span className="text-[9px] font-bold sm:text-[10px]">Soil Health Card · pH 6.4</span>
                <FlaskConical className="size-4" />
              </div>
              <p className="mb-1 mt-2 text-[8px] font-black uppercase tracking-wide text-[#52735c] sm:text-[10px]">Top AI crop matches</p>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  ["Pomegranate", "94%"],
                  ["Ragi", "89%"],
                  ["Maize", "85%"],
                ].map(([name, score], index) => (
                  <motion.div key={name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 + index * 0.16 }} className="rounded-lg border border-[#1B4332]/10 bg-white p-2 text-center">
                    <Sprout className="mx-auto size-4 text-[#2F6B46]" />
                    <p className="mt-1 text-[8px] font-bold sm:text-[10px]">{name}</p>
                    <span className="mt-1 inline-block rounded-full bg-[#DDF1E4] px-1.5 py-0.5 text-[8px] font-black text-[#1B4332]">{score}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {scene === 2 && (
            <div className="grid h-full grid-cols-[.8fr_1.2fr] items-center gap-2 sm:gap-4">
              <div className="relative mx-auto w-full max-w-36">
                <svg viewBox="0 0 180 220" className="w-full">
                  <path d="M22 188C33 91 85 27 159 22 157 111 107 184 22 188Z" fill="#4d8c49" stroke="#1B4332" strokeWidth="5" />
                  <path d="M25 185 145 33M81 113 64 66M104 88l30-34M85 130l-35-8M111 97l27-1" fill="none" stroke="#d6e5a0" strokeWidth="4" strokeLinecap="round" />
                  <g fill="#bd7541" stroke="#f6d29a" strokeWidth="3">
                    <circle cx="91" cy="91" r="8" /><circle cx="116" cy="62" r="7" /><circle cx="104" cy="133" r="9" />
                  </g>
                  <motion.path d="M14 105H166" stroke="#8cffb4" strokeWidth="4" animate={{ y: [-58, 60, -58], opacity: [.15, 1, .15] }} transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }} />
                </svg>
              </div>
              <div>
                <div className="rounded-xl border border-[#1B4332]/10 bg-white p-2.5 sm:p-3">
                  <div className="flex items-center gap-2 text-[9px] font-black uppercase text-[#52735c] sm:text-[10px]"><Camera className="size-4" /> Scan Crop Camera</div>
                  <motion.div initial={{ scale: .75, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: .45 }} className="mt-2 flex items-center gap-2 rounded-lg bg-[#FDE7D5] p-2">
                    <BadgeCheck className="size-5 shrink-0 text-[#1B7A43]" />
                    <div>
                      <p className="text-[9px] font-black sm:text-[11px]">Early Leaf Spot</p>
                      <p className="text-[8px] text-[#52735c]">Possible indication · verify locally</p>
                    </div>
                  </motion.div>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .72 }} className="mt-2 rounded-lg bg-[#DDF1E4] p-2 text-[8px] font-bold sm:text-[10px]">
                    Organic care: remove affected leaves; use neem spray only if advised by KVK.
                  </motion.p>
                </div>
              </div>
            </div>
          )}

          {scene === 3 && (
            <div className="flex h-full flex-col justify-center">
              <div className="flex items-center justify-between text-[8px] font-black uppercase text-[#52735c] sm:text-[10px]">
                <span>Estimated Farm Plan</span><span className="rounded-full bg-white px-2 py-1">Pomegranate</span>
              </div>
              <div className="mt-2 rounded-xl border border-[#1B4332]/10 bg-white p-2.5 sm:p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold sm:text-[11px]">Acreage</span>
                  <span className="rounded-full bg-[#DDF1E4] px-2 py-1 text-[9px] font-black text-[#1B4332]">{acreage.toFixed(1)} Acres</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={acreage}
                  onChange={(event) => setAcreage(Number(event.target.value))}
                  aria-label="Demo farm acreage"
                  className="mt-2 w-full accent-[#1B4332]"
                />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <motion.div layout className="rounded-xl bg-[#1B4332] p-2.5 text-white sm:p-3">
                  <div className="flex items-center gap-1 text-[8px] font-bold uppercase text-white/70"><Wheat className="size-3" /> Expected yield</div>
                  <p className="mt-1 text-base font-black sm:text-xl">{Math.round(42 * acreage / 2.5)} Quintals</p>
                </motion.div>
                <motion.div layout className="rounded-xl bg-[#EAB308] p-2.5 text-[#102318] sm:p-3">
                  <div className="flex items-center gap-1 text-[8px] font-bold uppercase"><IndianRupee className="size-3" /> Estimated revenue</div>
                  <p className="mt-1 text-base font-black sm:text-xl">₹{Math.round(245000 * acreage / 2.5).toLocaleString("en-IN")}</p>
                </motion.div>
              </div>
              <p className="mt-2 text-[8px] font-semibold text-[#52735c]">Illustrative demo estimate; actual yield and prices vary.</p>
            </div>
          )}

          {scene === 4 && (
            <div className="grid h-full grid-cols-[1fr_.85fr] gap-2 sm:gap-3">
              <div className="relative overflow-hidden rounded-xl border border-[#1B4332]/15 bg-[#CBE5D1]">
                <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(35deg, transparent 47%, #fff 48%, #fff 50%, transparent 51%), linear-gradient(125deg, transparent 47%, #fff 48%, #fff 50%, transparent 51%)", backgroundSize: "50px 50px" }} />
                {[["20%", "29%"], ["62%", "44%"], ["42%", "73%"]].map(([left, top], index) => (
                  <motion.span key={left} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: index * .2 }} style={{ left, top }} className="absolute grid size-7 place-items-center rounded-full bg-[#D97706] text-white shadow-lg ring-4 ring-white/60"><MapPin className="size-3.5" /></motion.span>
                ))}
                <span className="absolute bottom-2 left-2 rounded-md bg-white/90 px-2 py-1 text-[8px] font-black">Bengaluru Rural</span>
              </div>
              <div className="flex flex-col justify-center gap-1.5">
                {[
                  ["APMC Mandi", "3.2 km"],
                  ["Direct FPO Buyer", "Open today"],
                  ["Soil Lab", "Testing service"],
                ].map(([name, detail], index) => (
                  <motion.div key={name} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .16 * index }} className="rounded-lg border border-[#1B4332]/10 bg-white px-2 py-1.5">
                    <p className="text-[8px] font-black sm:text-[10px]">{name}</p>
                    <p className="text-[7px] font-semibold text-[#52735c] sm:text-[9px]">{detail}</p>
                  </motion.div>
                ))}
                <motion.div initial={{ scale: .8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: .65 }} className="mt-1 flex items-center gap-1.5 rounded-lg bg-[#DDF1E4] px-2 py-1.5">
                  <BadgeCheck className="size-4 text-[#1B7A43]" />
                  <span className="text-[8px] font-black sm:text-[10px]">PM-KISAN · verify official portal</span>
                </motion.div>
              </div>
            </div>
          )}

          {scene === 5 && (
            <div className="flex h-full flex-col items-center justify-center">
              <div className="relative grid size-20 place-items-center sm:size-24">
                {[0, 1, 2].map((ring) => (
                  <motion.span key={ring} className="absolute inset-0 rounded-full border-2 border-[#2F9B60]" animate={{ scale: [0.65, 1.5], opacity: [.65, 0] }} transition={{ duration: 1.8, repeat: Infinity, delay: ring * .55, ease: "easeOut" }} />
                ))}
                <span className="relative z-10 grid size-14 place-items-center rounded-full bg-[#1B4332] text-white shadow-lg sm:size-16"><Mic className="size-7" /></span>
                <span className="absolute -bottom-1 -right-2 grid size-8 place-items-center rounded-full border-2 border-white bg-[#EAB308] text-[#102318]"><span className="text-[8px] font-black">{lang === "kn" ? "ಕೇಳಿ" : lang === "hi" ? "पूछें" : "ASK"}</span></span>
              </div>
              <div className="mt-3 flex h-7 items-center gap-1">
                {Array.from({ length: 13 }, (_, index) => (
                  <motion.span key={index} className="w-1 rounded-full bg-[#2F9B60]" animate={{ height: [5, 8 + ((index * 7) % 17), 5] }} transition={{ duration: .65 + (index % 4) * .12, repeat: Infinity, delay: index * .04 }} />
                ))}
              </div>
              <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .4 }} className="mt-3 max-w-sm rounded-xl border border-[#1B4332]/10 bg-white px-3 py-2 text-center text-[9px] font-bold sm:text-xs">
                “{answer}”
              </motion.p>
              <div className="mt-2 flex items-center gap-1 text-[8px] font-black uppercase text-[#52735c]"><Bot className="size-3" /> Kannada · हिन्दी · English <LifeBuoy className="ml-1 size-3" /></div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <motion.div
        key={`cursor-${scene}`}
        initial={{ left: "5%", top: "5%", scale: 0.8, opacity: 0 }}
        animate={{ ...cursorSpot, scale: [0.8, 1, 0.92, 1], opacity: [0, 1, 1, 1] }}
        transition={{ duration: 1.05, times: [0, .35, .72, 1], ease: "easeInOut" }}
        className="pointer-events-none absolute z-30"
      >
        <span className="absolute -inset-2 animate-ping rounded-full bg-[#EAB308]/45" />
        <MousePointer2 className="relative size-7 fill-[#FDE68A] text-[#6b4309] drop-shadow-lg sm:size-9" />
      </motion.div>
    </div>
  );
}

export function AnimatedFarmerWalkthrough() {
  const [lang, setLang] = useState<Lang>("kn");
  const [activeStep, setActiveStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [playbackRevision, setPlaybackRevision] = useState(0);
  const playbackGeneration = useRef(0);
  const advanceTimer = useRef<number | null>(null);
  const copy = GUIDE_COPY[lang];
  const step = copy.steps[activeStep]!;

  const clearPlayback = () => {
    playbackGeneration.current += 1;
    setPlaybackRevision((revision) => revision + 1);
    if (advanceTimer.current !== null) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    stopSpeaking();
    return playbackGeneration.current;
  };

  const playScene = (sceneIndex: number, generation: number) => {
    if (generation !== playbackGeneration.current) return;
    const narration = copy.steps[sceneIndex]?.narration;
    if (!narration) return;

    speak(narration, lang, () => {
      if (generation !== playbackGeneration.current) return;
      advanceTimer.current = window.setTimeout(() => {
        advanceTimer.current = null;
        if (generation !== playbackGeneration.current) return;
        if (sceneIndex >= copy.steps.length - 1) {
          setPlaying(false);
          return;
        }
        const nextScene = sceneIndex + 1;
        setActiveStep(nextScene);
        playScene(nextScene, generation);
      }, 1200);
    });
  };

  useEffect(() => {
    if (!playing || voiceOn) return;
    const readTime = Math.max(8_000, Math.min(30_000, step.narration.length * 62));
    const timer = window.setTimeout(() => {
      if (activeStep >= copy.steps.length - 1) setPlaying(false);
      else setActiveStep((current) => current + 1);
    }, readTime + 1200);
    return () => {
      window.clearTimeout(timer);
    };
  }, [activeStep, copy.steps.length, playbackRevision, playing, step.narration, voiceOn]);

  useEffect(() => () => {
    playbackGeneration.current += 1;
    if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
    stopSpeaking();
  }, []);

  const startPlayback = (sceneIndex = activeStep) => {
    const generation = clearPlayback();
    setPlaying(true);
    if (voiceOn) playScene(sceneIndex, generation);
  };

  const selectStep = (nextStep: number) => {
    clearPlayback();
    setPlaying(false);
    setActiveStep(Math.min(copy.steps.length - 1, Math.max(0, nextStep)));
  };

  const restart = () => {
    const generation = clearPlayback();
    setActiveStep(0);
    setPlaying(true);
    if (voiceOn) playScene(0, generation);
  };

  const togglePlayback = () => {
    if (playing) {
      clearPlayback();
      setPlaying(false);
    } else {
      startPlayback();
    }
  };

  const toggleVoice = () => {
    const nextVoiceOn = !voiceOn;
    if (playing) {
      const generation = clearPlayback();
      setVoiceOn(nextVoiceOn);
      if (nextVoiceOn) playScene(activeStep, generation);
    } else {
      setVoiceOn(nextVoiceOn);
    }
  };

  const selectLanguage = (nextLang: Lang) => {
    if (nextLang === lang) return;
    if (playing) {
      clearPlayback();
      setPlaying(false);
    }
    setLang(nextLang);
  };

  return (
    <section id="farmer-walkthrough" className="mx-auto max-w-7xl scroll-mt-6 px-3 py-8 sm:px-5 sm:py-12">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1 sm:mb-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#1B4332]">KrishiMitra AI · Farmer-first video</p>
          <h2 className="font-display mt-1 text-xl uppercase leading-tight text-[#102318] sm:text-3xl">{copy.title}</h2>
          <p className="mt-1 text-xs text-[#496352] sm:text-sm">{copy.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Narration language">
          {LANGUAGES.map((option) => (
            <button
              key={option.lang}
              type="button"
              aria-pressed={lang === option.lang}
              onClick={() => selectLanguage(option.lang)}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-black transition-colors sm:px-4 sm:py-2 sm:text-xs ${
                lang === option.lang
                  ? "border-[#EAB308] bg-[#EAB308] text-[#102318]"
                  : "border-white/20 bg-white/5 text-white hover:bg-white/15"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[#B4D4BD]/30 bg-[#0B2418] text-white shadow-[0_28px_70px_-35px_rgba(3,18,10,.9)] sm:rounded-3xl">
        <motion.div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_68%_5%,rgba(234,179,8,.28),transparent_38%),linear-gradient(180deg,#153f2a_0%,#0B2418_54%,#081910_100%)]"
          animate={{ backgroundPosition: ["0% 0%", "100% 20%", "0% 0%"] }}
          transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
        />
        <motion.div aria-hidden className="absolute -top-1/3 left-[35%] h-[110%] w-[18%] rotate-[24deg] bg-gradient-to-b from-[#FDE68A]/15 via-[#FDE68A]/5 to-transparent blur-xl" animate={{ x: [-80, 120, -80], opacity: [.25, .6, .25] }} transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }} />
        <div aria-hidden className="absolute bottom-[16%] left-0 right-0 flex h-[18%] items-end justify-around overflow-hidden opacity-30">
          {Array.from({ length: 18 }, (_, index) => (
            <motion.div key={index} animate={{ rotate: [-5, 5, -5] }} transition={{ duration: 2 + (index % 5) * .4, repeat: Infinity, ease: "easeInOut" }} style={{ originX: .5, originY: 1 }}>
              {index % 3 === 0 ? <Wheat className="size-5 text-[#EAB308] sm:size-8" /> : <Sprout className="size-5 text-[#9BCD9C] sm:size-8" />}
            </motion.div>
          ))}
        </div>

        <div className="absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-2 sm:inset-x-6 sm:top-5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[.18em] text-[#EAB308] sm:text-[10px]">
              <span className="size-1.5 animate-pulse rounded-full bg-[#86EFAC]" /> Scene {activeStep + 1} / 6
            </div>
            <p className="mt-1 max-w-[45vw] truncate text-[10px] font-bold text-white sm:max-w-none sm:text-sm">{step.title}</p>
          </div>
          <span className="hidden items-center gap-1 rounded-full border border-white/15 bg-black/20 px-2 py-1 text-[8px] font-bold text-white/70 sm:inline-flex">
            <Volume2 className="size-3" /> 16:9 · English / ಕನ್ನಡ / हिन्दी
          </span>
        </div>

        <div className="absolute inset-x-3 bottom-[19%] top-[17%] z-10 grid grid-cols-[.78fr_1.22fr] items-stretch gap-2 sm:inset-x-7 sm:bottom-[21%] sm:top-[16%] sm:grid-cols-[.82fr_1.18fr] sm:gap-5">
          <FarmerCharacter lang={lang} speaking={playing && voiceOn} />
          <AppStage scene={activeStep} lang={lang} />
        </div>

        <div className="absolute inset-x-3 bottom-[14%] z-20 max-h-[18%] overflow-y-auto sm:inset-x-7 sm:bottom-[14%]">
          <AnimatePresence mode="wait">
            <motion.p
              key={`${lang}-${activeStep}`}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="rounded-lg border border-white/10 bg-black/45 px-2.5 py-1.5 text-[8px] font-medium leading-relaxed text-white/95 backdrop-blur-md sm:rounded-xl sm:px-4 sm:py-2 sm:text-xs"
              aria-live="polite"
            >
              {step.narration}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="absolute inset-x-3 bottom-2 z-20 flex items-center gap-2 sm:inset-x-7 sm:bottom-4 sm:gap-3">
          <button type="button" onClick={() => selectStep(activeStep - 1)} disabled={activeStep === 0} aria-label="Previous scene" className="grid size-7 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/15 disabled:opacity-30 sm:size-9">
            <ArrowLeft className="size-3.5 sm:size-4" />
          </button>
          <button type="button" onClick={togglePlayback} aria-label={playing ? copy.pause : copy.play} className="grid size-8 shrink-0 place-items-center rounded-full bg-[#EAB308] text-[#102318] shadow-lg transition-transform hover:scale-105 sm:size-10">
            {playing ? <Pause className="size-4 sm:size-5" /> : <Play className="ml-0.5 size-4 sm:size-5" />}
          </button>
          <button type="button" onClick={() => selectStep(activeStep + 1)} disabled={activeStep === copy.steps.length - 1} aria-label="Next scene" className="grid size-7 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/15 disabled:opacity-30 sm:size-9">
            <ArrowRight className="size-3.5 sm:size-4" />
          </button>
          <button type="button" onClick={restart} aria-label={copy.restart} title={copy.restart} className="grid size-7 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/15 sm:size-9">
            <RotateCcw className="size-3.5 sm:size-4" />
          </button>
          <input
            type="range"
            min="0"
            max={copy.steps.length - 1}
            step="1"
            value={activeStep}
            onChange={(event) => selectStep(Number(event.target.value))}
            aria-label="Video timeline"
            className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[#EAB308]"
          />
          <span className="hidden shrink-0 text-[9px] font-bold text-white/70 sm:inline">{String(activeStep + 1).padStart(2, "0")} / 06</span>
          <button type="button" onClick={toggleVoice} aria-pressed={voiceOn} aria-label={voiceOn ? copy.voiceOn : copy.voiceOff} title={voiceOn ? copy.voiceOn : copy.voiceOff} className={`grid size-7 shrink-0 place-items-center rounded-full border transition-colors sm:size-9 ${voiceOn ? "border-[#EAB308]/70 bg-[#EAB308]/15 text-[#FDE68A]" : "border-white/15 bg-white/5 text-white/70"}`}>
            {voiceOn ? <Volume2 className="size-3.5 sm:size-4" /> : <VolumeX className="size-3.5 sm:size-4" />}
          </button>
        </div>

        <div className="pointer-events-none absolute inset-x-3 bottom-[8.8%] z-10 h-0.5 rounded-full bg-white/15 sm:inset-x-7">
          <motion.div className="h-full rounded-full bg-[#EAB308]" animate={{ width: `${((activeStep + 1) / copy.steps.length) * 100}%` }} transition={{ duration: .35 }} />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 px-1 text-[10px] font-semibold text-[#496352] sm:text-xs">
        <IconBadge icon={SCENE_ICONS[activeStep]!} tone="emerald" size="sm" />
        <span>{step.target}</span>
        <span className="ml-auto">Sample values are illustrative.</span>
      </div>
    </section>
  );
}
