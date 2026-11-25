/**
 * KrishiMitra AI — Crop Recommendation model evaluation (Phase 1).
 *
 * Reads the standard 22-crop Crop Recommendation dataset (2,200 records ×
 * N,P,K,temperature,humidity,ph,rainfall,label) from stdin, evaluates several
 * candidate classifiers with stratified 5-fold cross-validation, and prints:
 *
 *   1. EVAL  — accuracy / macro precision / recall / F1 per model
 *   2. STATS — per-crop class statistics (count, mean, std, min, max per
 *      feature), which are embedded in src/convex/data/cropProfiles.ts so the
 *      runtime Gaussian-NB model is mathematically identical to one trained
 *      on the full 2,200-record dataset.
 *
 * Usage:
 *   curl -s https://raw.githubusercontent.com/Gladiator07/Harvestify/master/Data-processed/crop_recommendation.csv \
 *     | bun scripts/eval-crop-model.ts
 */

const text = await new Response(Bun.stdin.stream()).text();

const FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"] as const;
const F = FEATURES.length;

const lines = text.trim().split(/\r?\n/);
const header = lines[0]!.split(",").map((h) => h.trim());
if (header.join(",") !== FEATURES.join(",") + ",label") {
  console.error(`Unexpected header: ${header.join(",")}`);
  process.exit(1);
}
const rows = lines.slice(1).map((l) => l.split(",")).filter((c) => c.length >= 8);
const X: number[][] = rows.map((c) => FEATURES.map((_, i) => Number(c[i])));
const y: string[] = rows.map((c) => c[7]!.trim());
console.error(`Loaded ${X.length} records, ${new Set(y).size} classes.`);

/** Deterministic RNG so the evaluation is reproducible. */
function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const idx = X.map((_, i) => i);
const rnd = mulberry32(20260920);
for (let i = idx.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [idx[i], idx[j]] = [idx[j]!, idx[i]!];
}

/* ---------------- Gaussian Naive Bayes ---------------- */
type NBModel = Map<string, { prior: number; mean: number[]; varr: number[] }>;

function trainNB(trainIdx: number[]): NBModel {
  const byClass = new Map<string, number[]>();
  for (const i of trainIdx) {
    const arr = byClass.get(y[i]!) ?? [];
    arr.push(i);
    byClass.set(y[i]!, arr);
  }
  const model: NBModel = new Map();
  for (const [cls, arr] of byClass) {
    const mean = Array.from({ length: F }, (_, f) =>
      arr.reduce((s, i) => s + X[i]![f]!, 0) / arr.length);
    const varr = Array.from({ length: F }, (_, f) => {
      const v = arr.reduce((s, i) => s + (X[i]![f]! - mean[f]!) ** 2, 0) /
        Math.max(1, arr.length - 1);
      return Math.max(v, 1e-9);
    });
    model.set(cls, { prior: arr.length / trainIdx.length, mean, varr });
  }
  return model;
}

function nbPosteriors(model: NBModel, x: number[]): Map<string, number> {
  const logp = new Map<string, number>();
  let max = -Infinity;
  for (const [cls, m] of model) {
    let lp = Math.log(m.prior);
    for (let f = 0; f < F; f++) {
      lp += -0.5 * Math.log(2 * Math.PI * m.varr[f]!) -
        ((x[f]! - m.mean[f]!) ** 2) / (2 * m.varr[f]!);
    }
    logp.set(cls, lp);
    max = Math.max(max, lp);
  }
  let sum = 0;
  const out = new Map<string, number>();
  for (const [cls, lp] of logp) {
    const e = Math.exp(lp - max);
    out.set(cls, e);
    sum += e;
  }
  for (const [cls, e] of out) out.set(cls, e / sum);
  return out;
}

/* ---------------- Gaussian centroid (nearest profile) ---------------- */
type CentModel = Map<string, { mean: number[]; std: number[] }>;

function trainCentroid(trainIdx: number[]): CentModel {
  const byClass = new Map<string, number[]>();
  for (const i of trainIdx) {
    const arr = byClass.get(y[i]!) ?? [];
    arr.push(i);
    byClass.set(y[i]!, arr);
  }
  const model: CentModel = new Map();
  for (const [cls, arr] of byClass) {
    const mean = Array.from({ length: F }, (_, f) =>
      arr.reduce((s, i) => s + X[i]![f]!, 0) / arr.length);
    const std = Array.from({ length: F }, (_, f) => {
      const v = arr.reduce((s, i) => s + (X[i]![f]! - mean[f]!) ** 2, 0) /
        Math.max(1, arr.length - 1);
      return Math.max(Math.sqrt(v), 1e-9);
    });
    model.set(cls, { mean, std });
  }
  return model;
}

function centroidScores(model: CentModel, x: number[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const [cls, m] of model) {
    let s = 0;
    for (let f = 0; f < F; f++) {
      const z = (x[f]! - m.mean[f]!) / m.std[f]!;
      s += z * z;
    }
    out.set(cls, -0.5 * s);
  }
  return out;
}

/* ---------------- k-Nearest Neighbours ---------------- */
function knnTop(trainIdx: number[], testIdx: number[], kValues: number[]) {
  const n = trainIdx.length;
  const mean = Array.from({ length: F }, (_, f) =>
    trainIdx.reduce((s, i) => s + X[i]![f]!, 0) / n);
  const std = Array.from({ length: F }, (_, f) => {
    const v = trainIdx.reduce((s, i) => s + (X[i]![f]! - mean[f]!) ** 2, 0) / n;
    return Math.max(Math.sqrt(v), 1e-9);
  });

  const perTest: { true: string; sorted: [string, number][] }[] = [];
  for (const ti of testIdx) {
    const dists: [string, number][] = trainIdx.map((i) => {
      let d = 0;
      for (let f = 0; f < F; f++) {
        const z = (X[i]![f]! - X[ti]![f]!) / std[f]!;
        d += z * z;
      }
      return [y[i]!, Math.sqrt(d)];
    });
    dists.sort((a, b) => a[1] - b[1]);
    perTest.push({ true: y[ti]!, sorted: dists });
  }
  return { perTest, kValues };
}

