/**
 * KrishiMitra AI — Phase 1 saved model artefacts.
 *
 * These per-crop statistics were computed from the standard 22-crop Crop
 * Recommendation dataset (2,200 records × 8 columns) using the reproducible
 * evaluation script `scripts/eval-crop-model.ts`:
 *
 *   curl -s https://raw.githubusercontent.com/Gladiator07/Harvestify/master/Data-processed/crop_recommendation.csv \
 *     | bun scripts/eval-crop-model.ts
 *
 * A Gaussian Naive Bayes classifier trained on the full dataset is *exactly*
 * equivalent to (prior, per-feature mean, per-feature variance) per class, so
 * these profiles ARE the saved model (equivalent of crop_recommendation.pkl +
 * crop_label_encoder.pkl in a scikit-learn pipeline).
 */

export const DATASET_INFO = {
  records: 2200,
  classes: 22,
  recordsPerClass: 100,
  folds: 5,
  source:
    "Standard Crop Recommendation dataset (Kaggle / Harvestify mirror), columns: N,P,K,temperature,humidity,ph,rainfall,label",
} as const;

export type FeatureKey =
  | "N"
  | "P"
  | "K"
  | "temperature"
  | "humidity"
  | "ph"
  | "rainfall";

export const FEATURE_KEYS: FeatureKey[] = [
  "N",
  "P",
  "K",
  "temperature",
  "humidity",
  "ph",
  "rainfall",
];

export interface FeatureStat {
  mean: number;
  std: number;
  min: number;
  max: number;
}

export interface CropProfile {
  count: number;
  stats: Record<FeatureKey, FeatureStat>;
}

/** Cross-validated model comparison (5-fold, seeded shuffle, full dataset). */
export const MODEL_EVALUATION = {
  selected: "gaussian_nb",
  evalNote: "5-fold cross-validation on all 2,200 records (seeded shuffle)",
  candidates: [
    {
      name: "gaussian_nb",
      label: "Gaussian Naive Bayes",
      accuracy: 0.995,
      macroPrecision: 0.9952,
      macroRecall: 0.995,
      macroF1: 0.995,
    },
    {
      name: "knn",
      label: "k-Nearest Neighbours (k=3)",
      accuracy: 0.9768,
      macroPrecision: 0.9775,
      macroRecall: 0.9768,
      macroF1: 0.9768,
    },
    {
      name: "centroid",
      label: "Gaussian centroid matching",
      accuracy: 0.9918,
      macroPrecision: 0.9921,
      macroRecall: 0.9918,
      macroF1: 0.9918,
    },
  ],
} as const;

const s = (mean: number, std: number, min: number, max: number): FeatureStat => ({
  mean,
  std,
  min,
  max,
});

const p = (
  count: number,
  N: FeatureStat,
  P: FeatureStat,
  K: FeatureStat,
  temperature: FeatureStat,
  humidity: FeatureStat,
  ph: FeatureStat,
  rainfall: FeatureStat,
): CropProfile => ({ count, stats: { N, P, K, temperature, humidity, ph, rainfall } });

