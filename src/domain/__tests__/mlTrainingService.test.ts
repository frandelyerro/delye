import { describe, expect, it } from 'vitest';
import type { Prospect } from '../prospect';
import type { ProspectOutcome, OutcomeLabel } from '../outcomes';
import {
  compareTrainedModelWithExpertGCoS,
  getDefaultMLTrainingConfig,
  predictPortfolioWithTrainedModel,
  trainBaselineMLModel,
} from '../mlTrainingService';

const makeOutcome = (label: OutcomeLabel): ProspectOutcome => ({
  label,
  targetVariable: 'geological_success',
  resultConfidence: 'high',
  source: 'historical',
});

// Builds a labeled prospect whose pre-drill scores correlate with the label
// so the baseline has a learnable signal.
const makeLabeled = (i: number, positive: boolean): Prospect => {
  const s = positive ? 0.8 : 0.3;
  return {
    id: `p${i}`,
    name: `P${i}`,
    basin: positive ? 'Neuquen' : 'North Sea',
    block: `B${i}`,
    playType: 'Structural',
    latitude: -38 + (i % 10) * 0.2,
    longitude: -68 + (i % 7) * 0.2,
    sourceScore: s,
    migrationScore: s,
    reservoirScore: s,
    sealScore: s,
    trapScore: s,
    timingScore: s,
    commercialScore: positive ? 80 : 30,
    resourceEstimate: 100,
    outcome: makeOutcome(positive ? 'commercial_discovery' : 'dry_hole'),
  };
};

const makePortfolio = (positives: number, negatives: number): Prospect[] => {
  const out: Prospect[] = [];
  for (let i = 0; i < positives; i++) out.push(makeLabeled(i, true));
  for (let i = 0; i < negatives; i++) out.push(makeLabeled(positives + i, false));
  return out;
};

describe('trainBaselineMLModel', () => {
  it('throws when there are insufficient labeled examples', () => {
    expect(() => trainBaselineMLModel(makePortfolio(3, 3))).toThrow(/insufficient/i);
  });

  it('trains on a valid mixed-label portfolio and returns a model + metrics', () => {
    const result = trainBaselineMLModel(makePortfolio(20, 20));
    expect(result.model.modelType).toBe('logistic_regression');
    expect(result.model.weights.length).toBeGreaterThan(0);
    expect(result.model.trainingExamples).toBeGreaterThan(0);
    expect(result.model.testExamples).toBeGreaterThan(0);
    expect(result.metrics.testSize).toBe(result.model.testExamples);
    expect(result.predictions.length).toBe(40);
  });

  it('includes prototype/non-decision safety warnings', () => {
    const result = trainBaselineMLModel(makePortfolio(20, 20));
    expect(result.warnings.some((w) => /prototype/i.test(w))).toBe(true);
    expect(result.warnings.some((w) => /not.*calibrated|investment|drilling/i.test(w))).toBe(true);
    expect(result.warnings.some((w) => /discovery guarantee/i.test(w))).toBe(true);
  });

  it('warns on class imbalance (too few of one class)', () => {
    const result = trainBaselineMLModel(makePortfolio(35, 5));
    expect(result.warnings.some((w) => /fewer than 10 negative/i.test(w))).toBe(true);
  });

  it('records trained-at metadata', () => {
    const result = trainBaselineMLModel(makePortfolio(20, 20));
    expect(result.model.trainedAt).toBeTruthy();
    expect(new Date(result.model.trainedAt).toString()).not.toBe('Invalid Date');
  });

  it('produces a deterministic model for the same portfolio', () => {
    const a = trainBaselineMLModel(makePortfolio(20, 20));
    const b = trainBaselineMLModel(makePortfolio(20, 20));
    expect(a.model.weights).toEqual(b.model.weights);
    expect(a.model.intercept).toBe(b.model.intercept);
  });
});

describe('predictPortfolioWithTrainedModel', () => {
  it('returns one prediction per prospect within (0, 1)', () => {
    const { model } = trainBaselineMLModel(makePortfolio(20, 20));
    const preds = predictPortfolioWithTrainedModel(model, makePortfolio(5, 5));
    expect(preds).toHaveLength(10);
    for (const p of preds) {
      expect(p.probability).toBeGreaterThan(0);
      expect(p.probability).toBeLessThan(1);
    }
  });
});

describe('compareTrainedModelWithExpertGCoS', () => {
  it('returns an agreement classification and ML probability', () => {
    const { model } = trainBaselineMLModel(makePortfolio(20, 20));
    const prospect = makeLabeled(999, true);
    const cmp = compareTrainedModelWithExpertGCoS(model, prospect);
    expect(['high', 'medium', 'low']).toContain(cmp.agreement);
    expect(cmp.mlProbability).toBeGreaterThan(0);
    expect(cmp.mlProbability).toBeLessThan(1);
    expect(cmp.interpretation.toLowerCase()).toMatch(/advisory|prototype|expert/);
  });
});

describe('getDefaultMLTrainingConfig', () => {
  it('uses the documented baseline defaults', () => {
    const c = getDefaultMLTrainingConfig();
    expect(c.target).toBe('geological_success');
    expect(c.featureMode).toBe('safe_pre_drill');
    expect(c.trainRatio).toBe(0.8);
    expect(c.minExamples).toBe(30);
    expect(c.excludeSynthetic).toBe(true);
  });
});
