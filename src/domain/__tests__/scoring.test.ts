import { describe, expect, it } from 'vitest';
import { Prospect } from '../prospect';
import { calculateGCoS, getMainRisk, getPriority, scoreProspects } from '../scoring';

const baseProspect: Prospect = {
  id: 't1',
  name: 'Test',
  basin: 'Test Basin',
  block: 'B1',
  playType: 'Test Play',
  latitude: 10,
  longitude: 10,
  sourceScore: 0.8,
  migrationScore: 0.9,
  reservoirScore: 0.7,
  sealScore: 0.6,
  trapScore: 0.8,
  timingScore: 0.9,
  commercialScore: 75,
  resourceEstimate: 100
};

describe('scoring engine', () => {
  it('calculateGCoS multiplies all geological components', () => {
    expect(calculateGCoS(baseProspect)).toBeCloseTo(0.217728);
  });

  it('getMainRisk returns weakest component', () => {
    expect(getMainRisk(baseProspect)).toBe('seal');
  });

  it('getPriority applies thresholds correctly', () => {
    expect(getPriority({ ...baseProspect, geologicalChanceOfSuccess: 0.4, commercialScore: 80 })).toBe('high');
    expect(getPriority({ ...baseProspect, geologicalChanceOfSuccess: 0.2, commercialScore: 60 })).toBe('medium');
    expect(getPriority({ ...baseProspect, geologicalChanceOfSuccess: 0.1, commercialScore: 90 })).toBe('low');
  });

  it('scoreProspects sorts descending by GCoS', () => {
    const a = { ...baseProspect, id: 'a', name: 'A', sourceScore: 0.9 };
    const b = { ...baseProspect, id: 'b', name: 'B', sourceScore: 0.4 };
    const ranked = scoreProspects([b, a]);
    expect(ranked[0].id).toBe('a');
    expect((ranked[0].geologicalChanceOfSuccess ?? 0) >= (ranked[1].geologicalChanceOfSuccess ?? 0)).toBe(true);
  });
});
