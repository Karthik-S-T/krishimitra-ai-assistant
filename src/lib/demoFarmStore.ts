const STORAGE_KEY = "krishimitra_demo_farm_data";
export const DEMO_FARM_EVENT = "krishimitra:demo-farm";

export interface DemoField {
  _id: string;
  fieldName: string;
  area?: number;
  crop?: string;
  variety?: string;
  village?: string;
  taluk?: string;
  district?: string;
  state?: string;
  sowingDate?: string;
  irrigationType?: string;
}

export interface DemoAnalysis {
  _id: string;
  fieldId: string;
  analyzedAt: number;
  images: string[];
  crop: string;
  variety?: string;
  growthStage?: string;
  healthStatus: string;
  healthScore?: number;
  observations: string[];
  fertilizerAdvice?: string;
  irrigationAdvice?: string;
  yieldLowQa?: number;
  yieldHighQa?: number;
  confidence?: number;
  aiResponse?: string;
  farmerNotes?: string;
  areaAcres?: number;
  village?: string;
  taluk?: string;
  district?: string;
}

export interface DemoFarmData {
  fields: DemoField[];
  analyses: DemoAnalysis[];
}

export const SAMPLE_LEAF_IMAGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480">
  <defs>
    <linearGradient id="bg" x2="0" y2="1"><stop stop-color="#dcebd8"/><stop offset="1" stop-color="#8cae81"/></linearGradient>
    <linearGradient id="leaf" x2="1" y2="1"><stop stop-color="#69a64e"/><stop offset="1" stop-color="#28633c"/></linearGradient>
  </defs>
  <rect width="640" height="480" fill="url(#bg)"/>
  <path d="M92 390C104 226 254 73 529 56 516 274 358 411 92 390Z" fill="url(#leaf)" stroke="#194b31" stroke-width="8"/>
  <path d="M100 388 493 82M238 285l-23-108m94 34 68-91m-92 228-87-21m204-35 101-3" fill="none" stroke="#d1df8d" stroke-width="8" stroke-linecap="round"/>
  <g fill="#b56b38" stroke="#f1c67c" stroke-width="7">
    <circle cx="286" cy="214" r="20"/><circle cx="383" cy="164" r="16"/><circle cx="355" cy="279" r="24"/>
    <circle cx="455" cy="229" r="17"/><circle cx="225" cy="326" r="14"/><circle cx="435" cy="321" r="13"/>
  </g>
  <text x="24" y="448" font-family="sans-serif" font-size="21" fill="#163b28">Illustrative leaf-spot sample · not a real field photo</text>
</svg>` )}`;

const initialData = (): DemoFarmData => {
  const now = Date.now();
  const fieldId = "demo-field-devanahalli";
  return {
    fields: [{
      _id: fieldId,
      fieldName: "Devanahalli Pomegranate Farm",
      area: 1.5,
      crop: "pomegranate",
      variety: "Bhagwa",
      village: "Devanahalli",
      taluk: "Devanahalli",
      district: "Bengaluru Rural",
      state: "Karnataka",
      sowingDate: new Date(now - 90 * 86_400_000).toISOString().slice(0, 10),
      irrigationType: "Drip",
    }],
    analyses: [
      {
        _id: "demo-analysis-previous",
        fieldId,
        analyzedAt: now - 28 * 86_400_000,
        images: [SAMPLE_LEAF_IMAGE],
        crop: "pomegranate",
        variety: "Bhagwa",
        growthStage: "Fruiting",
        healthStatus: "moderate_stress",
        healthScore: 62,
        observations: ["Illustrative sample: a few leaf spots are visible; confirm symptoms in the field."],
        fertilizerAdvice: "Use a recent soil test before changing nutrient inputs.",
        irrigationAdvice: "Maintain even soil moisture and avoid prolonged leaf wetness.",
        yieldLowQa: 28,
        yieldHighQa: 42,
        confidence: 0.62,
        aiResponse: "Demo history only; this is not a diagnosis of a real crop.",
        areaAcres: 1.5,
        village: "Devanahalli",
        taluk: "Devanahalli",
        district: "Bengaluru Rural",
      },
      {
        _id: "demo-analysis-current",
        fieldId,
        analyzedAt: now - 2 * 86_400_000,
        images: [SAMPLE_LEAF_IMAGE],
        crop: "pomegranate",
        variety: "Bhagwa",
        growthStage: "Fruiting",
        healthStatus: "mild_stress",
        healthScore: 73,
        observations: ["Illustrative sample: monitor leaf spots and compare new growth over several days."],
        fertilizerAdvice: "Check soil pH and N-P-K values before applying fertilizer.",
        irrigationAdvice: "Water near the root zone; avoid wetting foliage late in the day.",
        yieldLowQa: 32,
        yieldHighQa: 48,
        confidence: 0.68,
        aiResponse: "Demo history only; actual crop condition requires field inspection.",
        areaAcres: 1.5,
        village: "Devanahalli",
        taluk: "Devanahalli",
        district: "Bengaluru Rural",
      },
    ],
  };
};

function readData(): DemoFarmData {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return initialData();
    const parsed: unknown = JSON.parse(stored);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "fields" in parsed &&
      "analyses" in parsed &&
      Array.isArray(parsed.fields) &&
      Array.isArray(parsed.analyses)
    ) {
      return parsed as DemoFarmData;
    }
    throw new Error("Stored demo farm data has an invalid shape.");
  } catch (error) {
    console.error("Could not read local demo farm data.", error);
    return initialData();
  }
}

export function loadDemoFarmData(): DemoFarmData {
  return typeof window === "undefined" ? initialData() : readData();
}

export function saveDemoFarmData(data: DemoFarmData): DemoFarmData {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new Event(DEMO_FARM_EVENT));
  return data;
}

export function addDemoField(
  input: Omit<DemoField, "_id">,
): DemoFarmData {
  const data = readData();
  const field: DemoField = {
    ...input,
    _id: `demo-field-${Date.now()}`,
  };
  return saveDemoFarmData({ ...data, fields: [field, ...data.fields] });
}

export function deleteDemoField(fieldId: string): DemoFarmData {
  const data = readData();
  return saveDemoFarmData({
    fields: data.fields.filter((field) => field._id !== fieldId),
    analyses: data.analyses.filter((analysis) => analysis.fieldId !== fieldId),
  });
}

export function appendDemoAnalysis(
  analysis: Omit<DemoAnalysis, "_id" | "analyzedAt"> & { analyzedAt?: number },
): DemoFarmData {
  const data = readData();
  const next: DemoAnalysis = {
    ...analysis,
    _id: `demo-analysis-${Date.now()}`,
    analyzedAt: analysis.analyzedAt ?? Date.now(),
  };
  return saveDemoFarmData({ ...data, analyses: [next, ...data.analyses] });
}

export function updateDemoAnalysis(
  analysisId: string,
  patch: Partial<DemoAnalysis>,
): DemoFarmData {
  const data = readData();
  return saveDemoFarmData({
    ...data,
    analyses: data.analyses.map((analysis) =>
      analysis._id === analysisId ? { ...analysis, ...patch } : analysis,
    ),
  });
}

export function deleteDemoAnalysis(analysisId: string): DemoFarmData {
  const data = readData();
  return saveDemoFarmData({
    ...data,
    analyses: data.analyses.filter((analysis) => analysis._id !== analysisId),
  });
}
