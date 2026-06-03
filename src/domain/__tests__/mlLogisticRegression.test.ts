import { describe, expect, it } from 'vitest';
import type { MLTrainingConfig, MLTrainingRow } from '../mlTrainingTypes';
import { getDefaultMLTrainingConfig } from '../mlTrainingService';
import {
  normalizeFeatureMatrix,
  predictProbability,
  sigmoid,
  trainLogisticRegression,
} from '../mlLogisticRegression';

const config: MLTrainingConfig = getDefaultMLTrainingConfig();

// Linearly separable toy dataset on a single informative feature x.
const makeRows = (): MLTrainingRow[] =>
  Array.from({ length: 40 }, (_, i) => {
    const x = (i - 20) / 10; // -2.0 .. +1.9
    return {
      prospectId: `p${i}`,
      prospectName: `P${i}`,
      features: { x, noise: 0.0 },
      label: (x > 0 ? 1 : 0) as 0 | 1,
      target: 'geological_success' as const,
      isSynthetic: false,
    };
  });

describe('sigmoid', () => {
  it('returns 0.5 at 0 and saturates at the extremes', () => {
    expect(sigmoid(0)).toBeCloseTo(0.5, 10);
    expect(sigmoid(50)).toBeGreaterThan(0.999);
    expect(sigmoid(-50)).toBeLessThan(0.001);
  });

  it('is monotonically increasing', () => {
    expect(sigmoid(1)).toBeGreaterThan(sigmoid(0));
    expect(sigmoid(0)).toBeGreaterThan(sigmoid(-1));
  });

  it('does not overflow for large magnitudes', () => {
    expect(Number.isFinite(sigmoid(1000))).toBe(true);
    expect(Number.isFinite(sigmoid(-1000))).toBe(true);
  });
});

describe('normalizeFeatureMatrix', () => {
  it('handles zero standard deviation by using std = 1', () => {
    const rows: MLTrainingRow[] = [
      { prospectId: 'a', prospectName: 'a', features: { c: 5 }, label: 1, target: 'geological_success', isSynthetic: false },
      { prospectId: 'b', prospectName: 'b', features: { c: 5 }, label: 0, target: 'geological_success', isSynthetic: false },
    ];
    const { normalization, normalizedRows } = normalizeFeatureMatrix(rows);
    expect(normalization.c.std).toBe(1);
    // constant feature normalises to 0 (no NaN)
    expect(normalizedRows[0].features.c).toBe(0);
    expect(Number.isNaN(normalizedRows[1].features.c)).toBe(false);
  });

  it('produces a deterministic sorted feature-name list', () => {
    const rows: MLTrainingRow[] = [
      { prospectId: 'a', prospectName: 'a', features: { z: 1, a: 2, m: 3 }, label: 1, target: 'geological_success', isSynthetic: false },
    ];
    expect(normalizeFeatureMatrix(rows).featureNames).toEqual(['a', 'm', 'z']);
  });

  it('returns empty structures for empty input', () => {
    const { normalizedRows, featureNames } = normalizeFeatureMatrix([]);
    expect(normalizedRows).toHaveLength(0);
    expect(featureNames).toHaveLength(0);
  });
});

describe('trainLogisticRegression', () => {
  it('returns a model with weights and metadata', () => {
    const model = trainLogisticRegression(makeRows(), config);
    expect(model.modelType).toBe('logistic_regression');
    expect(model.featureNames.length).toBeGreaterThan(0);
    expect(model.weights).toHaveLength(model.featureNames.length);
    expect(Number.isFinite(model.intercept)).toBe(true);
    expect(model.trainingExamples).toBe(40);
  });

  it('learns the separable signal (higher x → higher probability)', () => {
    const model = trainLogisticRegression(makeRows(), config);
    const low = predictProbability(model, { x: -2, noise: 0 });
    const high = predictProbability(model, { x: 2, noise: 0 });
    expect(high).toBeGreaterThan(low);
  });

  it('keeps predicted probabilities within (0, 1)', () => {
    const model = trainLogisticRegression(makeRows(), config);
    for (const x of [-5, -1, 0, 1, 5]) {
      const p = predictProbability(model, { x, noise: 0 });
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
    }
  });

  it('is deterministic for the same data and config', () => {
    const a = trainLogisticRegression(makeRows(), config);
    const b = trainLogisticRegression(makeRows(), config);
    expect(a.weights).toEqual(b.weights);
    expect(a.intercept).toBe(b.intercept);
  });

  it('does not throw with a large L2 penalty and keeps weights finite', () => {
    const model = trainLogisticRegression(makeRows(), { ...config, l2Penalty: 10 });
    expect(model.weights.every((w) => Number.isFinite(w))).toBe(true);
  });
});
