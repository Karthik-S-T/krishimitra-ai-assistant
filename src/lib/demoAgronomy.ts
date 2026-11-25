import type { CropPhotoAnalysis } from "@/convex/cropPhoto";
import type { Lang } from "@/lib/i18n";

const LOCAL_DIAGNOSIS: Record<Lang, {
  observation: string;
  treatment: string;
  prevention: string;
  summary: string;
}> = {
  en: {
    observation: "Possible leaf-spot symptoms; this offline demo cannot confirm a disease from the photo.",
    treatment: "Remove badly affected leaves and ask a local KVK or agriculture officer before spraying. Neem-based products may help with some pests, but follow the product label.",
    prevention: "Keep foliage dry where practical, avoid overcrowding, and monitor new leaves for spreading spots.",
    summary: "This is an illustrative, rule-based check—not a confirmed diagnosis. Compare the symptoms with a nearby agriculture expert before treatment.",
  },
  kn: {
    observation: "ಎಲೆ ಚುಕ್ಕೆಗಳಂತಿರುವ ಲಕ್ಷಣಗಳಿರಬಹುದು; ಈ ಆಫ್‌ಲೈನ್ ಡೆಮೊ ಚಿತ್ರದಿಂದ ರೋಗವನ್ನು ಖಚಿತಪಡಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ.",
    treatment: "ತೀವ್ರವಾಗಿ ಬಾಧಿತ ಎಲೆಗಳನ್ನು ತೆಗೆದುಹಾಕಿ. ಸಿಂಪಡಿಸುವ ಮೊದಲು ಸ್ಥಳೀಯ KVK ಅಥವಾ ಕೃಷಿ ಅಧಿಕಾರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ; ಉತ್ಪನ್ನದ ಲೇಬಲ್ ಸೂಚನೆಗಳನ್ನು ಪಾಲಿಸಿ.",
    prevention: "ಸಾಧ್ಯವಾದಷ್ಟು ಎಲೆಗಳನ್ನು ಒಣವಾಗಿಡಿ, ಗಿಡಗಳ ನಡುವೆ ಗಾಳಿಯಾಟ ಇರಲಿ ಮತ್ತು ಹೊಸ ಎಲೆಗಳಲ್ಲಿ ಚುಕ್ಕೆಗಳು ಹೆಚ್ಚುತ್ತಿವೆಯೇ ಗಮನಿಸಿ.",
    summary: "ಇದು ಉದಾಹರಣೆಯ ಸ್ಥಳೀಯ ಪರಿಶೀಲನೆ ಮಾತ್ರ; ಖಚಿತ ರೋಗನಿರ್ಣಯವಲ್ಲ. ಚಿಕಿತ್ಸೆಗೂ ಮೊದಲು ಕೃಷಿ ತಜ್ಞರೊಂದಿಗೆ ಲಕ್ಷಣಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.",
  },
  hi: {
    observation: "पत्तों पर धब्बे जैसे लक्षण हो सकते हैं; यह ऑफ़लाइन डेमो फोटो से रोग की पुष्टि नहीं कर सकता।",
    treatment: "बहुत प्रभावित पत्तियाँ हटाएँ और छिड़काव से पहले स्थानीय KVK या कृषि अधिकारी से सलाह लें। किसी भी उत्पाद के लेबल के निर्देश मानें।",
    prevention: "जहाँ संभव हो पत्तियों को सूखा रखें, पौधों में हवा का आवागमन रखें और नई पत्तियों पर धब्बों के फैलाव को देखें।",
    summary: "यह केवल उदाहरण के लिए स्थानीय जाँच है, पक्का निदान नहीं। उपचार से पहले कृषि विशेषज्ञ से लक्षणों की पुष्टि करें।",
  },
};

export function createOfflineLeafDiagnosis(
  crop: string,
  lang: Lang,
): CropPhotoAnalysis {
  const copy = LOCAL_DIAGNOSIS[lang] ?? LOCAL_DIAGNOSIS.en;
  return {
    crop,
    growthStage: "Vegetative",
    healthStatus: "moderate_stress",
    healthScore: null,
    observations: [copy.observation],
    fertilizerAdvice: copy.treatment,
    irrigationAdvice: copy.prevention,
    yieldBand: null,
    confidence: null,
    fullText: copy.summary,
    engine: "offline",
  };
}

