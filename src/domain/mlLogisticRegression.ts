// Pure-TypeScript logistic regression for the ML training baseline.
//
// No external ML dependency. Batch gradient descent with optional L2
// penalty. Deterministic: the same rows + config always produce the same
// weights. Feature values are z-score normalised; the normalisation
// parameters are stored on the model so predictions normalise new inputs
// identically.

import type { Prospect } from './prospect';
import type {
  MLPredictionResult,
  MLTrainingConfig,
  MLTrainingRow,
  TrainedMLModel,
} from './mlTrainingTypes';
import { extractTrainingFeatures } from './mlTrainingFeatures';

const PROB_EPSILON = 1e-6;

/** Numerically stable logistic sigmoid. */
export const sigmoid = (x: number): number => {
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
};

/**
 * Z-score normalises the feature matrix. Feature order is the sorted union
 * of keys (deterministic). A zero standard deviation is replaced with 1 so
 * constant features map to 0 instead of producing NaN.
 */
export const normalizeFeatureMatrix = (
  rows: MLTrainingRow[],
): {
  normalizedRows: MLTrainingRow[];
  normalization: TrainedMLModel['normalization'];
  featureNames: string[];
} => {
  if (rows.length === 0) {
    return { normalizedRows: [], normalization: {}, featureNames: [] };
  }

  const featureNames = Object.keys(rows[0].features).sort();
  const normalization: TrainedMLModel['normalization'] = {};

  for (const name of featureNames) {
    const values = rows.map((r) => r.features[name] ?? 0);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / values.length;
    const rawStd = Math.sqrt(variance);
    const std = rawStd === 0 ? 1 : rawStd;
    normalization[name] = { mean, std };
  }

  const normalizedRows: MLTrainingRow[] = rows.map((r) => {
    const features: Record<string, number> = {};
    for (const name of featureNames) {
      const { mean, std } = normalization[name];
      features[name] = ((r.features[name] ?? 0) - mean) / std;
    }
    return { ...r, features };
  });

  return { normalizedRows, normalization, featureNames };
};

/** Trains a logistic-regression model via batch gradient descent. */
export const trainLogisticRegression = (
  rows: MLTrainingRow[],
  config: MLTrainingConfig,
): TrainedMLModel => {
  const { normalizedRows, normalization, featureNames } = normalizeFeatureMatrix(rows);
  const n = featureNames.length;
  const m = normalizedRows.length;

  const weights = new Array<number>(n).fill(0);
  let intercept = 0;

  if (m > 0 && n > 0) {
    for (let iter = 0; iter < config.iterations; iter++) {
      const gradW = new Array<number>(n).fill(0);
      let gradB = 0;

      for (let i = 0; i < m; i++) {
        const x = normalizedRows[i].features;
        let z = intercept;
        for (let j = 0; j < n; j++) z += weights[j] * (x[featureNames[j]] ?? 0);
        const p = sigmoid(z);
        const err = p - normalizedRows[i].label;
        for (let j = 0; j < n; j++) gradW[j] += err * (x[featureNames[j]] ?? 0);
        gradB += err;
      }

      for (let j = 0; j < n; j++) {
        // L2 penalty applies to weights only, not the intercept.
        const grad = gradW[j] / m + config.l2Penalty * weights[j];
        weights[j] -= config.learningRate * grad;
      }
      intercept -= config.learningRate * (gradB / m);
    }
  }

  return {
    modelType: 'logistic_regression',
    target: config.target,
    featureMode: config.featureMode,
    featureNames,
    weights,
    intercept,
    normalization,
    trainedAt: new Date().toISOString(),
    trainingExamples: m,
    testExamples: 0,
    excludedExamples: 0,
    warnings: [],
  };
};

/** Predicts the positive-class probability for a raw feature record. */
export const predictProbability = (
  model: TrainedMLModel,
  features: Record<string, number>,
): number => {
  let z = model.intercept;
  for (let j = 0; j < model.featureNames.length; j++) {
    const name = model.featureNames[j];
    const norm = model.normalization[name] ?? { mean: 0, std: 1 };
    const std = norm.std === 0 ? 1 : norm.std;
    const v = ((features[name] ?? 0) - norm.mean) / std;
    z += model.weights[j] * v;
  }
  const p = sigmoid(z);
  return Math.max(PROB_EPSILON, Math.min(1 - PROB_EPSILON, p));
};

/**
 * Builds a full prediction result (probability, predicted label, ranked
 * top factors) from a raw feature record. Shared by per-prospect prediction
 * and by the evaluation harness.
 */
export const buildPredictionResult = (
  model: TrainedMLModel,
  prospectId: string,
  features: Record<string, number>,
  threshold = 0.5,
): MLPredictionResult => {
  const probability = predictProbability(model, features);

  const topFactors = model.featureNames
    .map((name, j) => {
      const norm = model.normalization[name] ?? { mean: 0, std: 1 };
      const std = norm.std === 0 ? 1 : norm.std;
      const value = features[name] ?? 0;
      const normalized = (value - norm.mean) / std;
      const weight = model.weights[j];
      const contribution = weight * normalized;
      return {
        feature: name,
        value,
        weight,
        contribution,
        direction: (contribution >= 0 ? 'positive' : 'negative') as 'positive' | 'negative',
      };
    })
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 5);

  return {
    prospectId,
    probability,
    predictedLabel: probability >= threshold ? 1 : 0,
    threshold,
    topFactors,
  };
};

/** Predicts for a prospect, re-extracting features using the model's mode. */
export const predictWithModel = (
  model: TrainedMLModel,
  prospect: Prospect,
  threshold = 0.5,
): MLPredictionResult =>
  buildPredictionResult(
    model,
    prospect.id,
    extractTrainingFeatures(prospect, model.featureMode),
    threshold,
  );
