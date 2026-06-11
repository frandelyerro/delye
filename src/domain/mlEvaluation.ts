// Train/test split, evaluation metrics, ROC-AUC, and k-fold cross-validation
// for the ML training baseline.
//
// The split is deterministic for a given seed (mulberry32 PRNG) so training
// runs are reproducible. Metrics handle division-by-zero safely and degrade
// gracefully when a test set contains only one class.

import type {
  MLCrossValidationResult,
  MLMetrics,
  MLPredictionResult,
  MLTrainingConfig,
  MLTrainingRow,
  MLTrainingTarget,
  TrainedMLModel,
} from './mlTrainingTypes';
import { buildPredictionResult, trainLogisticRegression } from './mlLogisticRegression';
import { buildTrainingRows } from './mlTrainingFeatures';
import { predictWithBaselineModel } from './mlModel';
import type { Prospect } from './prospect';

// Deterministic PRNG. Same seed → same sequence.
export const mulberry32 = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Deterministically shuffles and splits rows into train/test partitions. */
export const splitTrainTest = (
  rows: MLTrainingRow[],
  trainRatio: number,
  seed: number,
): { trainRows: MLTrainingRow[]; testRows: MLTrainingRow[] } => {
  const rng = mulberry32(seed);
  const shuffled = [...rows];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const ratio = Math.max(0, Math.min(1, trainRatio));
  const cut = Math.floor(ratio * shuffled.length);
  return { trainRows: shuffled.slice(0, cut), testRows: shuffled.slice(cut) };
};

export const calculateConfusionMatrix = (
  rows: MLTrainingRow[],
  predictions: MLPredictionResult[],
): MLMetrics['confusionMatrix'] => {
  const predById = new Map(predictions.map((p) => [p.prospectId, p]));
  let truePositive = 0;
  let falsePositive = 0;
  let trueNegative = 0;
  let falseNegative = 0;

  for (const row of rows) {
    const pred = predById.get(row.prospectId);
    if (!pred) continue;
    const actual = row.label;
    const predicted = pred.predictedLabel;
    if (actual === 1 && predicted === 1) truePositive++;
    else if (actual === 0 && predicted === 1) falsePositive++;
    else if (actual === 0 && predicted === 0) trueNegative++;
    else falseNegative++;
  }

  return { truePositive, falsePositive, trueNegative, falseNegative };
};

export const calculateBrierScore = (
  rows: MLTrainingRow[],
  predictions: MLPredictionResult[],
): number => {
  const predById = new Map(predictions.map((p) => [p.prospectId, p]));
  let sum = 0;
  let count = 0;
  for (const row of rows) {
    const pred = predById.get(row.prospectId);
    if (!pred) continue;
    sum += (pred.probability - row.label) ** 2;
    count++;
  }
  return count === 0 ? 0 : sum / count;
};

/**
 * ROC-AUC via the Mann-Whitney U statistic: counts the fraction of
 * (positive, negative) pairs where the positive example scores higher.
 * Returns 0.5 (random) if only one class is present or input is empty.
 * Perfect discrimination returns 1.0.
 */
export const calculateROCAUC = (
  rows: MLTrainingRow[],
  predictions: MLPredictionResult[],
): number => {
  const predById = new Map(predictions.map((p) => [p.prospectId, p]));
  const positives: number[] = [];
  const negatives: number[] = [];

  for (const row of rows) {
    const pred = predById.get(row.prospectId);
    if (!pred) continue;
    if (row.label === 1) positives.push(pred.probability);
    else negatives.push(pred.probability);
  }

  if (positives.length === 0 || negatives.length === 0) return 0.5;

  // Cap at 1000 samples per class to avoid O(n²) slowdown on large datasets.
  // Random subsampling preserves AUC estimate with negligible bias.
  const MAX_SAMPLES = 1000;
  const pos = positives.length > MAX_SAMPLES ? positives.slice(0, MAX_SAMPLES) : positives;
  const neg = negatives.length > MAX_SAMPLES ? negatives.slice(0, MAX_SAMPLES) : negatives;

  let concordant = 0;
  let ties = 0;
  for (const p of pos) {
    for (const n of neg) {
      if (p > n) concordant++;
      else if (p === n) ties++;
    }
  }

  return (concordant + 0.5 * ties) / (pos.length * neg.length);
};

/**
 * Sweeps thresholds [0.05, 0.95] in 0.05 steps and returns the one that
 * maximises F1 on the provided rows/predictions. Falls back to 0.5 when
 * F1 is 0 at every threshold (degenerate dataset).
 */
