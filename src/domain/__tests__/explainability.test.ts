import { describe, expect, it } from 'vitest';
import { Prospect } from '../prospect';
import {
  calculateDataConfidence,
  getGCoSFormulaString,
  getGCoSInterpretation,
  getScoreBreakdown,
  getStrongestComponents,
  getWeakestComponent
} from '../explainability';
import { scoreProspect } from '../scoring';

const baseProspect: Prospect = {
  id: 't1',
  name: 'Test',
  basin: 'Test Basin',
  block: 'B1',
  playType: 'Test Play',
  latitude: 10,
  longitude: 10,
  sourceScore: 0.83,
  migrationScore: 0.79,
  reservoirScore: 0.74,
  sealScore: 0.67,
  trapScore: 0.72,
  timingScore: 0.8,
  commercialScore: 75,
  resourceEstimate: 100
};

describe('explainability helpers', () => {
  it('calculateDataConfidence reduces score for incomplete or inconsistent inputs', () => {
    const confidence = calculateDataConfidence({
      ...baseProspect,
      resourceEstimate: 0,
      commercialScore: 0,
      latitude: 0,
      sourceScore: 0.2,
      migrationScore: 0.24
    });
    expect(confidence).toBe(65);
  });

  it('getScoreBreakdown returns geological components and product', () => {
    const breakdown = getScoreBreakdown(baseProspect);
    expect(breakdown.components).toHaveLength(6);
    expect(breakdown.geologicalChanceOfSuccess).toBeCloseTo(0.18725533056);
  });

  it('getStrongestComponents returns the top two inputs', () => {
    expect(getStrongestComponents(baseProspect)).toEqual(['source', 'timing']);
  });

  it('getWeakestComponent returns the lowest input', () => {
    expect(getWeakestComponent(baseProspect)).toBe('seal');
  });

  it('getGCoSFormulaString formats the multiplication and result', () => {
    expect(getGCoSFormulaString(baseProspect)).toBe('0.83 Ã— 0.79 Ã— 0.74 Ã— 0.67 Ã— 0.72 Ã— 0.80 = 18.7%');
  });

  it('getGCoSInterpretation explains strengths and uncertainty', () => {
    expect(getGCoSInterpretation(baseProspect)).toContain('favorable timing');
    expect(getGCoSInterpretation(baseProspect)).toContain('seal continuity is the main uncertainty');
  });

  it('scoreProspect includes dataConfidence', () => {
    expect(scoreProspect(baseProspect).dataConfidence).toBe(100);
  });
});