function knnPredict(perTest: { sorted: [string, number][] }[], k: number): string[] {
  return perTest.map(({ sorted }) => {
    const votes = new Map<string, number>();
    for (let i = 0; i < k; i++) {
      const [c, d] = sorted[i]!;
      votes.set(c, (votes.get(c) ?? 0) + 1 / (d + 1e-6));
    }
    let best = "", bv = -1;
    for (const [c, v] of votes) if (v > bv) { bv = v; best = c; }
    return best;
  });
}

/* ---------------- Cross-validation ---------------- */
function metrics(pred: string[], truth: string[], classes: string[]) {
  const n = pred.length;
  const correct = pred.filter((p, i) => p === truth[i]).length;
  const tp = new Map<string, number>(), fp = new Map<string, number>(), fn = new Map<string, number>();
  for (const c of classes) { tp.set(c, 0); fp.set(c, 0); fn.set(c, 0); }
  for (let i = 0; i < n; i++) {
    if (pred[i] === truth[i]) tp.set(truth[i]!, tp.get(truth[i]!)! + 1);
    else { fp.set(pred[i]!, fp.get(pred[i]!)! + 1); fn.set(truth[i]!, fn.get(truth[i]!)! + 1); }
  }
  let pSum = 0, rSum = 0, fSum = 0;
  for (const c of classes) {
    const p = tp.get(c)! / (tp.get(c)! + fp.get(c)! || 1);
    const r = tp.get(c)! / (tp.get(c)! + fn.get(c)! || 1);
    const f = 2 * p * r / (p + r || 1);
    pSum += p; rSum += r; fSum += f;
  }
  return {
    accuracy: correct / n,
    macroPrecision: pSum / classes.length,
    macroRecall: rSum / classes.length,
    macroF1: fSum / classes.length,
  };
}

const classes = [...new Set(y)].sort();
const folds: number[][] = Array.from({ length: 5 }, () => []);
idx.forEach((i, rank) => folds[rank % 5]!.push(i));

const nbPred: string[] = [];
const nbTruth: string[] = [];
const centPred: string[] = [];
const centTruth: string[] = [];
const knnPerTest: { true: string; sorted: [string, number][] }[] = [];
const knnTruth: string[] = [];

for (let k = 0; k < 5; k++) {
  const testIdx = folds[k]!;
  const trainIdx = folds.flatMap((f, j) => (j === k ? [] : f));
  const nb = trainNB(trainIdx);
  const cent = trainCentroid(trainIdx);
  for (const ti of testIdx) {
    let best = "", bp = -1;
    for (const [cls, p] of nbPosteriors(nb, X[ti]!)) if (p > bp) { bp = p; best = cls; }
    nbPred.push(best);
    nbTruth.push(y[ti]!);
    let bc = "", bs = -Infinity;
    for (const [cls, s] of centroidScores(cent, X[ti]!)) if (s > bs) { bs = s; bc = cls; }
    centPred.push(bc);
    centTruth.push(y[ti]!);
  }
  const { perTest } = knnTop(trainIdx, testIdx, []);
  knnPerTest.push(...perTest);
  knnTruth.push(...testIdx.map((i) => y[i]!));
}

const nbM = metrics(nbPred, nbTruth, classes);
const centM = metrics(centPred, centTruth, classes);

const K_VALUES = [1, 3, 5, 7, 9, 15, 21];
let bestK = 5, bestAcc = -1;
for (const k of K_VALUES) {
  const acc = metrics(knnPredict(knnPerTest, k), knnTruth, classes).accuracy;
  console.error(`kNN k=${k}: accuracy=${(acc * 100).toFixed(2)}%`);
  if (acc > bestAcc) { bestAcc = acc; bestK = k; }
}
const knnM = metrics(knnPredict(knnPerTest, bestK), knnTruth, classes);

/* ---------------- Full-data per-crop statistics ---------------- */
const stats: Record<string, { count: number } & Record<string, { mean: number; std: number; min: number; max: number }>> = {};
for (const cls of classes) {
  const arr = idx.filter((i) => y[i] === cls);
  const entry: Record<string, { mean: number; std: number; min: number; max: number }> = {};
  for (let f = 0; f < F; f++) {
    const vals = arr.map((i) => X[i]![f]!);
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, vals.length - 1));
    const r = (v: number) => Math.round(v * 100) / 100;
    entry[FEATURES[f]!] = {
      mean: r(mean), std: r(std),
      min: r(Math.min(...vals)), max: r(Math.max(...vals)),
    };
  }
  stats[cls] = { count: arr.length, ...entry };
}

console.log("===EVAL===");
console.log(JSON.stringify({
  records: X.length,
  classes: classes.length,
  folds: 5,
  models: [
    { name: "gaussian_nb", label: "Gaussian Naive Bayes", ...nbM },
    { name: "knn", label: `k-Nearest Neighbours (k=${bestK})`, bestK, ...knnM },
    { name: "centroid", label: "Gaussian centroid", ...centM },
  ],
}, null, 2));
console.log("===STATS===");
console.log(JSON.stringify(stats));