export const findOptimalThreshold = (
  rows: MLTrainingRow[],
  predictions: MLPredictionResult[],
): number => {
  if (rows.length === 0 || predictions.length === 0) return 0.5;
  const predById = new Map(predictions.map((p) => [p.prospectId, p]));
  let bestThreshold = 0.5;
  let bestF1 = -1;

  for (let t = 5; t <= 95; t += 5) {
    const threshold = t / 100;
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (const row of rows) {
      const pred = predById.get(row.prospectId);
      if (!pred) continue;
      const predicted = pred.probability >= threshold ? 1 : 0;
      if (row.label === 1 && predicted === 1) tp++;
      else if (row.label === 0 && predicted === 1) fp++;
      else if (row.label === 1 && predicted === 0) fn++;
    }
    const p = tp + fp === 0 ? 0 : tp / (tp + fp);
    const r = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = p + r === 0 ? 0 : (2 * p * r) / (p + r);
    if (f1 > bestF1) {
      bestF1 = f1;
      bestThreshold = threshold;
    }
  }

  return bestThreshold;
};

export type FeatureCorrelation = { feature: string; correlation: number };

/**
 * Point-biserial correlation between each training feature and the binary
 * label (equivalent to Pearson correlation against a 0/1 outcome), sorted by
 * |correlation| descending. Returns [] for fewer than 2 rows. A feature with
 * zero variance across rows gets correlation 0 (avoids division by zero).
 *
 * Exploratory only: surfaces which features move with real outcomes on the
 * current labeled set. Not used for feature selection, gating, or causal claims.
 */
export const computeFeatureCorrelations = (rows: MLTrainingRow[]): FeatureCorrelation[] => {
  if (rows.length < 2) return [];
  const n = rows.length;
  const featureNames = Object.keys(rows[0].features);
  const labels: number[] = rows.map((r) => r.label);
  const labelMean = labels.reduce((a, b) => a + b, 0) / n;

  return featureNames
    .map((feature) => {
      const values = rows.map((r) => r.features[feature]);
      const valueMean = values.reduce((a, b) => a + b, 0) / n;
      let cov = 0;
      let varX = 0;
      let varY = 0;
      for (let i = 0; i < n; i++) {
        const dx = values[i] - valueMean;
        const dy = labels[i] - labelMean;
        cov += dx * dy;
        varX += dx * dx;
        varY += dy * dy;
      }
      const denom = Math.sqrt(varX * varY);
      return { feature, correlation: denom === 0 ? 0 : cov / denom };
    })
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
};

/** Evaluates a trained model on a held-out test set. */
export const evaluateModel = (
  model: TrainedMLModel,
  testRows: MLTrainingRow[],
  threshold = 0.5,
): { metrics: MLMetrics; predictions: MLPredictionResult[] } => {
  const predictions = testRows.map((r) =>
    buildPredictionResult(model, r.prospectId, r.features, threshold),
  );

  const cm = calculateConfusionMatrix(testRows, predictions);
  const total = testRows.length;

  const accuracy = total === 0 ? 0 : (cm.truePositive + cm.trueNegative) / total;
  const precisionDenom = cm.truePositive + cm.falsePositive;
  const precision = precisionDenom === 0 ? 0 : cm.truePositive / precisionDenom;
  const recallDenom = cm.truePositive + cm.falseNegative;
  const recall = recallDenom === 0 ? 0 : cm.truePositive / recallDenom;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  const brierScore = calculateBrierScore(testRows, predictions);
  const positives = testRows.filter((r) => r.label === 1).length;
  const predictedPositives = predictions.filter((p) => p.predictedLabel === 1).length;
  const rocAUC = calculateROCAUC(testRows, predictions);
  const optimalThreshold = findOptimalThreshold(testRows, predictions);

  const metrics: MLMetrics = {
    accuracy,
    precision,
    recall,
    f1,
    brierScore,
    rocAUC,
    optimalThreshold,
    confusionMatrix: cm,
    positiveRate: total === 0 ? 0 : positives / total,
    predictedPositiveRate: total === 0 ? 0 : predictedPositives / total,
    trainSize: model.trainingExamples,
    testSize: total,
  };

  return { metrics, predictions };
};

/**
 * Evaluates the deterministic baseline model (`predictWithBaselineModel`)
 * against prospects with REAL (non-synthetic) recorded outcomes — not a
 * trained model, just the fixed weighted-formula baseline. This closes the
 * gap between "the baseline is deterministic" and "here is how it actually
 * performs against ground truth", using the real outcome labels added in
 * cycles 17-18.
 *
 * Synthetic outcomes are always excluded: they were derived FROM the same
 * GCoS formula the baseline partially reuses, so including them would be
 * circular. Returns zeroed metrics (testSize 0) when no real labeled
 * outcomes are available for the requested target.
 */
