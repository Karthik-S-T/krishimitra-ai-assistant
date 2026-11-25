/**
 * KrishiMitra AI — agricultural assistant API.
 * Mirrors the planned REST surface: POST /api/chat.
 *
 * Two modes:
 *  1. LLM mode — used automatically when an OPENAI_API_KEY (any OpenAI-
 *     compatible provider) is configured in the environment.
 *  2. Knowledge-base mode — always available fallback. Grounded ONLY in the
 *     project's real crop dataset statistics + published fertilizer guidance,
 *     never fabricated data.
 */
import { action } from "./_generated/server";
import { v } from "convex/values";
import { CROP_PROFILES, type FeatureKey } from "./data/cropProfiles";

export type Lang = "en" | "kn" | "hi";

interface ChatContext {
  location?: string | null;
  temperature?: number | null;
  humidity?: number | null;
  topCrop?: string | null;
  topAlt1?: string | null;
  topAlt2?: string | null;
  topConfidence?: number | null;
}

/** Localized names for every crop, used to detect which crop is asked about. */
const CROP_NAMES: Record<string, string[]> = {
  rice: ["rice", "paddy", "ಭತ್ತ", "ಅಕ್ಕಿ", "धान", "चावल"],
  maize: ["maize", "corn", "ಮೆಕ್ಕೆಜೋಳ", "ಜೋಳ", "मक्का"],
  chickpea: ["chickpea", "gram", "ಕಡಲೆ", "चना"],
  kidneybeans: ["kidneybean", "rajma", "ರಾಜಮಾ", "राजमा"],
  pigeonpeas: ["pigeonpea", "tur dal", "ತೊಗರಿ", "अरहर", "तूर"],
  mothbeans: ["mothbean", "moth", "ಮೊಸೂಸು", "मोठ"],
  mungbean: ["mungbean", "green gram", "ಹೆಸರು", "मूंग"],
  blackgram: ["blackgram", "urad", "ಉದ್ದಿನ", "उड़द"],
  lentil: ["lentil", "masoor", "ಮಸೂರ", "मसूर"],
  pomegranate: ["pomegranate", "ದಾಳಿಂಬೆ", "अनार"],
  banana: ["banana", "ಬಾಳೆ", "केला"],
  mango: ["mango", "ಮಾವು", "आम"],
  grapes: ["grape", "ದ್ರಾಕ್ಷಿ", "अंगूर"],
  watermelon: ["watermelon", "ಕಲ್ಲಂಗಡಿ", "तरबूज"],
  muskmelon: ["muskmelon", "ಕರಬೂಜ", "खरबूजा"],
  apple: ["apple", "ಸೇಬು", "सेब"],
  orange: ["orange", "ಕಿತ್ತಳೆ", "संतरा"],
  papaya: ["papaya", "ಪಪ್ಪಾಯಿ", "पपीता"],
  coconut: ["coconut", "ತೆಂಗು", "नारियल"],
  cotton: ["cotton", "ಹತ್ತಿ", "कपास"],
  jute: ["jute", "ಸೆಣಬು", "जूट"],
  coffee: ["coffee", "ಕಾಫಿ", "कॉफ़ी"],
};

/** Published state-recommendation fertilizer schedules (kg/ha unless noted). */
const FERTILIZER_KB: Record<string, string> = {
  rice: "100:50:50 N:P₂O₅:K₂O — apply N in 3 splits (basal, max tillering, panicle initiation)",
  maize: "120:60:40 N:P₂O₅:K₂O — apply N in 2–3 splits",
  chickpea: "20:40:20 N:P₂O₅:K₂O + Rhizobium seed treatment",
  pigeonpeas: "20:50:20 N:P₂O₅:K₂O basal dose, with top dressing later",
  banana: "≈150–200 g N : 50–60 g P₂O₅ : 250–300 g K₂O per plant per year, in monthly splits",
  cotton: "120:60:60 N:P₂O₅:K₂O for irrigated hybrids — N in 3 splits",
  coconut: "≈500 g N : 320 g P₂O₅ : 1200 g K₂O per palm per year, in 2 splits",
};

