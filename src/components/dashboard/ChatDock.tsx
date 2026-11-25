import { useAction } from "convex/react";
import { Bot, Mic, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/context/LanguageContext";
import { cropName } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import {
  useSpeechRecognition,
  speak,
  stopSpeaking,
} from "@/lib/voice";
import type { FarmLocation } from "@/components/dashboard/LocationCard";
import type { WeatherResult } from "@/convex/weather";
import type { CropRecommendationResult } from "@/convex/lib/cropModel";

export interface ChatContextInfo {
  loc: FarmLocation | null;
  weather: WeatherResult | null;
  rec: CropRecommendationResult | null;
  soil: { N: string; P: string; K: string; ph: string };
  season: string;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  source?: "llm" | "kb" | "local";
}

interface Props {
  context: ChatContextInfo;
}

const CHAT_COPY: Record<
  Lang,
  {
    welcome: string;
    listen: string;
    online: string;
    demo: string;
    mic: string;
    questions: [string, string, string, string];
  }
> = {
  kn: {
    welcome: "ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ ಕೃಷಿ ಸಹಾಯಕ. ನಿಮ್ಮ ಮಣ್ಣು, ಹವಾಮಾನ ಮತ್ತು ಬೆಳೆ ಬಗ್ಗೆ ಕೇಳಿ.",
    listen: "ಕೇಳಿ",
    online: "AI ಆನ್‌ಲೈನ್",
    demo: "ಡೆಮೋ ಸಹಾಯಕ",
    mic: "ಮಾತನಾಡಿ",
    questions: [
      "ಚಳಿಗಾಲಕ್ಕೆ ಉತ್ತಮ ಬೆಳೆ ಯಾವುದು?",
      "ನನ್ನ ಮಣ್ಣಿಗೆ ಗೊಬ್ಬರ ಸಲಹೆ?",
      "ಇಂದಿನ ಮಂಡಿ ಬೆಲೆ ಪ್ರವೃತ್ತಿ?",
      "ಸಾವಯವ ಕೀಟ ನಿಯಂತ್ರಣ?",
    ],
  },
  hi: {
    welcome: "नमस्ते! मैं आपका कृषि सहायक हूँ। मिट्टी, मौसम और फसल के बारे में पूछें।",
    listen: "सुनें",
    online: "AI ऑनलाइन",
    demo: "डेमो सहायक",
    mic: "बोलें",
    questions: [
      "सर्दियों के लिए सबसे अच्छी फसल?",
      "मेरी मिट्टी के लिए खाद सलाह?",
      "आज मंडी भाव का रुझान?",
      "जैविक कीट नियंत्रण?",
    ],
  },
  en: {
    welcome: "Hello! I’m your farm assistant. Ask me about your soil, weather, or crops.",
    listen: "Listen",
    online: "AI online",
    demo: "Demo assistant",
    mic: "Speak",
    questions: [
      "Best crop for Winter Season?",
      "Fertilizer advice for my soil?",
      "Today's mandi price trend?",
      "Organic pest control?",
    ],
  },
};

function localAgronomyReply(
  question: string,
  context: ChatContextInfo,
  lang: Lang,
): string {
  const q = question.toLowerCase();
  const includesAny = (terms: string[]) => terms.some((term) => q.includes(term));
  const location = context.loc?.label ?? "your farm";
  const contextSeason = /winter|rabi/i.test(context.season)
    ? "Winter Season"
    : /rain|monsoon|kharif/i.test(context.season)
      ? "Rainy Season"
      : "Summer Season";
  const requestedSeason = includesAny([
    "winter", "ಚಳಿಗಾಲ", "ಚಳಿ", "सर्दी", "सर्दियों",
  ])
    ? "Winter Season"
    : includesAny([
          "rainy", "monsoon", "ಮಳೆಗಾಲ", "ಮಳೆ", "बरसात", "वर्षा",
        ])
      ? "Rainy Season"
      : includesAny(["summer", "ಬೇಸಿಗೆ", "गर्मी", "गर्मियों"])
        ? "Summer Season"
        : contextSeason;
  const localizedSeason =
    lang === "kn"
      ? requestedSeason === "Winter Season"
        ? "ಚಳಿಗಾಲ"
        : requestedSeason === "Rainy Season"
          ? "ಮಳೆಗಾಲ"
          : "ಬೇಸಿಗೆ"
      : lang === "hi"
        ? requestedSeason === "Winter Season"
          ? "सर्दी"
          : requestedSeason === "Rainy Season"
            ? "बरसात"
            : "गर्मी"
        : requestedSeason;
  const weather = context.weather?.current;
  const weatherSummary = weather
    ? lang === "kn"
      ? `${Math.round(weather.temperature)}°C ತಾಪಮಾನ, ${Math.round(weather.humidity)}% ಆರ್ದ್ರತೆ, ${weather.precipitation} ಮಿ.ಮೀ ಮಳೆ`
      : lang === "hi"
        ? `${Math.round(weather.temperature)}°C तापमान, ${Math.round(weather.humidity)}% नमी, ${weather.precipitation} मिमी बारिश`
        : `${Math.round(weather.temperature)}°C, ${Math.round(weather.humidity)}% humidity, ${weather.precipitation} mm rain`
    : lang === "kn"
      ? "ಹವಾಮಾನ ಮಾಹಿತಿ ಇನ್ನೂ ಲಭ್ಯವಿಲ್ಲ"
      : lang === "hi"
        ? "मौसम की जानकारी अभी उपलब्ध नहीं है"
        : "weather data is not available yet";
  const soilSummary = `N ${context.soil.N || "—"}, P ${context.soil.P || "—"}, K ${context.soil.K || "—"}, pH ${context.soil.ph || "—"}`;
  const cropId = context.rec?.top[0]?.crop ?? null;
  const crop = cropId ? cropName(cropId, lang) : null;

  if (
    includesAny([
      "scheme", "subsid", "pm-kisan", "pm kisan", "ಯೋಜನೆ", "ಸಬ್ಸಿಡಿ",
      "योजना", "सब्सिडी", "किसान सम्मान",
    ])
  ) {
    if (lang === "kn") {
      return "PM-KISAN ಮತ್ತು ರಾಜ್ಯದ ಕೃಷಿ ಯೋಜನೆಗಳ ಅರ್ಹತೆ ಭೂ ದಾಖಲೆಗಳು ಹಾಗೂ ಪ್ರಸ್ತುತ ನಿಯಮಗಳ ಮೇಲೆ ಅವಲಂಬಿತವಾಗಿದೆ. ಅಧಿಕೃತ PM-KISAN ಅಥವಾ ರಾಜ್ಯ ಕೃಷಿ ಇಲಾಖೆಯ ಪೋರ್ಟಲ್‌ನಲ್ಲಿ ನಿಮ್ಮ ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ. ಅರ್ಜಿ ಸಲ್ಲಿಸುವ ಮೊದಲು ಬ್ಯಾಂಕ್ ಖಾತೆ ಮತ್ತು ಭೂ ದಾಖಲೆಗಳಲ್ಲಿನ ಹೆಸರು ಒಂದೇ ಇದೆಯೇ ನೋಡಿ.";
    }
    if (lang === "hi") {
      return "PM-KISAN और राज्य की कृषि योजनाओं की पात्रता भूमि रिकॉर्ड और मौजूदा नियमों पर निर्भर करती है। आधिकारिक PM-KISAN या राज्य कृषि विभाग के पोर्टल पर अपनी जानकारी जाँचें। आवेदन से पहले बैंक खाते और भूमि रिकॉर्ड में नाम का मिलान कर लें।";
    }
    return "Eligibility for PM-KISAN and state farm schemes depends on land records and current rules. Check your details on the official PM-KISAN or state agriculture portal. Before applying, make sure your bank and land-record names match.";
  }

  if (
    includesAny([
      "mandi", "price", "trend", "market", "ಮಂಡಿ", "ಬೆಲೆ", "ಮಾರುಕಟ್ಟೆ",
      "मंडी", "भाव", "बाज़ार", "बाजार",
    ])
  ) {
    if (lang === "kn") {
      return "ಡೆಮೋದಲ್ಲಿ ಲೈವ್ ಮಂಡಿ ಬೆಲೆ ಲಭ್ಯವಿಲ್ಲ. ಇತ್ತೀಚಿನ ಬೆಲೆಗೆ AGMARKNET ಪರಿಶೀಲಿಸಿ ಅಥವಾ ಕ್ಲೌಡ್ ಸಂಪರ್ಕಿಸಿದ ನಂತರ ಮಾರುಕಟ್ಟೆ ವಿಭಾಗ ತೆರೆಯಿರಿ.";
    }
    if (lang === "hi") {
      return "डेमो में लाइव मंडी भाव उपलब्ध नहीं हैं। ताज़ा भाव के लिए AGMARKNET देखें या क्लाउड कनेक्शन के बाद बाज़ार अनुभाग खोलें।";
    }
    return "Live mandi prices are unavailable in this demo. Check the latest AGMARKNET data, or open the Market section when cloud service is connected.";
  }

  if (includesAny(["dose", "dosage", "how much", "fertilizer kg", "urea", "dap", "mop", "ಎಷ್ಟು", "ಪ್ರಮಾಣ", "ಯೂರಿಯಾ", "कितना", "किलो", "डीएपी", "यूरिया", "मात्रा"])) {
    if (lang === "kn") {
      return `${crop ? `${crop}ಗೆ ` : ""}ಎಲ್ಲಾ ಬೆಳೆಗಳಿಗೆ ಒಂದೇ ಗೊಬ್ಬರ ಪ್ರಮಾಣ ಇರುವುದಿಲ್ಲ. ಮಣ್ಣು ಪರೀಕ್ಷೆ ಮತ್ತು ಕೃಷಿ ಇಲಾಖೆಯ ಬೆಳೆ ಶಿಫಾರಸಿನಿಂದ ಬೇಕಾದ N, P₂O₅ ಮತ್ತು K₂O ಪ್ರಮಾಣವನ್ನು ಮೊದಲು ತಿಳಿದುಕೊಳ್ಳಿ; ಅಂದಾಜು ಪ್ರಮಾಣವನ್ನೇ ಮಣ್ಣಿನ N-P-K ಸಂಖ್ಯೆಗಳೆಂದು ಭಾವಿಸಿ ಬಳಸಬೇಡಿ. ಅಗತ್ಯ ಪೋಷಕಾಂಶವನ್ನು ಲೆಕ್ಕಿಸಲು ಯೂರಿಯಾ = N ಅಗತ್ಯ ÷ 0.46, DAP = P₂O₅ ಅಗತ್ಯ ÷ 0.46, MOP = K₂O ಅಗತ್ಯ ÷ 0.60; ಯೂರಿಯಾವನ್ನು ಹಂತವಾಗಿ ನೀಡಿ ಮತ್ತು ಸ್ಥಳೀಯ ಕೃಷಿ ಅಧಿಕಾರಿಯಿಂದ ಪ್ರಮಾಣ ದೃಢಪಡಿಸಿ.`;
    }
    if (lang === "hi") {
      return `${crop ? `${crop} के लिए ` : ""}हर फसल की खाद मात्रा अलग होती है। पहले मिट्टी जाँच और कृषि विभाग की फसल-सिफारिश से आवश्यक N, P₂O₅ और K₂O जानें; मिट्टी के N-P-K मानों को सीधे खाद की मात्रा न मानें। पोषक तत्व की जरूरत निकालने के लिए यूरिया = N जरूरत ÷ 0.46, DAP = P₂O₅ जरूरत ÷ 0.46 और MOP = K₂O जरूरत ÷ 0.60; यूरिया को चरणों में दें और स्थानीय कृषि अधिकारी से मात्रा की पुष्टि करें।`;
    }
    return `Fertilizer rates differ by crop and growth stage${crop ? `, including ${crop}` : ""}. First get the crop-specific N, P₂O₅, and K₂O recommendation from a soil test or local agriculture officer; do not treat the soil N-P-K readings as fertilizer doses. For a known nutrient requirement, urea kg = N requirement ÷ 0.46, DAP kg = P₂O₅ requirement ÷ 0.46, and MOP kg = K₂O requirement ÷ 0.60; split urea applications and confirm the rate locally.`;
  }

  if (includesAny([
    "leaf spot", "early blight", "blight", "mildew", "fungal", "yellow leaf", "yellowing", "disease", "ಬಿಳಿ ಚುಕ್ಕೆ",
    "ಎಲೆ ಚುಕ್ಕೆ", "ಎಲೆ ರೋಗ", "ಹಳದಿ ಎಲೆ", "रोग", "पत्ती", "धब्बे", "पीली पत्ती",
  ])) {
    if (lang === "kn") {
      return "ಎಲೆಗಳ ಮೇಲೆ ಚುಕ್ಕೆ ಅಥವಾ ಹಳದಿ ಬಣ್ಣ ಕಂಡರೆ ಎರಡೂ ಬದಿಗಳನ್ನು ಪರಿಶೀಲಿಸಿ ಮತ್ತು ಬಾಧಿತ ಎಲೆಗಳನ್ನು ಪ್ರತ್ಯೇಕಿಸಿ. ಇದು ಖಚಿತ ರೋಗನಿರ್ಣಯವಲ್ಲ; ಹಲವು ರೋಗಗಳು ಒಂದೇ ರೀತಿಯಾಗಿ ಕಾಣುತ್ತವೆ, ಆದ್ದರಿಂದ ಹತ್ತಿರದ KVK ಅಥವಾ ಕೃಷಿ ಅಧಿಕಾರಿಗೆ ಮಾದರಿ ತೋರಿಸಿ. ಎಲೆ ಚುಕ್ಕೆ ರೋಗದ ಸಾಧ್ಯತೆಯಲ್ಲಿ ಬಿದ್ದ ಎಲೆಗಳನ್ನು ತೆರವುಗೊಳಿಸಿ, ಎಲೆಗಳನ್ನು ದೀರ್ಘಕಾಲ ಒದ್ದೆಯಾಗಿಡಬೇಡಿ ಮತ್ತು ಬೇವು ಉತ್ಪನ್ನವನ್ನು ಕೀಟಗಳಿಗಾಗಿ ಮಾತ್ರ ಲೇಬಲ್ ಸೂಚನೆಯಂತೆ ಬಳಸಿ.";
    }
    if (lang === "hi") {
      return "पत्तों पर धब्बे या पीलापन दिखे तो दोनों सतहें जाँचें और बहुत प्रभावित पत्तियाँ अलग करें। यह पक्का रोग-निदान नहीं है; कई समस्याएँ एक जैसी दिखती हैं, इसलिए नमूना नज़दीकी KVK या कृषि अधिकारी को दिखाएँ। लीफ-स्पॉट की आशंका में गिरे पत्ते हटाएँ, पत्तियों को लंबे समय तक गीला न रहने दें और नीम उत्पाद केवल कीट नियंत्रण के लिए लेबल के अनुसार उपयोग करें।";
    }
    return "If leaves show spots or yellowing, inspect both sides and separate badly affected leaves. This is not a confirmed diagnosis—several problems look alike, so show a sample to your nearby KVK or agriculture officer. For possible leaf spot, remove fallen leaves, avoid prolonged leaf wetness, and use neem products only for pests and as directed on the label.";
  }

  if (includesAny(["fertil", "soil", "ಗೊಬ್ಬರ", "ಮಣ್ಣು", "खाद", "मिट्टी"])) {
    if (lang === "kn") {
      return `${location} (${localizedSeason}) ಮಣ್ಣಿನ ನಮೂದು: ${soilSummary}. ಇದು ನಿಜವಾದ ಮಣ್ಣು ಪರೀಕ್ಷೆಗೆ ಬದಲಿಯಲ್ಲ. ಬೆಳೆ ಮತ್ತು ಮಣ್ಣು ಪರೀಕ್ಷೆಯ ಆಧಾರದ ಮೇಲೆ ಮಾತ್ರ ಗೊಬ್ಬರ ಪ್ರಮಾಣ ನಿರ್ಧರಿಸಿ; ಸ್ಥಳೀಯ ಕೃಷಿ ಅಧಿಕಾರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ.`;
    }
    if (lang === "hi") {
      return `${location} (${localizedSeason}) के मिट्टी मान: ${soilSummary}। ये वास्तविक मिट्टी जाँच का विकल्प नहीं हैं। खाद की मात्रा फसल और मिट्टी परीक्षण के अनुसार तय करें; स्थानीय कृषि अधिकारी से सलाह लें।`;
    }
    return `For ${location} (${requestedSeason}), the available soil values are ${soilSummary}. These are not a substitute for a current soil test. Choose fertilizer rates for the specific crop using tested values, and confirm with a local agriculture officer.`;
  }

  if (includesAny(["pest", "organic", "ಕೀಟ", "ಸಾವಯವ", "कीट", "जैविक"])) {
    if (lang === "kn") {
      return "ಸಾವಯವ ಕೀಟ ನಿರ್ವಹಣೆಗೆ ಮೊದಲು ಎಲೆಗಳ ಎರಡೂ ಬದಿಗಳನ್ನು ಪರಿಶೀಲಿಸಿ, ಸೋಂಕಿತ ಭಾಗಗಳನ್ನು ತೆಗೆದುಹಾಕಿ, ಹೊಲವನ್ನು ಸ್ವಚ್ಛವಾಗಿಡಿ. ಬೇವು ಆಧಾರಿತ ಉತ್ಪನ್ನವನ್ನು ಲೇಬಲ್ ಸೂಚನೆಯಂತೆ ಬಳಸಿ; ಹೂ ಬಿಡುವ ಸಮಯದಲ್ಲಿ ಪರಾಗಸ್ಪರ್ಶಕಗಳನ್ನು ಕಾಪಾಡಿ.";
    }
    if (lang === "hi") {
      return "जैविक कीट प्रबंधन के लिए पहले पत्तियों की दोनों सतहें जाँचें, प्रभावित हिस्से हटाएँ और खेत साफ रखें। नीम-आधारित उत्पाद केवल लेबल के अनुसार उपयोग करें; फूल आने पर परागण करने वाले कीटों की रक्षा करें।";
    }
    return "For organic pest management, inspect both sides of leaves, remove affected material, and keep the field clean. Use neem-based products only as directed on the label, and protect pollinators during flowering.";
  }

  const suggestions = {
    en:
      requestedSeason === "Winter Season"
        ? "chickpea, wheat where suitable, or seasonal vegetables"
        : requestedSeason === "Rainy Season"
          ? "maize, millets, or paddy where drainage and water access suit"
          : "millets, groundnut, or vegetables where irrigation is reliable",
    kn:
      requestedSeason === "Winter Season"
        ? "ಕಡಲೆ, ಸೂಕ್ತ ಪ್ರದೇಶದಲ್ಲಿ ಗೋಧಿ ಅಥವಾ ಹಂಗಾಮಿ ತರಕಾರಿಗಳು"
        : requestedSeason === "Rainy Season"
          ? "ಮೆಕ್ಕೆಜೋಳ, ಸಿರಿಧಾನ್ಯಗಳು ಅಥವಾ ನೀರು ನಿಲ್ಲದ ಹೊಲದಲ್ಲಿ ಭತ್ತ"
          : "ಸಿರಿಧಾನ್ಯಗಳು, ನೆಲಗಡಲೆ ಅಥವಾ ನೀರಾವರಿ ಇರುವಲ್ಲಿ ತರಕಾರಿಗಳು",
    hi:
      requestedSeason === "Winter Season"
        ? "चना, उपयुक्त क्षेत्रों में गेहूँ या मौसमी सब्ज़ियाँ"
        : requestedSeason === "Rainy Season"
          ? "मक्का, मोटे अनाज या उचित जल-निकास वाले खेत में धान"
          : "मोटे अनाज, मूँगफली या भरोसेमंद सिंचाई में सब्ज़ियाँ",
  }[lang];
  if (lang === "kn") {
    return `${location} ನಲ್ಲಿ ${localizedSeason}ಗೆ ${suggestions} ಪರಿಗಣಿಸಿ. ಹವಾಮಾನ: ${weatherSummary}. ಮಣ್ಣಿನ ಮೌಲ್ಯಗಳು: ${soilSummary}.${crop ? ` ಈಗಿನ ಮಾದರಿ ಸಲಹೆ: ${crop}.` : ""} ಬಿತ್ತುವ ಮೊದಲು ನೀರಿನ ಲಭ್ಯತೆ ಮತ್ತು ಸ್ಥಳೀಯ ಕೃಷಿ ಸಲಹೆ ಪರಿಶೀಲಿಸಿ.`;
  }
  if (lang === "hi") {
    return `${location} में ${localizedSeason} के लिए ${suggestions} पर विचार करें। मौसम: ${weatherSummary}। मिट्टी के मान: ${soilSummary}.${crop ? ` मौजूदा मॉडल सुझाव: ${crop}।` : ""} बुवाई से पहले पानी की उपलब्धता और स्थानीय कृषि सलाह जाँचें।`;
  }
  return `For ${location} during ${requestedSeason}, consider ${suggestions}. Current weather: ${weatherSummary}. Soil values: ${soilSummary}.${crop ? ` The current model suggestion is ${crop}.` : ""} Check water availability and local agricultural advice before planting.`;
}

export function ChatDock({ context }: Props) {
  const { t, lang } = useLang();
  const askAssistant = useAction(api.assistant.askAssistant);
  const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim() ?? "";
  const hasConvexUrl = Boolean(convexUrl) && !/localhost|127\.0\.0\.1/i.test(convexUrl);
  const copy = CHAT_COPY[lang];
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset the conversation when the language changes.
  useEffect(() => {
    setMsgs([{ role: "assistant", content: copy.welcome }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs, open, busy]);

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || busy) return;
    setInput("");
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setBusy(true);
    try {
      const ctx = {
        location: context.loc?.label ?? null,
        temperature: context.weather?.current.temperature ?? null,
        humidity: context.weather?.current.humidity ?? null,
        topCrop: context.rec
          ? cropName(context.rec.top[0]?.crop ?? "", lang)
          : null,
        topAlt1: context.rec
          ? cropName(context.rec.top[1]?.crop ?? "", lang)
          : null,
        topAlt2: context.rec
          ? cropName(context.rec.top[2]?.crop ?? "", lang)
          : null,
        topConfidence: context.rec?.top[0]?.probability ?? null,
      };
      const history = msgs
        .filter((m) => m.content !== copy.welcome)
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));
      if (!hasConvexUrl) {
        const reply = localAgronomyReply(text, context, lang);
        setMsgs([...next, { role: "assistant", content: reply, source: "local" }]);
        if (speakReplies) speak(reply, lang);
        return;
      }
      let timeoutId = 0;
      const request = askAssistant({
        message: text,
        lang: lang as Lang,
        history,
        context: ctx,
      });
      const res = await Promise.race([
        request,
        new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(
            () => reject(new Error("Farm assistant request timed out.")),
            2500,
          );
        }),
      ]).finally(() => window.clearTimeout(timeoutId));
      setMsgs([
        ...next,
        { role: "assistant", content: res.reply, source: res.source },
      ]);
      if (speakReplies) speak(res.reply, lang);
    } catch {
      const reply = localAgronomyReply(text, context, lang);
      setMsgs([...next, { role: "assistant", content: reply, source: "local" }]);
      if (speakReplies) speak(reply, lang);
    } finally {
      setBusy(false);
    }
  };

  // Phase 9: speech input — pushes recognised text straight into the chat.
  const speech = useSpeechRecognition(
    (text) => {
      setInput(text);
      void send(text);
    },
    lang,
  );

  const toggleMic = () => {
    if (speech.listening) {
      speech.stop();
    } else if (speech.supported) {
      speech.start();
    }
  };

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("chatOpen")}
          className="nb-press fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#ffc53d] text-2xl"
        >
          💬
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-40 flex w-[calc(100vw-2.5rem)] max-w-sm flex-col">
          <div className="nb-shadow-lg flex flex-col overflow-hidden border-2 border-[#141414] bg-white">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#0F2E1D] bg-gradient-to-r from-[#0F2E1D] to-[#1B4332] px-4 py-3 text-white">
              <div>
                <p className="flex items-center gap-2 font-display text-sm uppercase">
                  <Bot className="size-4" /> {t("chatTitle")}
                </p>
                <p className="text-[10px] font-semibold text-white/80">
                  {t("chatScope")}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2 py-1 text-[9px] font-bold uppercase text-white">
                  <span className="size-1.5 rounded-full bg-[#86EFAC]" />
                  {hasConvexUrl ? copy.online : copy.demo}
                </span>
                {/* Voice replies on/off */}
                <button
                  type="button"
                  onClick={() => {
                    if (speakReplies) stopSpeaking();
                    setSpeakReplies((s) => !s);
                  }}
                  aria-label={speakReplies ? t("speakOff") : t("speakOn")}
                  title={speakReplies ? t("speakOn") : t("speakOff")}
                  className={`nb-press px-2 py-0.5 text-xs font-bold ${
                    speakReplies
                      ? "bg-[#ffc53d] text-[#141414]"
                      : "bg-white text-[#141414]"
                  }`}
                >
                  🔊
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="nb-press bg-white px-2 py-0.5 text-xs font-bold text-[#141414]"
                  aria-label="Close chat"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 border-b border-[#1B4332]/15 bg-[#E9F2EC] p-2">
              {copy.questions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => void send(question)}
                  disabled={busy}
                  className="rounded-lg border border-[#1B4332]/20 bg-[#F6FBF8] px-2 py-1.5 text-left text-[10px] font-semibold leading-snug text-[#1B4332] transition-colors hover:bg-[#DDEBE1] disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div
              ref={listRef}
              className="max-h-[40vh] min-h-[180px] space-y-3 overflow-y-auto bg-[#E9F2EC] px-3 py-3"
            >
              {msgs.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`nb-border max-w-[85%] px-3 py-2 text-xs font-semibold leading-relaxed ${
                      m.role === "user"
                        ? "bg-[#DBEAFE] text-[#102318]"
                        : "bg-[#F6FBF8] text-[#102318]"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.role === "assistant" && m.source === "llm" && (
                      <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-[#496352]">
                        AI · LLM
                      </p>
                    )}
                    {m.role === "assistant" && m.source === "local" && (
                      <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-[#496352]">
                        {copy.demo}
                      </p>
                    )}
                    {m.role === "assistant" && (
                      <button
                        type="button"
                        onClick={() => speak(m.content, lang)}
                        className="mt-2 inline-flex items-center gap-1 rounded-md border border-[#1B4332]/20 bg-[#E9F2EC] px-2 py-1 text-[10px] font-bold text-[#1B4332] hover:bg-[#DDEBE1]"
                      >
                        <Volume2 className="size-3" /> 🔊 {copy.listen}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="nb-border animate-pulse bg-white px-3 py-2 text-xs font-bold">
                    {t("loading")}
                  </div>
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-[#1B4332]/15 bg-[#F6FBF8] px-3 py-3">
              {speech.listening && (
                <p className="nb-border mb-2 bg-[#ffc53d] px-2 py-1.5 text-[10px] font-bold">
                  🎤 {t("micListen")}
                </p>
              )}
              {speech.error === "not-allowed" || speech.error === "service-not-allowed" ? (
                <p className="nb-border mb-2 bg-[#ede7d8] px-2 py-1.5 text-[10px] font-bold">
                  🚫 {t("micDenied")}
                </p>
              ) : null}
              {!speech.supported && (
                <p className="nb-border mb-2 bg-[#ede7d8] px-2 py-1.5 text-[10px] font-bold">
                  🎤 {t("micUnsupported")}
                </p>
              )}
              <div className="flex gap-2">
                <input
                  className="nb-input flex-1"
                  value={input}
                  placeholder={t("chatPlaceholder")}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void send();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={toggleMic}
                  aria-label={t("micListen")}
                  title={copy.mic}
                  aria-pressed={speech.listening}
                  className={`nb-press inline-flex items-center gap-1 px-3 text-xs font-bold ${speech.listening ? "bg-[#FEF3C7]" : "bg-[#E9F2EC]"}`}
                >
                  <Mic className="size-4" />
                  <span className="hidden sm:inline">{copy.mic}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={busy || !input.trim()}
                  className="nb-press bg-[#1B4332] px-4 text-xs font-bold uppercase text-white"
                >
                  {t("chatSend")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