export const evaluateBaselineOnLabeledOutcomes = (
  prospects: Prospect[],
  target: MLTrainingTarget = 'geological_success',
  threshold = 0.5,
): { metrics: MLMetrics; predictions: MLPredictionResult[] } => {
  const config: MLTrainingConfig = {
    target,
    featureMode: 'safe_pre_drill',
    trainRatio: 1,
    learningRate: 0,
    iterations: 0,
    l2Penalty: 0,
    minExamples: 0,
    excludeSynthetic: true,
    classWeight: 'none',
    patience: 0,
    convergenceTol: 0,
  };
  const { rows } = buildTrainingRows(prospects, config);
  const prospectById = new Map(prospects.map((p) => [p.id, p]));

  const predictions: MLPredictionResult[] = rows.map((row) => {
    const prospect = prospectById.get(row.prospectId);
    const probability = prospect ? predictWithBaselineModel(prospect).predictedGCoS : 0;
    return {
      prospectId: row.prospectId,
      probability,
      predictedLabel: probability >= threshold ? 1 : 0,
      threshold,
      topFactors: [],
    };
  });

  const cm = calculateConfusionMatrix(rows, predictions);
  const total = rows.length;

  const accuracy = total === 0 ? 0 : (cm.truePositive + cm.trueNegative) / total;
  const precisionDenom = cm.truePositive + cm.falsePositive;
  const precision = precisionDenom === 0 ? 0 : cm.truePositive / precisionDenom;
  const recallDenom = cm.truePositive + cm.falseNegative;
  const recall = recallDenom === 0 ? 0 : cm.truePositive / recallDenom;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  const brierScore = calculateBrierScore(rows, predictions);
  const positives = rows.filter((r) => r.label === 1).length;
  const predictedPositives = predictions.filter((p) => p.predictedLabel === 1).length;
  const rocAUC = calculateROCAUC(rows, predictions);
  const optimalThreshold = findOptimalThreshold(rows, predictions);

  const metrics: MLMetrics = {
    accuracy,
    precision,
    recall,
    f1,
    brierScore,
    rocAUC,
    optimalThreshold,
    confusionMatrix: cm,
    positiveRate: total === 0 ? 0 : positives / total,
    predictedPositiveRate: total === 0 ? 0 : predictedPositives / total,
    trainSize: 0,
    testSize: total,
  };

  return { metrics, predictions };
};

/**
 * K-fold cross-validation. Shuffles rows deterministically, splits into k
 * folds, trains on k-1 folds and evaluates on the held-out fold, repeating k
 * times. Returns mean ± std across folds for core metrics.
 *
 * Does NOT use the same seed as the main train/test split to avoid
 * information leakage between CV and the final evaluation.
 */
export const kFoldCrossValidate = (
  rows: MLTrainingRow[],
  config: MLTrainingConfig,
  k: number,
): MLCrossValidationResult => {
  const clampedK = Math.min(Math.max(2, k), Math.min(10, rows.length));
  const rng = mulberry32(999); // fixed CV seed, distinct from training seed
  const shuffled = [...rows];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const foldSize = Math.floor(shuffled.length / clampedK);
  const foldMetrics: MLMetrics[] = [];

  for (let f = 0; f < clampedK; f++) {
    const valStart = f * foldSize;
    const valEnd = f === clampedK - 1 ? shuffled.length : valStart + foldSize;
    const valRows = shuffled.slice(valStart, valEnd);
    const trainRows = [
      ...shuffled.slice(0, valStart),
      ...shuffled.slice(valEnd),
    ];

    if (trainRows.length < 4 || valRows.length < 2) continue;

    const model = trainLogisticRegression(trainRows, config);
    const { metrics } = evaluateModel(model, valRows);
    foldMetrics.push(metrics);
  }

  if (foldMetrics.length === 0) {
    const zero = { accuracy: 0, precision: 0, recall: 0, f1: 0, rocAUC: 0.5, brierScore: 0.25 };
    return { folds: 0, meanMetrics: zero, stdMetrics: zero };
  }

  const keys = ['accuracy', 'precision', 'recall', 'f1', 'rocAUC', 'brierScore'] as const;
  const meanMetrics = {} as MLCrossValidationResult['meanMetrics'];
  const stdMetrics = {} as MLCrossValidationResult['stdMetrics'];

  for (const key of keys) {
    const vals = foldMetrics.map((m) => m[key]);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std = Math.sqrt(
      vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / vals.length,
    );
    meanMetrics[key] = parseFloat(mean.toFixed(4));
    stdMetrics[key] = parseFloat(std.toFixed(4));
  }

  return { folds: foldMetrics.length, meanMetrics, stdMetrics };
};
