// Train/test split and evaluation metrics for the ML training baseline.
//
// The split is deterministic for a given seed (mulberry32 PRNG) so training
// runs are reproducible. Metrics handle division-by-zero safely and degrade
// gracefully when a test set contains only one class.

import type {
  MLMetrics,
  MLPredictionResult,
  MLTrainingRow,
  TrainedMLModel,
} from './mlTrainingTypes';
import { buildPredictionResult } from './mlLogisticRegression';

// Deterministic PRNG. Same seed → same sequence.
const mulberry32 = (seed: number) => {
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

  const metrics: MLMetrics = {
    accuracy,
    precision,
    recall,
    f1,
    brierScore,
    confusionMatrix: cm,
    positiveRate: total === 0 ? 0 : positives / total,
    predictedPositiveRate: total === 0 ? 0 : predictedPositives / total,
    trainSize: model.trainingExamples,
    testSize: total,
  };

  return { metrics, predictions };
};