const KEYWORDS = {
  fert: ["fertilizer", "fertiliser", "manure", "urea", "ಗೊಬ್ಬರ", "उर्वरक", "खाद", "यूरिया"],
  recommend: ["recommend", "suggest", "which crop", "best crop", "ಶಿಫಾರಸು", "ಯಾವ ಬೆಳೆ", "सिफ़ारिश", "सुझाव", "कौन सी फसल"],
  weather: ["weather", "rain", "temperature", "humidity", "ಹವಾಮಾನ", "ಮಳೆ", "ಉಷ್ಣತೆ", "ಆರ್ದ್ರತೆ", "मौसम", "बारिश", "तापमान", "नमी"],
  price: ["price", "market", "mandi", "ಬೆಲೆ", "ಮಾರುಕಟ್ಟೆ", "भाव", "बाज़ार", "मंडी", "दाम"],
  yield: ["yield", "production", "ಇಳುವಿಕೆ", "ಉತ್ಪಾದನೆ", "उपज", "उत्पादन"],
  revenue: ["revenue", "income", "profit", "ಆದಾಯ", "ಲಾಭ", "लाभ", "आय"],
  greeting: ["hello", "hi ", "hey", "namaste", "namaskara", "ನಮಸ್ಕಾರ", "ಹಲೋ", "नमस्ते", "नमस्कार", "हैलो"],
} as const;

const FEAT_WORDS: Record<FeatureKey, string[]> = {
  N: ["nitrogen", " n ", "ಸಾರಜನಕ", "नाइट्रोजन"],
  P: ["phosphorus", "ರಂಜಕ", "फास्फोरस"],
  K: ["potassium", "ಪೊಟ್ಯಾಷ್", "पोटाश"],
  temperature: ["temperature", "ಉಷ್ಣತೆ", "तापमान"],
  humidity: ["humidity", "ಆರ್ದ್ರತೆ", "नमी"],
  ph: ["ph", "ಆಮ್ಲೀಯತೆ", "पीएच"],
  rainfall: ["rainfall", "ಮಳೆ", "वर्षा"],
};

const FEAT_LABELS: Record<Lang, Record<FeatureKey, string>> = {
  en: { N: "nitrogen (N)", P: "phosphorus (P)", K: "potassium (K)", temperature: "temperature (°C)", humidity: "humidity (%)", ph: "soil pH", rainfall: "rainfall (mm)" },
  kn: { N: "ಸಾರಜನಕ (N)", P: "ರಂಜಕ (P)", K: "ಪೊಟ್ಯಾಷ್ (K)", temperature: "ಉಷ್ಣತೆ (°C)", humidity: "ಆರ್ದ್ರತೆ (%)", ph: "ಮಣ್ಣಿನ pH", rainfall: "ಮಳೆ (ಮಿಮೀ)" },
  hi: { N: "नाइट्रोजन (N)", P: "फास्फोरस (P)", K: "पोटाश (K)", temperature: "तापमान (°C)", humidity: "नमी (%)", ph: "मिट्टी का pH", rainfall: "वर्षा (मिमी)" },
};

