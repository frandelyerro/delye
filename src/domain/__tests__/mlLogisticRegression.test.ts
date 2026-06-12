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

// Deterministic PRNG (mulberry32) so the realistic dataset below is stable.
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Realistic imbalanced dataset: 15 discoveries vs 30 dry holes with heavily
// overlapping petroleum-system component scores plus deterministic label
// flips, so the classes are NOT linearly separable (loss cannot reach ~0).
const makeImbalancedRows = (): MLTrainingRow[] => {
  const rng = mulberry32(12345);
  const rows: MLTrainingRow[] = [];
  for (let i = 0; i < 45; i++) {
    const positive = i < 15;
    const base = positive ? 0.4 : 0.3;
    rows.push({
      prospectId: `r${i}`,
      prospectName: `R${i}`,
      features: {
        sourceScore: base + rng() * 0.5,
        migrationScore: base + rng() * 0.5,
        reservoirScore: base + rng() * 0.5,
        sealScore: base + rng() * 0.5,
        trapScore: base + rng() * 0.5,
        timingScore: base + rng() * 0.5,
        dataConfidence: 30 + rng() * 60,
      },
      label: (positive ? 1 : 0) as 0 | 1,
      target: 'geological_success' as const,
      isSynthetic: false,
    });
  }
  for (const idx of [2, 7, 20, 28, 39]) rows[idx].label = rows[idx].label === 1 ? 0 : 1;
  return rows;
};

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

  it('records loss history sampled every 50 iterations', () => {
    const model = trainLogisticRegression(makeRows(), { ...config, iterations: 200 });
    // 200 iterations / 50 = 4 samples (plus possibly 1 at last iter if not on boundary)
    expect(model.lossHistory.length).toBeGreaterThan(0);
    expect(model.lossHistory.every((l) => Number.isFinite(l) && l >= 0)).toBe(true);
  });

  it('balanced class weighting produces a model with finite weights', () => {
    const model = trainLogisticRegression(makeRows(), { ...config, classWeight: 'balanced' });
    expect(model.classWeight).toBe('balanced');
    expect(model.weights.every((w) => Number.isFinite(w))).toBe(true);
  });

  it('early stopping triggers on a convergent dataset', () => {
    // Very easy dataset — the model should converge well before 5000 iterations
    const model = trainLogisticRegression(makeRows(), {
      ...config,
      iterations: 5000,
      patience: 3,
      convergenceTol: 0.001,
    });
    expect(model.stoppedEarly).toBe(true);
    expect(model.finalIteration).toBeLessThan(5000);
  });

  it('stoppedEarly is false when iterations complete normally', () => {
    // Single iteration — no chance to converge
    const model = trainLogisticRegression(makeRows(), { ...config, iterations: 1 });
    expect(model.stoppedEarly).toBe(false);
    expect(model.finalIteration).toBe(1);
  });

  it('momentum=0 reproduces plain gradient descent exactly', () => {
    const plain = trainLogisticRegression(makeRows(), { ...config, momentum: undefined, iterations: 200, patience: 1000 });
    const explicitZero = trainLogisticRegression(makeRows(), { ...config, momentum: 0, iterations: 200, patience: 1000 });
    expect(explicitZero.weights).toEqual(plain.weights);
    expect(explicitZero.intercept).toBe(plain.intercept);
  });

  it('momentum produces finite weights and is deterministic', () => {
    const a = trainLogisticRegression(makeRows(), { ...config, momentum: 0.9, iterations: 200 });
    const b = trainLogisticRegression(makeRows(), { ...config, momentum: 0.9, iterations: 200 });
    expect(a.weights.every((w) => Number.isFinite(w))).toBe(true);
    expect(a.weights).toEqual(b.weights);
    expect(a.intercept).toBe(b.intercept);
  });

  it('momentum converges to at least as low a final loss as plain gradient descent on a fixed iteration budget', () => {
    const plain = trainLogisticRegression(makeRows(), { ...config, momentum: 0, iterations: 150, patience: 1000 });
    const withMomentum = trainLogisticRegression(makeRows(), { ...config, momentum: 0.9, iterations: 150, patience: 1000 });
    const plainFinalLoss = plain.lossHistory[plain.lossHistory.length - 1];
    const momentumFinalLoss = withMomentum.lossHistory[withMomentum.lossHistory.length - 1];
    expect(momentumFinalLoss).toBeLessThanOrEqual(plainFinalLoss + 1e-6);
  });

  it('early stopping returns the best-observed weights, not the degraded final ones', () => {
    // High learning rate + momentum forces loss oscillation, so the patience
    // window expires with weights worse than the best snapshot.
    const rows = makeImbalancedRows();
    const model = trainLogisticRegression(rows, {
      ...config,
      momentum: 0.9,
      learningRate: 20,
      l2Penalty: 0,
      iterations: 5000,
      patience: 3,
      convergenceTol: 1e-6,
    });
    expect(model.stoppedEarly).toBe(true);

    // Recompute the cross-entropy loss of the *returned* weights manually
    // (l2Penalty is 0, so the manual loss matches the training loss formula).
    const eps = 1e-6;
    const manualLoss =
      rows.reduce((acc, r) => {
        const p = Math.max(eps, Math.min(1 - eps, predictProbability(model, r.features)));
        return acc + (r.label === 1 ? -Math.log(p) : -Math.log(1 - p));
      }, 0) / rows.length;

    const bestObserved = Math.min(...model.lossHistory);
    const lastSampled = model.lossHistory[model.lossHistory.length - 1];
    // Guard: the scenario must actually degrade after its best sample,
    // otherwise this test would not exercise the restoration path.
    expect(lastSampled).toBeGreaterThan(bestObserved + 0.1);
    // The returned model must match the best loss seen, not the final sample.
    expect(manualLoss).toBeLessThanOrEqual(bestObserved + 1e-4);
    expect(manualLoss).toBeLessThan(lastSampled);
  });

  it('momentum=0.9 matches or beats plain gradient descent on realistic imbalanced data with early stopping', () => {
    const rows = makeImbalancedRows();
    const opts = { ...config, classWeight: 'balanced' as const, iterations: 2000, patience: 10 };
    const plain = trainLogisticRegression(rows, { ...opts, momentum: 0 });
    const withMomentum = trainLogisticRegression(rows, { ...opts, momentum: 0.9 });

    expect(plain.weights.every((w) => Number.isFinite(w))).toBe(true);
    expect(withMomentum.weights.every((w) => Number.isFinite(w))).toBe(true);

    const plainBest = Math.min(...plain.lossHistory);
    const momentumBest = Math.min(...withMomentum.lossHistory);
    expect(momentumBest).toBeLessThanOrEqual(plainBest + 0.005);
  });
});
