import { describe, expect, it } from 'vitest';
import type { MLPredictionResult, MLTrainingRow, TrainedMLModel } from '../mlTrainingTypes';
import {
  calculateBrierScore,
  calculateConfusionMatrix,
  evaluateModel,
  splitTrainTest,
} from '../mlEvaluation';

const makeRow = (id: string, x: number, label: 0 | 1): MLTrainingRow => ({
  prospectId: id,
  prospectName: id,
  features: { x },
  label,
  target: 'geological_success',
  isSynthetic: false,
});

const makePrediction = (
  id: string,
  probability: number,
  predictedLabel: 0 | 1,
): MLPredictionResult => ({
  prospectId: id,
  probability,
  predictedLabel,
  threshold: 0.5,
  topFactors: [],
});

// A trivial model: probability = sigmoid(10 * normalized(x)); with mean 0 / std 1
// a positive x predicts ~1 and a negative x predicts ~0.
const trivialModel: TrainedMLModel = {
  modelType: 'logistic_regression',
  target: 'geological_success',
  featureMode: 'safe_pre_drill',
  featureNames: ['x'],
  weights: [10],
  intercept: 0,
  normalization: { x: { mean: 0, std: 1 } },
  trainedAt: '2026-01-01T00:00:00.000Z',
  trainingExamples: 8,
  testExamples: 0,
  excludedExamples: 0,
  warnings: [],
};

describe('splitTrainTest', () => {
  it('is deterministic for the same seed', () => {
    const rows = Array.from({ length: 20 }, (_, i) => makeRow(`p${i}`, i, (i % 2) as 0 | 1));
    const a = splitTrainTest(rows, 0.8, 42);
    const b = splitTrainTest(rows, 0.8, 42);
    expect(a.trainRows.map((r) => r.prospectId)).toEqual(b.trainRows.map((r) => r.prospectId));
    expect(a.testRows.map((r) => r.prospectId)).toEqual(b.testRows.map((r) => r.prospectId));
  });

  it('splits at the configured ratio', () => {
    const rows = Array.from({ length: 10 }, (_, i) => makeRow(`p${i}`, i, 1));
    const { trainRows, testRows } = splitTrainTest(rows, 0.7, 1);
    expect(trainRows).toHaveLength(7);
    expect(testRows).toHaveLength(3);
  });

  it('produces different partitions for different seeds', () => {
    const rows = Array.from({ length: 20 }, (_, i) => makeRow(`p${i}`, i, 1));
    const a = splitTrainTest(rows, 0.8, 1).trainRows.map((r) => r.prospectId);
    const b = splitTrainTest(rows, 0.8, 999).trainRows.map((r) => r.prospectId);
    expect(a).not.toEqual(b);
  });
});

describe('calculateConfusionMatrix', () => {
  it('counts TP/FP/TN/FN correctly', () => {
    const rows = [makeRow('a', 1, 1), makeRow('b', 1, 1), makeRow('c', 0, 0), makeRow('d', 0, 0)];
    const predictions = [
      makePrediction('a', 0.9, 1), // TP
      makePrediction('b', 0.2, 0), // FN
      makePrediction('c', 0.8, 1), // FP
      makePrediction('d', 0.1, 0), // TN
    ];
    const cm = calculateConfusionMatrix(rows, predictions);
    expect(cm).toEqual({ truePositive: 1, falsePositive: 1, trueNegative: 1, falseNegative: 1 });
  });
});

describe('calculateBrierScore', () => {
  it('computes the mean squared error of probabilities', () => {
    const rows = [makeRow('a', 1, 1), makeRow('b', 0, 0)];
    const predictions = [makePrediction('a', 0.8, 1), makePrediction('b', 0.3, 0)];
    // ((0.8-1)^2 + (0.3-0)^2) / 2 = (0.04 + 0.09)/2 = 0.065
    expect(calculateBrierScore(rows, predictions)).toBeCloseTo(0.065, 10);
  });

  it('returns 0 for empty input', () => {
    expect(calculateBrierScore([], [])).toBe(0);
  });
});

describe('evaluateModel', () => {
  it('returns metrics and one prediction per test row', () => {
    const testRows = [makeRow('a', 2, 1), makeRow('b', -2, 0), makeRow('c', 2, 1), makeRow('d', -2, 0)];
    const { metrics, predictions } = evaluateModel(trivialModel, testRows);
    expect(predictions).toHaveLength(4);
    expect(metrics.accuracy).toBe(1);
    expect(metrics.precision).toBe(1);
    expect(metrics.recall).toBe(1);
    expect(metrics.f1).toBe(1);
    expect(metrics.testSize).toBe(4);
  });

  it('handles a zero-division case without NaN (all predicted negative)', () => {
    const testRows = [makeRow('a', -2, 1), makeRow('b', -2, 0)];
    const { metrics } = evaluateModel(trivialModel, testRows);
    expect(metrics.precision).toBe(0);
    expect(Number.isNaN(metrics.f1)).toBe(false);
    expect(metrics.f1).toBe(0);
  });

  it('reports positive and predicted-positive rates', () => {
    const testRows = [makeRow('a', 2, 1), makeRow('b', -2, 0)];
    const { metrics } = evaluateModel(trivialModel, testRows);
    expect(metrics.positiveRate).toBe(0.5);
    expect(metrics.predictedPositiveRate).toBe(0.5);
  });
});
