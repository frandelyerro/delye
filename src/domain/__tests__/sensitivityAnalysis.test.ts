import { describe, expect, it } from 'vitest';
import { computeSensitivityDeltas } from '../sensitivityAnalysis';
import type { Prospect } from '../prospect';

const baseProspect: Prospect = {
  id: 'p1', name: 'Test', basin: 'Gulf', block: 'A1', playType: 'Conventional Clastic',
  latitude: 25, longitude: -90,
  sourceScore: 0.7, migrationScore: 0.8, reservoirScore: 0.6, sealScore: 0.7, trapScore: 0.9, timingScore: 0.8,
  commercialScore: 60, resourceEstimate: 100,
};

describe('computeSensitivityDeltas', () => {
  it('returns one factor entry per geological component', () => {
    const result = computeSensitivityDeltas(baseProspect);
    expect(result.factors).toHaveLength(6);
  });

  it('baseline matches product of all 6 scores', () => {
    const result = computeSensitivityDeltas(baseProspect);
    const expected = 0.7 * 0.8 * 0.6 * 0.7 * 0.9 * 0.8;
    expect(result.baselineGCoS).toBeCloseTo(expected, 8);
  });

  it('upside delta is positive and downside delta is negative', () => {
    const result = computeSensitivityDeltas(baseProspect);
    for (const f of result.factors) {
      expect(f.upsideDelta).toBeGreaterThanOrEqual(0);
      expect(f.downsideDelta).toBeLessThanOrEqual(0);
    }
  });

  it('factors are sorted by absMaxDelta descending', () => {
    const result = computeSensitivityDeltas(baseProspect);
    for (let i = 0; i < result.factors.length - 1; i++) {
      expect(result.factors[i].absMaxDelta).toBeGreaterThanOrEqual(result.factors[i + 1].absMaxDelta);
    }
  });

  it('handles zero score component without NaN', () => {
    const p: Prospect = { ...baseProspect, sourceScore: 0 };
    const result = computeSensitivityDeltas(p);
    expect(result.baselineGCoS).toBe(0);
    for (const f of result.factors) {
      expect(Number.isFinite(f.upsideDelta)).toBe(true);
      expect(Number.isFinite(f.downsideDelta)).toBe(true);
    }
  });

  it('downside delta for a score of 0 is 0 (cannot go lower)', () => {
    const p: Prospect = { ...baseProspect, reservoirScore: 0 };
    const result = computeSensitivityDeltas(p);
    const reservoir = result.factors.find((f) => f.factor === 'reservoir');
    expect(reservoir?.downsideDelta).toBe(0);
  });

  it('upside delta for a score of 1 is 0 (already at maximum)', () => {
    const p: Prospect = { ...baseProspect, trapScore: 1 };
    const result = computeSensitivityDeltas(p);
    const trap = result.factors.find((f) => f.factor === 'trap');
    expect(trap?.upsideDelta).toBeCloseTo(0, 8);
  });
});
