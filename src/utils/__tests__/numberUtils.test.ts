import { describe, expect, it } from 'vitest';
import { safeNumber, safeGcos } from '../numberUtils';
import type { Prospect } from '../../domain/prospect';

const base: Prospect = {
  id: 'test1',
  name: 'Test Prospect',
  basin: 'Test Basin',
  block: 'A',
  playType: 'Structural',
  latitude: 0,
  longitude: 0,
  sourceScore: 0.7,
  migrationScore: 0.7,
  reservoirScore: 0.7,
  sealScore: 0.7,
  trapScore: 0.7,
  timingScore: 0.7,
  commercialScore: 75,
  resourceEstimate: 100,
  dataConfidence: 70,
  priority: 'high',
};

describe('safeNumber', () => {
  it('returns the value when it is finite', () => {
    expect(safeNumber(0.42)).toBe(0.42);
  });

  it('returns the fallback for undefined', () => {
    expect(safeNumber(undefined)).toBe(0);
  });

  it('returns the fallback for explicit NaN, unlike `?? 0`', () => {
    expect(safeNumber(NaN)).toBe(0);
    expect(NaN ?? 0).toBeNaN(); // demonstrates why `?? 0` alone is insufficient
  });

  it('supports a custom fallback', () => {
    expect(safeNumber(NaN, -1)).toBe(-1);
  });
});

describe('safeGcos', () => {
  it('returns the prospect GCoS when finite', () => {
    expect(safeGcos({ ...base, geologicalChanceOfSuccess: 0.25 })).toBe(0.25);
  });

  it('returns 0 for undefined GCoS', () => {
    expect(safeGcos({ ...base, geologicalChanceOfSuccess: undefined })).toBe(0);
  });

  it('returns 0 for explicit NaN GCoS', () => {
    expect(safeGcos({ ...base, geologicalChanceOfSuccess: NaN })).toBe(0);
  });

  it('clamps negative values to 0', () => {
    expect(safeGcos({ ...base, geologicalChanceOfSuccess: -0.1 })).toBe(0);
  });
});
