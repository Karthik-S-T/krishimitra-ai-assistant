/**
 * KrishiMitra AI — localized alert text (en/kn/hi) from backend ruleKey+params.
 * Kept on the client so the DB stores language-neutral data.
 */
import type { Lang } from "@/lib/i18n";

export interface AlertParams {
  mm?: number;
  dayOffset?: number;
  light?: number;
  tmax?: number;
  crop?: string;
  commodity?: string;
  pct?: number;
  direction?: string;
  day?: number;
  stage?: string;
  field?: string;
  ph?: number;
  [k: string]: string | number | undefined;
}

type Text = { title: string; body: string; action: string };

const RAIN: Record<Lang, (p: AlertParams) => Text> = {
  en: (p) => ({
    title: p.light ? "Rain expected" : "Heavy rain expected",
    body: `About ${p.mm} mm of rain is expected ${
      p.dayOffset === 1 ? "tomorrow" : "in the coming days"
    }.`,
    action: p.light
      ? "You may postpone irrigation."
      : "Avoid irrigation today and check field drainage.",
  }),
  kn: (p) => ({
    title: p.light ? "ಮಳೆಯ ಸಾಧ್ಯತೆ" : "ಭಾರಿ ಮಳೆಯ ಸಾಧ್ಯಕೆ",
    body: `ಮುಂದಿನ ದಿನಗಳಲ್ಲಿ ಸುಮಾರು ${p.mm} ಮಿ.ಮೀ ಮಳೆಯಾಗಬಹುದು.`,
    action: p.light
      ? "ನೀರಾವರಿಯನ್ನು ಸ್ವಲ್ಪ ತಡವರಿಸಬಹುದು."
      : "ಇಂದು ನೀರಾವರಿ ತಪ್ಪಿಸಿ ಮತ್ತು ಚರಂಡಿ ಪರಿಶೀಲಿಸಿ.",
  }),
  hi: (p) => ({
    title: p.light ? "बारिश की संभावना" : "भारी बारिश की संभावना",
    body: `अगले दिनों में लगभग ${p.mm} मिमी बारिश हो सकती है।`,
    action: p.light ? "सिंचाई टाल सकते हैं।" : "आज सिंचाई न करें; जल निकासी जांचें।",
  }),
};

const HEAT: Record<Lang, (p: AlertParams) => Text> = {
  en: (p) => ({
    title: "Heat stress likely",
    body: `Maximum temperature near ${p.tmax}°C expected tomorrow.`,
    action: "Irrigate if the soil is dry; protect young plants from afternoon sun.",
  }),
  kn: (p) => ({
    title: "ಶಾಖದ ಒತ್ತಡದ ಸಾಧ್ಯತೆ",
    body: `ನಾಳೆ ಗರಿಷ್ಠ ${p.tmax}°C ತಾಪಮಾನದ ಸಾಧ್ಯತೆ.`,
    action: "ಮಣ್ಣು ಒಣಗಿದ್ದರೆ ನೀರು ಕೊಡಿ; ಎಳೆಯ ಸಸಿಗಳಿಗೆ ಮಧ್ಯಾಹ್ನದ ಬಿಸಿಲಿನಿಂದ ರಕ್ಷಣೆ.",
  }),
  hi: (p) => ({
    title: "गर्मी का तनाव संभव",
    body: `कल लगभग ${p.tmax}°C तापमान संभव।`,
    action: "मिट्टी सूखी हो तो सिंचाई करें; छोटे पौधों को दोपहर की धूप से बचाएं।",
  }),
};

const MARKET: Record<Lang, (p: AlertParams) => Text> = {
  en: (p) => ({
    title: p.direction === "up" ? "Market price increased" : "Market price decreased",
    body: `${p.commodity} price changed by ${p.pct}% at your mandi.`,
    action: "Check the market page before selling.",
  }),
  kn: (p) => ({
    title: p.direction === "up" ? "ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ಏರಿಕೆ" : "ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ಇಳಿಕೆ",
    body: `ನಿಮ್ಮ ಮಾರುಕಟ್ಟೆಯಲ್ಲಿ ${p.commodity} ಬೆಲೆ ${p.pct}% ಬದಲಾಗಿದೆ.`,
    action: "ಮಾರಾಟ ಮಾಡುವ ಮೊದಲು ಮಾರುಕಟ್ಟೆ ಪುಟ ನೋಡಿ.",
  }),
  hi: (p) => ({
    title: p.direction === "up" ? "मंडी भाव बढ़े" : "मंडी भाव घटे",
    body: `आपकी मंडी में ${p.commodity} की कीमत ${p.pct}% बदली।`,
    action: "बेचने से पहले मार्केट पेज देखें।",
  }),
};

