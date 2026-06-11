import { describe, expect, it } from 'vitest';
import type { MLPredictionResult, MLTrainingRow, TrainedMLModel } from '../mlTrainingTypes';
import type { MLTrainingConfig } from '../mlTrainingTypes';
import type { Prospect } from '../prospect';
import type { ProspectOutcome, OutcomeLabel } from '../outcomes';
import {
  calculateBrierScore,
  calculateConfusionMatrix,
  calculateROCAUC,
  computeFeatureCorrelations,
  evaluateBaselineOnLabeledOutcomes,
  evaluateModel,
  findOptimalThreshold,
  kFoldCrossValidate,
  splitTrainTest,
} from '../mlEvaluation';
import { getDefaultMLTrainingConfig } from '../mlTrainingService';

const makeProspect = (overrides: Partial<Prospect> = {}): Prospect => ({
  id: 'p1',
  name: 'P1',
  basin: 'Neuquen',
  block: 'A',
  playType: 'Structural',
  latitude: -38,
  longitude: -68,
  sourceScore: 0.7,
  migrationScore: 0.7,
  reservoirScore: 0.7,
  sealScore: 0.7,
  trapScore: 0.7,
  timingScore: 0.7,
  commercialScore: 70,
  resourceEstimate: 100,
  ...overrides,
});

const makeOutcome = (
  label: OutcomeLabel,
  source: ProspectOutcome['source'] = 'historical',
): ProspectOutcome => ({
  label,
  targetVariable: 'geological_success',
  resultConfidence: 'high',
  source,
});

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

// A trivial model: positive x → ~1, negative x → ~0
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
  classWeight: 'none',
  stoppedEarly: false,
  finalIteration: 1000,
  lossHistory: [],
};

const cvConfig: MLTrainingConfig = getDefaultMLTrainingConfig();

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

describe('calculateROCAUC', () => {
  it('returns 1.0 for a perfect separator', () => {
    const rows = [makeRow('a', 1, 1), makeRow('b', 1, 1), makeRow('c', 0, 0), makeRow('d', 0, 0)];
    const preds = [
      makePrediction('a', 0.95, 1),
      makePrediction('b', 0.90, 1),
      makePrediction('c', 0.10, 0),
      makePrediction('d', 0.05, 0),
    ];
    expect(calculateROCAUC(rows, preds)).toBeCloseTo(1.0, 5);
  });

  it('returns ~0.5 for a random classifier', () => {
    // All probabilities equal → AUC should be ~0.5
    const rows = [makeRow('a', 1, 1), makeRow('b', 0, 0), makeRow('c', 1, 1), makeRow('d', 0, 0)];
    const preds = [
      makePrediction('a', 0.5, 1),
      makePrediction('b', 0.5, 0),
      makePrediction('c', 0.5, 1),
      makePrediction('d', 0.5, 0),
    ];
    const auc = calculateROCAUC(rows, preds);
    expect(auc).toBeGreaterThanOrEqual(0.4);
    expect(auc).toBeLessThanOrEqual(0.6);
  });

  it('returns 0.5 when only one class present', () => {
    const rows = [makeRow('a', 1, 1), makeRow('b', 1, 1)];
    const preds = [makePrediction('a', 0.9, 1), makePrediction('b', 0.8, 1)];
    expect(calculateROCAUC(rows, preds)).toBe(0.5);
  });

  it('result is in [0, 1]', () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      makeRow(`p${i}`, i % 2 === 0 ? 1 : -1, (i % 3 === 0 ? 1 : 0) as 0 | 1),
    );
    const preds = rows.map((r) =>
      makePrediction(r.prospectId, r.features.x > 0 ? 0.7 : 0.3, r.features.x > 0 ? 1 : 0),
    );
    const auc = calculateROCAUC(rows, preds);
    expect(auc).toBeGreaterThanOrEqual(0);
    expect(auc).toBeLessThanOrEqual(1);
  });
});

