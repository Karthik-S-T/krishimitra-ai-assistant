import { evaluateCropSuitability, evaluatePomegranate } from "../src/convex/suitability";

const show = (name: string, r: ReturnType<typeof evaluateCropSuitability>) =>
  console.log(
    name.padEnd(12), "->", r.category,
    "| conf", r.confidence,
    "| rules", r.evaluatedCount + "/" + r.totalCount,
    "| pass", r.reasons.length,
    "| warn", r.attention.length,
    "| fail", r.limiting.length,
    "| missing", r.missing.length,
  );

// Well-suited pomegranate case (real SHC-scale soil values, realistic climate)
show("pom good", evaluatePomegranate({ temperature: 24, rainfall: 650, ph: 6.9, N: 320, P: 20, K: 250, irrigation: "full" }));
// Harsh case: heat + alkaline soil + no irrigation
show("pom harsh", evaluatePomegranate({ temperature: 40, rainfall: 80, ph: 9.5, N: 50, P: 5, K: 20, irrigation: "rainfed" }));
// Missing soil must be missing, not zero
const r3 = evaluateCropSuitability("tomato", { temperature: 26, rainfall: 650, irrigation: "partial" });
show("tomato(no soil)", r3);
console.log("   zero-treated-as-value check:", r3.missing.some((m) => /measured: 0\b/.test(m)) ? "FAIL" : "OK (no zeros)");
// Curated crops in season-like climate
for (const c of ["wheat", "sugarcane", "onion", "potato", "chilli", "groundnut"]) {
  show(c, evaluateCropSuitability(c, { temperature: 27, ph: 6.8, rainfall: 700, irrigation: "full" }));
}
// Dataset crops with only temp/pH
for (const c of ["rice", "maize", "cotton", "banana", "grapes", "coffee"]) {
  show(c, evaluateCropSuitability(c, { temperature: 27, ph: 6.8 }));
}