const STAGE: Record<Lang, (p: AlertParams) => Text> = {
  en: (p) => ({
    title: `Crop stage: ${p.stage}`,
    body: `${p.field} — ${p.crop} is ${p.day} days old.`,
    action: "Review irrigation and nutrient plan for this stage; inspect plants weekly.",
  }),
  kn: (p) => ({
    title: `ಬೆಳೆ ಹಂತ: ${p.stage}`,
    body: `${p.field} — ${p.crop} ${p.day} ದಿನಗಳಷ್ಟು ಬೆಳೆದಿದೆ.`,
    action: "ಈ ಹಂತಕ್ಕೆ ನೀರು/ಪೋಷಕಾಂಶ ಯೋಜನೆ ಪರಿಶೀಲಿಸಿ; ವಾರಕ್ಕೊಮ್ಮೆ ಗಮನಿಸಿ.",
  }),
  hi: (p) => ({
    title: `फसल अवस्था: ${p.stage}`,
    body: `${p.field} — ${p.crop} ${p.day} दिन पुरानी है।`,
    action: "इस अवस्था के लिए सिंचाई/पोषण योजना देखें; साप्ताहिक निरीक्षण करें।",
  }),
};

const DISEASE: Record<Lang, (p: AlertParams) => Text> = {
  en: (p) => ({
    title: "Disease risk increased",
    body: `Recent rain raises leaf-disease risk in ${p.crop} (${p.field}).`,
    action: "Inspect leaves (undersides too) for spots in the next 2–3 days.",
  }),
  kn: (p) => ({
    title: "ರೋಗ ಅಪಾಯ ಹೆಚ್ಚಾಗಿದೆ",
    body: `ಇತ್ತೀಚಿನ ಮಳೆಯಿಂದ ${p.crop} (${p.field}) ಎಲೆ ರೋಗದ ಅಪಾಯ ಹೆಚ್ಚಾಗಿದೆ.`,
    action: "ಮುಂದಿನ 2–3 ದಿನ ಎಲೆಗಳನ್ನು (ಕೆಳಭಾಗವನ್ನೂ) ಚುಕ್ಕೆಗಳಿಗಾಗಿ ಪರಿಶೀಲಿಸಿ.",
  }),
  hi: (p) => ({
    title: "रोग का खतरा बढ़ा",
    body: `ताज़ी बारिश से ${p.crop} (${p.field}) में पत्ती रोग का खतरा बढ़ा।`,
    action: "अगले 2–3 दिन पत्तियों की जांच करें (नीचे की सतह भी)।",
  }),
};

const SOIL_PH: Record<Lang, (p: AlertParams) => Text> = {
  en: (p0) => {
    const ph = p0.ph ?? 0;
    return {
      title: ph < 5.5 ? "Soil is acidic" : "Soil is alkaline",
      body: `Your soil report pH is ${ph}.`,
      action: "Discuss correction (lime/gypsum per test) with your agriculture officer.",
    };
  },
  kn: (p0) => {
    const ph = p0.ph ?? 0;
    return {
      title: ph < 5.5 ? "ಮಣ್ಣು ಆಮ್ಲೀಯ" : "ಮಣ್ಣು ಕ್ಷಾರೀಯ",
      body: `ನಿಮ್ಮ ಮಣ್ಣಿನ ವರದಿಯ pH ${ph}.`,
      action: "ತಿದ್ದುಪಡಿಗಾಗಿ (ಸುಣ್ಣ/ಜಿಪ್ಸಮ್) ಕೃಷಿ ಅಧಿಕಾರಿಗಳನ್ನು ಸಂಪರ್ಕಿಸಿ.",
    };
  },
  hi: (p0) => {
    const ph = p0.ph ?? 0;
    return {
      title: ph < 5.5 ? "मिट्टी अम्लीय है" : "मिट्टी क्षारीय है",
      body: `आपकी मिट्टी रिपोर्ट का pH ${ph} है।`,
      action: "सुधार (चूना/जिप्सम) के लिए कृषि अधिकारी से सलाह लें।",
    };
  },
};

export const RULE_META: Record<
  string,
  {
    emoji: string;
    text: Record<Lang, (p: AlertParams) => Text>;
  }
> = {
  rain: { emoji: "⚠️", text: RAIN },
  heat: { emoji: "🔥", text: HEAT },
  market: { emoji: "💰", text: MARKET },
  stage: { emoji: "🌱", text: STAGE },
  disease: { emoji: "🐛", text: DISEASE },
  soil_ph: { emoji: "🧪", text: SOIL_PH },
};

export const SEVERITY_META: Record<
  string,
  { dot: string; chip: string; label: Record<Lang, string> }
> = {
  urgent: {
    dot: "🔴",
    chip: "bg-[#d64545] text-white",
    label: { en: "URGENT", kn: "ತುರ್ತು", hi: "अत्यावश्यक" },
  },
  important: {
    dot: "🟠",
    chip: "bg-[#e2694e] text-white",
    label: { en: "IMPORTANT", kn: "ಮಹತ್ವದ", hi: "महत्वपूर्ण" },
  },
  warning: {
    dot: "🟡",
    chip: "bg-[#ffc53d] text-[#141414]",
    label: { en: "WARNING", kn: "ಎಚ್ಚರಿಕೆ", hi: "चेतावनी" },
  },
  info: {
    dot: "🟢",
    chip: "bg-[#2fa35c] text-white",
    label: { en: "INFO", kn: "ಮಾಹಿತಿ", hi: "जानकारी" },
  },
};