describe('findOptimalThreshold', () => {
  it('returns a threshold in [0.05, 0.95]', () => {
    const rows = [makeRow('a', 1, 1), makeRow('b', -1, 0), makeRow('c', 1, 1), makeRow('d', -1, 0)];
    const preds = [
      makePrediction('a', 0.9, 1),
      makePrediction('b', 0.1, 0),
      makePrediction('c', 0.85, 1),
      makePrediction('d', 0.15, 0),
    ];
    const t = findOptimalThreshold(rows, preds);
    expect(t).toBeGreaterThanOrEqual(0.05);
    expect(t).toBeLessThanOrEqual(0.95);
  });

  it('falls back to 0.5 on empty input', () => {
    expect(findOptimalThreshold([], [])).toBe(0.5);
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

  it('includes rocAUC in metrics', () => {
    const testRows = [makeRow('a', 2, 1), makeRow('b', -2, 0)];
    const { metrics } = evaluateModel(trivialModel, testRows);
    expect(typeof metrics.rocAUC).toBe('number');
    expect(metrics.rocAUC).toBeGreaterThanOrEqual(0);
    expect(metrics.rocAUC).toBeLessThanOrEqual(1);
  });

  it('includes optimalThreshold in metrics', () => {
    const testRows = [makeRow('a', 2, 1), makeRow('b', -2, 0)];
    const { metrics } = evaluateModel(trivialModel, testRows);
    expect(typeof metrics.optimalThreshold).toBe('number');
    expect(metrics.optimalThreshold).toBeGreaterThanOrEqual(0.05);
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

  it('includes rocAUC in metrics', () => {
    const testRows = [makeRow('a', 2, 1), makeRow('b', -2, 0), makeRow('c', 1, 1), makeRow('d', -1, 0)];
    const { metrics } = evaluateModel(trivialModel, testRows);
    expect(typeof metrics.rocAUC).toBe('number');
    expect(metrics.rocAUC).toBeGreaterThanOrEqual(0);
    expect(metrics.rocAUC).toBeLessThanOrEqual(1);
  });

  it('includes optimalThreshold in metrics', () => {
    const testRows = [makeRow('a', 2, 1), makeRow('b', -2, 0), makeRow('c', 1, 1), makeRow('d', -1, 0)];
    const { metrics } = evaluateModel(trivialModel, testRows);
    expect(typeof metrics.optimalThreshold).toBe('number');
    expect(metrics.optimalThreshold).toBeGreaterThan(0);
    expect(metrics.optimalThreshold).toBeLessThan(1);
  });
});

describe('calculateROCAUC', () => {
  it('returns 1.0 for a perfect separator', () => {
    const rows = [makeRow('a', 1, 1), makeRow('b', 1, 1), makeRow('c', 0, 0), makeRow('d', 0, 0)];
    const preds = [
      makePrediction('a', 0.9, 1), makePrediction('b', 0.8, 1),
      makePrediction('c', 0.2, 0), makePrediction('d', 0.1, 0),
    ];
    expect(calculateROCAUC(rows, preds)).toBeCloseTo(1.0, 5);
  });

  it('returns ~0.5 for a random predictor', () => {
    const rows = [makeRow('a', 1, 1), makeRow('b', 0, 0), makeRow('c', 1, 1), makeRow('d', 0, 0)];
    const preds = [
      makePrediction('a', 0.5, 1), makePrediction('b', 0.5, 0),
      makePrediction('c', 0.5, 1), makePrediction('d', 0.5, 0),
    ];
    expect(calculateROCAUC(rows, preds)).toBeCloseTo(0.5, 1);
  });

  it('returns 0.5 when only one class is present', () => {
    const rows = [makeRow('a', 1, 1), makeRow('b', 1, 1)];
    const preds = [makePrediction('a', 0.9, 1), makePrediction('b', 0.7, 1)];
    expect(calculateROCAUC(rows, preds)).toBe(0.5);
  });

  it('result is always in [0, 1]', () => {
    const rows = [makeRow('a', 1, 1), makeRow('b', 0, 0), makeRow('c', 1, 1)];
    const preds = [makePrediction('a', 0.3, 0), makePrediction('b', 0.8, 1), makePrediction('c', 0.4, 0)];
    const auc = calculateROCAUC(rows, preds);
    expect(auc).toBeGreaterThanOrEqual(0);
    expect(auc).toBeLessThanOrEqual(1);
  });
});

describe('findOptimalThreshold', () => {
  it('returns 0.5 for empty inputs', () => {
    expect(findOptimalThreshold([], [])).toBe(0.5);
  });

  it('returns a threshold in [0.05, 0.95]', () => {
    const rows = [makeRow('a', 2, 1), makeRow('b', -2, 0), makeRow('c', 1, 1), makeRow('d', -1, 0)];
    const preds = [
      makePrediction('a', 0.95, 1), makePrediction('b', 0.05, 0),
      makePrediction('c', 0.8, 1), makePrediction('d', 0.2, 0),
    ];
    const t = findOptimalThreshold(rows, preds);
    expect(t).toBeGreaterThanOrEqual(0.05);
    expect(t).toBeLessThanOrEqual(0.95);
  });
});

describe('kFoldCrossValidate', () => {
  const makeBalancedRows = (n: number): MLTrainingRow[] =>
    Array.from({ length: n }, (_, i) => makeRow(`p${i}`, i % 2 === 0 ? 2 : -2, (i % 2) as 0 | 1));

  it('returns the requested fold count', () => {
    const rows = makeBalancedRows(20);
    const result = kFoldCrossValidate(rows, cvConfig, 4);
    expect(result.folds).toBe(4);
  });

  it('mean metrics are in valid ranges', () => {
    const rows = makeBalancedRows(20);
    const result = kFoldCrossValidate(rows, cvConfig, 5);
    expect(result.meanMetrics.accuracy).toBeGreaterThanOrEqual(0);
    expect(result.meanMetrics.accuracy).toBeLessThanOrEqual(1);
    expect(result.meanMetrics.rocAUC).toBeGreaterThanOrEqual(0);
    expect(result.meanMetrics.rocAUC).toBeLessThanOrEqual(1);
    expect(result.stdMetrics.f1).toBeGreaterThanOrEqual(0);
  });

  it('is deterministic for the same input', () => {
    const rows = makeBalancedRows(20);
    const a = kFoldCrossValidate(rows, cvConfig, 5);
    const b = kFoldCrossValidate(rows, cvConfig, 5);
    expect(a.meanMetrics.accuracy).toBe(b.meanMetrics.accuracy);
  });

  it('returns zero metrics for too-few rows', () => {
    const rows = makeBalancedRows(2);
    const result = kFoldCrossValidate(rows, cvConfig, 5);
    expect(result.folds).toBe(0);
    expect(result.meanMetrics.accuracy).toBe(0);
  });
});

describe('kFoldCrossValidate', () => {
  const makeBalancedRows = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      makeRow(`p${i}`, i % 2 === 0 ? 2 : -2, (i % 2) as 0 | 1),
    );

  it('returns the requested number of folds', () => {
    const rows = makeBalancedRows(40);
    const result = kFoldCrossValidate(rows, getDefaultMLTrainingConfig(), 5);
    expect(result.folds).toBe(5);
  });

  it('mean metrics are in valid range', () => {
    const rows = makeBalancedRows(40);
    const result = kFoldCrossValidate(rows, getDefaultMLTrainingConfig(), 4);
    expect(result.meanMetrics.accuracy).toBeGreaterThanOrEqual(0);
    expect(result.meanMetrics.accuracy).toBeLessThanOrEqual(1);
    expect(result.meanMetrics.rocAUC).toBeGreaterThanOrEqual(0);
    expect(result.meanMetrics.rocAUC).toBeLessThanOrEqual(1);
    expect(result.meanMetrics.f1).toBeGreaterThanOrEqual(0);
    expect(result.stdMetrics.accuracy).toBeGreaterThanOrEqual(0);
  });

  it('is deterministic (same seed)', () => {
    const rows = makeBalancedRows(40);
    const cfg = getDefaultMLTrainingConfig();
    const a = kFoldCrossValidate(rows, cfg, 5);
    const b = kFoldCrossValidate(rows, cfg, 5);
    expect(a.meanMetrics.accuracy).toBe(b.meanMetrics.accuracy);
  });

  it('handles fewer rows than folds gracefully', () => {
    const rows = makeBalancedRows(4);
    const result = kFoldCrossValidate(rows, getDefaultMLTrainingConfig(), 10);
    expect(result.folds).toBeGreaterThanOrEqual(0);
  });
});

const makeMultiFeatureRow = (id: string, features: Record<string, number>, label: 0 | 1): MLTrainingRow => ({
  prospectId: id,
  prospectName: id,
  features,
  label,
  target: 'geological_success',
  isSynthetic: false,
});

describe('computeFeatureCorrelations', () => {
  it('returns [] for fewer than 2 rows', () => {
    expect(computeFeatureCorrelations([])).toEqual([]);
    expect(computeFeatureCorrelations([makeMultiFeatureRow('a', { x: 1 }, 1)])).toEqual([]);
  });

  it('finds a perfect positive correlation between a feature and the label', () => {
    const rows = [
      makeMultiFeatureRow('a', { x: 0, y: 5 }, 0),
      makeMultiFeatureRow('b', { x: 1, y: 5 }, 1),
      makeMultiFeatureRow('c', { x: 0, y: 5 }, 0),
      makeMultiFeatureRow('d', { x: 1, y: 5 }, 1),
    ];
    const result = computeFeatureCorrelations(rows);
    const x = result.find((r) => r.feature === 'x')!;
    expect(x.correlation).toBeCloseTo(1, 5);
  });

  it('finds a perfect negative correlation', () => {
    const rows = [
      makeMultiFeatureRow('a', { x: 1 }, 0),
      makeMultiFeatureRow('b', { x: 0 }, 1),
      makeMultiFeatureRow('c', { x: 1 }, 0),
      makeMultiFeatureRow('d', { x: 0 }, 1),
    ];
    const result = computeFeatureCorrelations(rows);
    expect(result[0].correlation).toBeCloseTo(-1, 5);
  });

  it('returns 0 correlation for a zero-variance feature (avoids division by zero)', () => {
    const rows = [
      makeMultiFeatureRow('a', { constant: 5 }, 0),
      makeMultiFeatureRow('b', { constant: 5 }, 1),
      makeMultiFeatureRow('c', { constant: 5 }, 0),
    ];
    const result = computeFeatureCorrelations(rows);
    expect(result.find((r) => r.feature === 'constant')!.correlation).toBe(0);
  });

  it('sorts results by absolute correlation descending', () => {
    const rows = [
      makeMultiFeatureRow('a', { strong: 0, weak: 0.4 }, 0),
      makeMultiFeatureRow('b', { strong: 1, weak: 0.6 }, 1),
      makeMultiFeatureRow('c', { strong: 0, weak: 0.5 }, 0),
      makeMultiFeatureRow('d', { strong: 1, weak: 0.5 }, 1),
    ];
    const result = computeFeatureCorrelations(rows);
    expect(Math.abs(result[0].correlation)).toBeGreaterThanOrEqual(Math.abs(result[1].correlation));
    expect(result[0].feature).toBe('strong');
  });
});

describe('evaluateBaselineOnLabeledOutcomes', () => {
  it('returns zeroed metrics when no real labeled outcomes exist', () => {
    const prospects = [
      makeProspect({ id: 'p1' }), // no outcome
      makeProspect({ id: 'p2', outcome: makeOutcome('commercial_discovery', 'synthetic') }),
      makeProspect({ id: 'p3', outcome: makeOutcome('unknown') }),
    ];
    const { metrics, predictions } = evaluateBaselineOnLabeledOutcomes(prospects);
    expect(metrics.testSize).toBe(0);
    expect(metrics.accuracy).toBe(0);
    expect(metrics.brierScore).toBe(0);
    expect(predictions).toHaveLength(0);
  });

  it('excludes synthetic outcomes and only evaluates real labeled prospects', () => {
    const prospects = [
      makeProspect({ id: 'real-discovery', sourceScore: 0.9, migrationScore: 0.9, reservoirScore: 0.9, sealScore: 0.9, trapScore: 0.9, timingScore: 0.9, dataConfidence: 90, geologicalChanceOfSuccess: 0.8, outcome: makeOutcome('commercial_discovery', 'historical') }),
      makeProspect({ id: 'real-dry', sourceScore: 0.1, migrationScore: 0.1, reservoirScore: 0.1, sealScore: 0.1, trapScore: 0.1, timingScore: 0.1, dataConfidence: 10, geologicalChanceOfSuccess: 0.05, outcome: makeOutcome('dry_hole', 'historical') }),
      makeProspect({ id: 'synthetic', outcome: makeOutcome('commercial_discovery', 'synthetic') }),
    ];
    const { metrics, predictions } = evaluateBaselineOnLabeledOutcomes(prospects);
    expect(metrics.testSize).toBe(2);
    expect(predictions.map((p) => p.prospectId).sort()).toEqual(['real-discovery', 'real-dry']);
    expect(metrics.rocAUC).toBeGreaterThanOrEqual(0);
    expect(metrics.rocAUC).toBeLessThanOrEqual(1);
    predictions.forEach((p) => {
      expect(p.probability).toBeGreaterThanOrEqual(0);
      expect(p.probability).toBeLessThanOrEqual(1);
    });
  });

  it('correctly classifies a clearly-discriminating dataset', () => {
    const prospects = [
      makeProspect({ id: 'strong', sourceScore: 0.95, migrationScore: 0.95, reservoirScore: 0.95, sealScore: 0.95, trapScore: 0.95, timingScore: 0.95, dataConfidence: 95, geologicalChanceOfSuccess: 0.9, outcome: makeOutcome('commercial_discovery', 'historical') }),
      makeProspect({ id: 'weak', sourceScore: 0.05, migrationScore: 0.05, reservoirScore: 0.05, sealScore: 0.05, trapScore: 0.05, timingScore: 0.05, dataConfidence: 5, geologicalChanceOfSuccess: 0.02, outcome: makeOutcome('dry_hole', 'historical') }),
    ];
    const { metrics } = evaluateBaselineOnLabeledOutcomes(prospects);
    expect(metrics.confusionMatrix.truePositive + metrics.confusionMatrix.trueNegative).toBe(2);
  });
});