const T: Record<Lang, Record<string, string>> = {
  en: {
    greet: "Namaste! I am KrishiMitra 🌾 Ask me about crop recommendation, soil values, weather, or farming practices.",
    askSoil: "Please enter your soil values (N, P, K, pH) in the soil form on the dashboard — I will then recommend the best crop for your field.",
    recSummary: "Based on your soil and weather, the best crop for your field is {crop} (confidence {conf}%). Also consider {alt}.",
    weatherSummary: "Current weather near {loc}: {temp}°C, humidity {hum}%. Temperature and humidity from the weather feed are used in your crop recommendation.",
    noWeather: "Tap “Detect My Location” (or pick your district) on the dashboard so I can pull live weather for your farm.",
    fertFor: "Typical fertilizer schedule for {crop}: {guide}. Always confirm with your Soil Health Card and local KVK before purchase. (Open Farm Plan → Fertilizer on the dashboard for a soil-based dose.)",
    fertGeneric: "Fertilizer needs depend on the crop and your soil N-P-K. Enter soil values on the dashboard, or ask me e.g. “fertilizer for rice”. (Open Farm Plan → Fertilizer for a soil-based dose.)",
    pricePhase: "Open Farm Plan → Market on the dashboard for live AGMARKNET mandi prices (needs a free data.gov.in API key).",
    yieldPhase: "Open Farm Plan → Yield on the dashboard for an expected-production estimate from national average yields.",
    revenueNote: "Open Farm Plan → Revenue for production × price estimates — always labelled as an estimate, never guaranteed income.",
    rangeFor: "Typical {feat} for {crop}: {min}–{max} (average ≈ {mean}).",
    defaultReply: "I am an agriculture assistant 🌾 Try asking: “which crop suits my soil?”, “fertilizer for cotton”, or “current weather”.",
  },
  kn: {
    greet: "ನಮಸ್ಕಾರ! ನಾನು ಕೃಷಿಮಿತ್ರ 🌾 ಬೆಳೆ ಶಿಫಾರಸು, ಮಣ್ಣಿನ ಮೌಲ್ಯಗಳು, ಹವಾಮಾನ ಅಥವಾ ಕೃಷಿ ಪದ್ಧತಿಗಳ ಬಗ್ಗೆ ಕೇಳಿ.",
    askSoil: "ದಯವಿಟ್ಟು ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ನಲ್ಲಿ ನಿಮ್ಮ ಮಣ್ಣಿನ ಮೌಲ್ಯಗಳನ್ನು (N, P, K, pH) ನಮೂದಿಸಿ — ನಂತರ ನಿಮ್ಮ ಜಮೀನಿಗೆ ಸೂಕ್ತ ಬೆಳೆಯನ್ನು ಶಿಫಾರಸು ಮಾಡುತ್ತೇನೆ.",
    recSummary: "ನಿಮ್ಮ ಮಣ್ಣು ಮತ್ತು ಹವಾಮಾನದ ಆಧಾರದ ಮೇರೆಗೆ, ನಿಮ್ಮ ಜಮೀನಿಗೆ ಅತ್ಯುತ್ತಮ ಬೆಳೆ {crop} (ವಿಶ್ವಾಸಾರ್ಹತೆ {conf}%). {alt} ಸಹ ಪರಿಗಣಿಸಿ.",
    weatherSummary: "{loc} ಸುತ್ತಮುತ್ತಲಿನ ಪ್ರಸ್ತುತ ಹವಾಮಾನ: {temp}°C, ಆರ್ದ್ರತೆ {hum}%. ಹವಾಮಾನ ಮಾಹಿತಿಯನ್ನು ಬೆಳೆ ಶಿಫಾರಸಿನಲ್ಲಿ ಬಳಸಲಾಗುತ್ತದೆ.",
    noWeather: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ನಲ್ಲಿ “ನನ್ನ ಸ್ಥಳವನ್ನು ಪತ್ತೆ ಮಾಡಿ” ಒತ್ತಿ (ಅಥವಾ ಜಿಲ್ಲೆಯನ್ನು ಆರಿಸಿ) — ನಂತರ ನನಗೆ ನೇರ ಹವಾಮಾನ ಸಿಗುತ್ತದೆ.",
    fertFor: "{crop} ಗೆ ಸಾಮಾನ್ಯ ಗೊಬ್ಬರ ಕ್ರಮ: {guide}. ಖರೀದಿಸುವ ಮೊದಲು ಮಣ್ಣಿನ ಆರೋಗ್ಯ ಕಾರ್ಡ್ ಮತ್ತು ಸ್ಥಳೀಯ ಕೃಷಿ ವಿಜ್ಞಾನ ಕೇಂದ್ರದೊಂದಿಗೆ ದೃಢೀಕರಿಸಿ. (ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ನಲ್ಲಿ ಹೊಲದ ಯೋಜನೆ → ಗೊಬ್ಬರ ಟ್ಯಾಬ್ ತೆರೆಯಿರಿ.)",
    fertGeneric: "ಗೊಬ್ಬರದ ಅಗತ್ಯ ಬೆಳೆ ಮತ್ತು ಮಣ್ಣಿನ N-P-K ಅನ್ನು ಅವಲಂಬಿಸಿರುತ್ತದೆ. ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ನಲ್ಲಿ ಮಣ್ಣಿನ ಮೌಲ್ಯಗಳನ್ನು ನಮೂದಿಸಿ ಅಥವಾ “ಭತ್ತಕ್ಕೆ ಗೊಬ್ಬರ” ಎಂದು ಕೇಳಿ. (ಹೊಲದ ಯೋಜನೆ → ಗೊಬ್ಬರ ಟ್ಯಾಬ್ ತೆರೆಯಿರಿ.)",
    pricePhase: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ನಲ್ಲಿ ಹೊಲದ ಯೋಜನೆ → ಮಾರುಕಟ್ಟೆ ಟ್ಯಾಬ್ ತೆರೆಯಿರಿ — ನೇರ AGMARKNET ಮಂಡಿ ಬೆಲೆಗಳು (ಉಚಿತ data.gov.in API ಕೀ ಬೇಕು).",
    yieldPhase: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ನಲ್ಲಿ ಹೊಲದ ಯೋಜನೆ → ಇಳುವಿಕೆ ಟ್ಯಾಬ್ ತೆರೆಯಿರಿ — ರಾಷ್ಟ್ರೀಯ ಸರಾಸರಿ ಆಧಾರಿತ ಉತ್ಪಾದನಾ ಅಂದಾಜು.",
    revenueNote: "ಹೊಲದ ಯೋಜನೆ → ಆದಾಯ ಟ್ಯಾಬ್ ತೆರೆಯಿರಿ — ಉತ್ಪಾದನೆ × ಬೆಲೆ ಅಂದಾಜು (ಯಾವಾಗಲೂ ಅಂದಾಜು ಮಾತ್ರ — ಖಚಿತ ಆದಾಯವಲ್ಲ).",
    rangeFor: "{crop} ಗೆ ಸಾಮಾನ್ಯ {feat}: {min}–{max} (ಸರಾಸರಿ ≈ {mean}).",
    defaultReply: "ನಾನು ಕೃಷಿ ಸಹಾಯಕ 🌾 ಕೇಳಿ: “ನನ್ನ ಮಣ್ಣಿಗೆ ಯಾವ ಬೆಳೆ?”, “ಹತ್ತಿಗೆ ಗೊಬ್ಬರ”, “ಈಗಿನ ಹವಾಮಾನ”.",
  },
  hi: {
    greet: "नमस्ते! मैं कृषिमित्र हूँ 🌾 फसल सिफ़ारिश, मिट्टी के मान, मौसम या खेती के तरीकों के बारे में पूछें।",
    askSoil: "कृपया डैशबोर्ड पर अपनी मिट्टी के मान (N, P, K, pH) भरें — फिर मैं आपके खेत के लिए सबसे उपयुक्त फसल सुझाऊँगा।",
    recSummary: "आपकी मिट्टी और मौसम के आधार पर आपके खेत के लिए सबसे उपयुक्त फसल {crop} है (विश्वास {conf}%). {alt} भी देखें।",
    weatherSummary: "{loc} के आसपास वर्तमान मौसम: {temp}°C, नमी {hum}%. मौसम की जानकारी फसल सिफ़ारिश में उपयोग होती है।",
    noWeather: "डैशबोर्ड पर “मेरा स्थान पहचानें” दबाएँ (या ज़िला चुनें) — फिर मुझे लाइव मौसम मिल जाएगा।",
    fertFor: "{crop} के लिए सामान्य उर्वरक क्रम: {guide}. खरीदने से पहले मृदा स्वास्थ्य कार्ड और स्थानीय कृषि विज्ञान केंद्र से पुष्टि करें। (डैशबोर्ड पर खेत योजना → उर्वरक टैब खोलें.)",
    fertGeneric: "उर्वरक की मात्रा फसल और मिट्टी के N-P-K पर निर्भर करती है। डैशबोर्ड पर मिट्टी के मान भरें, या पूछें: “धान के लिए उर्वरक”। (खेत योजना → उर्वरक टैब खोलें.)",
    pricePhase: "डैशबोर्ड पर खेत योजना → बाज़ार टैब खोलें — लाइव AGMARKNET मंडी भाव (मुफ़्त data.gov.in API की चाहिए).",
    yieldPhase: "डैशबोर्ड पर खेत योजना → उपज टैब खोलें — राष्ट्रीय औसत आधारित उत्पादन अनुमान.",
    revenueNote: "खेत योजना → आय टैब खोलें — उत्पादन × भाव अनुमान (हमेशा अनुमान, गारंटीड आय नहीं).",
    rangeFor: "{crop} के लिए सामान्य {feat}: {min}–{max} (औसत ≈ {mean}).",
    defaultReply: "मैं कृषि सहायक हूँ 🌾 पूछें: “मेरी मिट्टी के लिए कौन सी फसल?”, “कपास के लिए उर्वरक”, “आज का मौसम”।",
  },
};