export const CROP_PROFILES: Record<string, CropProfile> = {
  apple: p(100, s(20.8, 11.86, 0, 40), s(134.22, 8.14, 120, 145), s(199.89, 3.32, 195, 205), s(22.63, 0.83, 21.04, 24), s(92.33, 1.46, 90.03, 94.92), s(5.93, 0.27, 5.51, 6.5), s(112.65, 7.1, 100.12, 124.98)),
  banana: p(100, s(100.23, 11.11, 80, 120), s(82.01, 7.69, 70, 95), s(50.05, 3.38, 45, 55), s(27.38, 1.43, 25.01, 29.91), s(80.36, 2.81, 75.03, 84.98), s(5.98, 0.27, 5.51, 6.49), s(104.63, 9.4, 90.11, 119.85)),
  blackgram: p(100, s(40.02, 12.66, 20, 60), s(67.47, 7.15, 55, 80), s(19.24, 3.19, 15, 25), s(29.97, 2.69, 25.1, 34.95), s(65.12, 2.8, 60.07, 69.96), s(7.13, 0.37, 6.5, 7.78), s(67.88, 4.18, 60.42, 74.92)),
  chickpea: p(100, s(40.09, 12.15, 20, 60), s(67.79, 7.5, 55, 80), s(79.92, 3.26, 75, 85), s(18.87, 1.17, 17.02, 21), s(16.86, 1.71, 14.26, 19.97), s(7.34, 0.8, 5.99, 8.87), s(80.06, 7.94, 65.11, 94.78)),
  coconut: p(100, s(21.98, 11.76, 0, 40), s(16.93, 8.36, 5, 30), s(30.59, 3, 25, 35), s(27.41, 1.39, 25.01, 29.87), s(94.84, 2.69, 90.02, 99.98), s(5.98, 0.29, 5.5, 6.47), s(175.69, 29.47, 131.09, 225.63)),
  coffee: p(100, s(101.2, 12.35, 80, 120), s(28.74, 7.28, 15, 40), s(29.94, 3.25, 25, 35), s(25.54, 1.5, 23.06, 27.92), s(58.87, 5.84, 50.05, 69.95), s(6.79, 0.42, 6.02, 7.49), s(158.07, 25.7, 115.16, 199.47)),
  cotton: p(100, s(117.77, 11.63, 100, 140), s(46.24, 7.35, 35, 60), s(19.56, 3.17, 15, 25), s(23.99, 1.14, 22, 25.99), s(79.84, 3.05, 75.01, 84.88), s(6.91, 0.63, 5.8, 7.99), s(80.4, 11.23, 60.65, 99.93)),
  grapes: p(100, s(23.18, 12.47, 0, 40), s(132.53, 7.62, 120, 145), s(200.11, 3.27, 195, 205), s(23.85, 9.74, 8.83, 41.95), s(81.88, 1.18, 80.02, 83.98), s(6.03, 0.3, 5.51, 6.5), s(69.61, 2.95, 65.01, 74.92)),
  jute: p(100, s(78.4, 10.97, 60, 100), s(46.86, 7.2, 35, 60), s(39.99, 3.31, 35, 45), s(24.96, 1.19, 23.09, 26.99), s(79.64, 5.51, 70.88, 89.89), s(6.73, 0.45, 6, 7.49), s(174.79, 15.08, 150.24, 199.84)),
  kidneybeans: p(100, s(20.75, 10.83, 0, 40), s(67.54, 7.57, 55, 80), s(20.05, 3.1, 15, 25), s(20.12, 2.6, 15.33, 24.92), s(21.61, 2.17, 18.09, 24.97), s(5.75, 0.15, 5.5, 6), s(105.92, 26.11, 60.28, 149.74)),
  lentil: p(100, s(18.77, 12.2, 0, 40), s(68.36, 7.34, 55, 80), s(19.41, 2.97, 15, 25), s(24.51, 3.32, 18.06, 29.94), s(64.8, 2.94, 60.09, 69.92), s(6.93, 0.55, 5.92, 7.84), s(45.68, 5.63, 35.03, 54.94)),
  maize: p(100, s(77.76, 11.95, 60, 100), s(48.44, 8.01, 35, 60), s(19.79, 2.94, 15, 25), s(22.39, 2.68, 18.04, 26.55), s(65.09, 5.45, 55.28, 74.83), s(6.25, 0.41, 5.51, 7), s(84.77, 15.55, 60.65, 109.75)),
  mango: p(100, s(20.07, 12.33, 0, 40), s(27.18, 7.66, 15, 40), s(29.92, 3.1, 25, 35), s(31.21, 2.65, 27, 35.99), s(50.16, 2.76, 45.02, 54.96), s(5.77, 0.7, 4.51, 6.97), s(94.7, 3.34, 89.29, 100.81)),
  mothbeans: p(100, s(21.44, 11.34, 0, 40), s(48.01, 7.55, 35, 60), s(20.23, 3.05, 15, 25), s(28.19, 2.21, 24.02, 32), s(53.16, 6.99, 40.01, 64.96), s(6.83, 1.86, 3.5, 9.94), s(51.2, 13.75, 30.92, 74.44)),
  mungbean: p(100, s(20.99, 11.51, 0, 40), s(47.28, 7.87, 35, 60), s(19.87, 3.15, 15, 25), s(28.53, 0.84, 27.01, 29.91), s(85.5, 2.85, 80.03, 90), s(6.72, 0.29, 6.22, 7.2), s(48.4, 7.12, 36.12, 59.87)),
  muskmelon: p(100, s(100.32, 12.18, 80, 120), s(17.72, 7.19, 5, 30), s(50.08, 3.22, 45, 55), s(28.66, 0.86, 27.02, 29.94), s(92.34, 1.51, 90.02, 94.96), s(6.36, 0.23, 6, 6.78), s(24.69, 2.77, 20.21, 29.87)),
  orange: p(100, s(19.58, 11.94, 0, 40), s(16.55, 7.69, 5, 30), s(10.01, 3.06, 5, 15), s(22.77, 7.34, 10.01, 34.91), s(92.17, 1.43, 90.01, 94.96), s(7.02, 0.58, 6.01, 8), s(110.47, 5.72, 100.17, 119.69)),
  papaya: p(100, s(49.88, 12.22, 31, 70), s(59.05, 7.06, 46, 70), s(50.04, 3.1, 45, 55), s(33.72, 6.26, 23.01, 43.68), s(92.4, 1.42, 90.04, 94.94), s(6.74, 0.15, 6.5, 6.99), s(142.63, 64.4, 40.35, 248.86)),
  pigeonpeas: p(100, s(20.73, 11.85, 0, 40), s(67.73, 7.29, 55, 80), s(20.29, 2.82, 15, 25), s(27.74, 5.72, 18.32, 36.98), s(48.06, 10.96, 30.4, 69.69), s(5.79, 0.83, 4.55, 7.45), s(149.46, 32.99, 90.05, 198.83)),
  pomegranate: p(100, s(18.87, 12.62, 0, 40), s(18.75, 7.39, 5, 30), s(40.21, 3.03, 35, 45), s(21.84, 2.21, 18.07, 24.96), s(90.13, 2.83, 85.13, 95), s(6.43, 0.49, 5.56, 7.2), s(107.53, 2.9, 102.52, 112.48)),
  rice: p(100, s(79.89, 11.92, 60, 99), s(47.58, 7.9, 35, 60), s(39.87, 2.95, 35, 45), s(23.69, 2.03, 20.05, 26.93), s(82.27, 1.42, 80.12, 84.97), s(6.43, 0.77, 5.01, 7.87), s(236.18, 34.29, 182.56, 298.56)),
  watermelon: p(100, s(99.42, 12.57, 80, 120), s(17, 7.54, 5, 30), s(50.22, 3.26, 45, 55), s(25.59, 0.85, 24.04, 26.99), s(85.16, 2.96, 80.03, 89.98), s(6.5, 0.28, 6, 6.96), s(50.79, 5.87, 40.13, 59.76)),
};