export function localAgronomyReply(
  question: string,
  lang: Lang,
  context?: { crop?: string; season?: string; temperature?: number; humidity?: number; soil?: string },
): string {
  const crop = context?.crop || (lang === "kn" ? "ಬೆಳೆ" : lang === "hi" ? "फसल" : "your crop");
  const season = context?.season || (lang === "kn" ? "ಪ್ರಸ್ತುತ ಋತು" : lang === "hi" ? "वर्तमान मौसम" : "the current season");
  const weather = context?.temperature == null
    ? ""
    : lang === "kn"
      ? ` ತಾಪಮಾನ ಸುಮಾರು ${Math.round(context.temperature)}°C ಆಗಿದೆ.`
      : lang === "hi"
        ? ` तापमान लगभग ${Math.round(context.temperature)}°C है।`
        : ` Current temperature is about ${Math.round(context.temperature)}°C.`;
  const soil = context?.soil
    ? lang === "kn"
      ? ` ಮಣ್ಣಿನ ಮಾಹಿತಿ: ${context.soil}.`
      : lang === "hi"
        ? ` मिट्टी की जानकारी: ${context.soil}।`
        : ` Soil details: ${context.soil}.`
    : "";
  const lower = question.toLowerCase();

  if (lang === "kn") {
    if (/ರಸಗೊಬ್ಬರ|fertili|npk|ಗೊಬ್ಬರ/i.test(question)) {
      return `${crop}ಗೆ ರಸಗೊಬ್ಬರ ಪ್ರಮಾಣವನ್ನು ಮಣ್ಣಿನ ಪರೀಕ್ಷೆಯ N-P-K ಫಲಿತಾಂಶದಿಂದ ನಿರ್ಧರಿಸಿ.${soil} ಒಂದೇ ಬಾರಿ ಹೆಚ್ಚು ಹಾಕುವ ಬದಲು ಶಿಫಾರಸು ಮಾಡಿದ ಪ್ರಮಾಣವನ್ನು ಹಂತವಾಗಿ ನೀಡಿ.`;
    }
    if (/ಬೆಲೆ|ಮಾರುಕಟ್ಟೆ|ಮಂಡಿ|price|mandi/i.test(question)) {
      return `ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳು ದಿನದಿಂದ ದಿನಕ್ಕೆ ಬದಲಾಗುತ್ತವೆ. ಮಾರಾಟಕ್ಕೂ ಮೊದಲು ಹತ್ತಿರದ APMC ಅಥವಾ e-NAM ನಲ್ಲಿ ಇಂದಿನ ದರವನ್ನು ಪರಿಶೀಲಿಸಿ; ಈ ಡೆಮೊ ಲೈವ್ ಬೆಲೆ ನೀಡುವುದಿಲ್ಲ.`;
    }
    if (/ಕೀಟ|ರೋಗ|pest|disease|neem/i.test(question)) {
      return `ಮೊದಲು ಎಲೆಗಳ ಎರಡೂ ಬದಿಗಳನ್ನು ಪರಿಶೀಲಿಸಿ ಮತ್ತು ಬಾಧಿತ ಭಾಗಗಳನ್ನು ತೆಗೆದುಹಾಕಿ. ಬೇವು ಉತ್ಪನ್ನ ಬಳಸುವ ಮೊದಲು ಸ್ಥಳೀಯ KVK ಸಲಹೆ ಹಾಗೂ ಲೇಬಲ್ ಸೂಚನೆಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.`;
    }
    return `${season} ಸಮಯದಲ್ಲಿ ${crop} ಗದ್ದೆಯಲ್ಲಿ ಮಣ್ಣಿನ ತೇವಾಂಶ ಮತ್ತು ಹೊಸ ಬೆಳವಣಿಗೆಯನ್ನು ವಾರಕ್ಕೊಮ್ಮೆ ಗಮನಿಸಿ.${weather}${soil} ಇದು ಸಾಮಾನ್ಯ ಮಾಹಿತಿ; ಸ್ಥಳೀಯ ಕೃಷಿ ಅಧಿಕಾರಿಯ ಸಲಹೆ ಮೇಲು.`;
  }

  if (lang === "hi") {
    if (/fertili|उर्वरक|खाद|npk/i.test(lower)) {
      return `${crop} के लिए खाद की मात्रा मिट्टी की जाँच के N-P-K परिणामों से तय करें।${soil} पूरी मात्रा एक साथ देने के बजाय अनुशंसित मात्रा को चरणों में दें।`;
    }
    if (/price|mandi|बाज़ार|बाजार|मंडी|भाव/i.test(lower)) {
      return `मंडी भाव रोज़ बदलते हैं। बिक्री से पहले नज़दीकी APMC या e-NAM पर आज का भाव देखें; यह डेमो लाइव भाव नहीं दिखाता।`;
    }
    if (/pest|disease|कीट|रोग|नीम/i.test(lower)) {
      return `पहले पत्तों के दोनों तरफ़ जाँच करें और बहुत प्रभावित हिस्से हटाएँ। नीम उत्पाद इस्तेमाल करने से पहले स्थानीय KVK की सलाह और लेबल निर्देश देखें।`;
    }
    return `${season} में ${crop} के खेत की नमी और नई बढ़त हर सप्ताह देखें।${weather}${soil} यह सामान्य जानकारी है; स्थानीय कृषि अधिकारी की सलाह लें।`;
  }

  if (/fertili|npk|soil|खाद|ಉರ/i.test(lower)) {
    return `For ${crop}, base fertilizer rates on a current soil-test N-P-K result.${soil} Split recommended doses rather than applying extra fertilizer at once.`;
  }
  if (/price|mandi|market|भाव|ಬೆಲೆ/i.test(lower)) {
    return "Mandi prices change daily. Check today's rate with the nearest APMC or e-NAM before selling; this demo does not provide live prices.";
  }
  if (/pest|disease|neem|कीट|ರೋಗ/i.test(lower)) {
    return "Inspect both sides of leaves and remove badly affected material. Ask a local KVK before treatment and follow the label; neem products are not a cure for every disease.";
  }
  return `During ${season}, monitor moisture and new growth in your ${crop} field each week.${weather}${soil} This is general guidance; confirm decisions with your local agriculture officer.`;
}

export function withTimeout<T>(value: PromiseLike<T>, timeoutMs = 8_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`Request timed out after ${timeoutMs} ms.`)),
      timeoutMs,
    );
    Promise.resolve(value).then(
      (result) => {
        window.clearTimeout(timer);
        resolve(result);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}