const LANG_NAMES: Record<Lang, string> = { en: "English", kn: "Kannada (ಕನ್ನಡ)", hi: "Hindi (हिन्दी)" };

function fmt(tpl: string, params: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? "");
}

function detectCrop(message: string): string | null {
  const m = message.toLowerCase();
  for (const [crop, names] of Object.entries(CROP_NAMES)) {
    if (names.some((n) => m.includes(n))) return crop;
  }
  return null;
}

function detectFeature(message: string): FeatureKey | null {
  const m = ` ${message.toLowerCase()} `;
  for (const [feat, words] of Object.entries(FEAT_WORDS)) {
    if (words.some((w) => m.includes(w))) return feat as FeatureKey;
  }
  return null;
}

function kbAnswer(
  message: string,
  lang: Lang,
  ctx: ChatContext,
): string {
  const t = T[lang];
  const m = message.toLowerCase();
  const crop = detectCrop(message);
  const feat = detectFeature(message);

  if (KEYWORDS.greeting.some((w) => m.startsWith(w.trim()) || m.includes(w.trim()))) {
    return t.greet;
  }

  if (crop && feat && CROP_PROFILES[crop]) {
    const st = CROP_PROFILES[crop]!.stats[feat];
    return fmt(t.rangeFor, {
      crop,
      feat: FEAT_LABELS[lang][feat],
      min: String(st.min),
      max: String(st.max),
      mean: String(st.mean),
    });
  }

  if (KEYWORDS.fert.some((w) => m.includes(w))) {
    if (crop && FERTILIZER_KB[crop]) {
      return fmt(t.fertFor, { crop, guide: FERTILIZER_KB[crop]! });
    }
    return t.fertGeneric;
  }

  if (KEYWORDS.recommend.some((w) => m.includes(w))) {
    if (ctx.topCrop) {
      const alts = [ctx.topAlt1, ctx.topAlt2].filter(Boolean).join(", ");
      return fmt(t.recSummary, {
        crop: ctx.topCrop,
        conf: String(Math.round((ctx.topConfidence ?? 0) * 100)),
        alt: alts || "—",
      });
    }
    return t.askSoil;
  }

  if (KEYWORDS.weather.some((w) => m.includes(w))) {
    if (ctx.temperature != null) {
      return fmt(t.weatherSummary, {
        loc: ctx.location ?? "your area",
        temp: String(Math.round(ctx.temperature)),
        hum: String(Math.round(ctx.humidity ?? 0)),
      });
    }
    return t.noWeather;
  }

  if (KEYWORDS.price.some((w) => m.includes(w))) return t.pricePhase;
  if (KEYWORDS.yield.some((w) => m.includes(w))) return t.yieldPhase;
  if (KEYWORDS.revenue.some((w) => m.includes(w))) return t.revenueNote;

  if (ctx.topCrop && !crop && !feat) {
    // A recommendation exists but the question doesn't match an intent.
    return t.defaultReply;
  }
  return t.defaultReply;
}

async function llmAnswer(
  message: string,
  lang: Lang,
  ctx: ChatContext,
  history: { role: "user" | "assistant"; content: string }[],
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const system =
    "You are KrishiMitra, an agriculture assistant for Indian farmers, part of the KrishiMitra AI project. " +
    "Answer ONLY agriculture-related questions (crops, soil, fertilizer, weather, yield, market, farming practices, selling). " +
    `Always reply in ${LANG_NAMES[lang]}. Be concise, practical and farmer-friendly. ` +
    "Never fabricate soil, weather or market data — rely on the live context below or ask the farmer to enter values. " +
    `Live context: ${JSON.stringify(ctx)}`;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        temperature: 0.4,
        messages: [
          { role: "system", content: system },
          ...history.slice(-6),
          { role: "user", content: message },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    return content?.trim() || null;
  } catch {
    return null;
  }
}

export const askAssistant = action({
  args: {
    message: v.string(),
    lang: v.union(v.literal("en"), v.literal("kn"), v.literal("hi")),
    history: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
        }),
      ),
    ),
    context: v.optional(
      v.object({
        location: v.optional(v.nullable(v.string())),
        temperature: v.optional(v.nullable(v.number())),
        humidity: v.optional(v.nullable(v.number())),
        topCrop: v.optional(v.nullable(v.string())),
        topAlt1: v.optional(v.nullable(v.string())),
        topAlt2: v.optional(v.nullable(v.string())),
        topConfidence: v.optional(v.nullable(v.number())),
      }),
    ),
  },
  handler: async (_ctx, { message, lang, history, context }): Promise<{ reply: string; source: "llm" | "kb" }> => {
    const ctx: ChatContext = context ?? {};
    const llm = await llmAnswer(message, lang, ctx, history ?? []);
    if (llm) return { reply: llm, source: "llm" };
    return { reply: kbAnswer(message, lang, ctx), source: "kb" };
  },
});
