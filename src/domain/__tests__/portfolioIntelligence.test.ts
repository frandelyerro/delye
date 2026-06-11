import { describe, expect, it } from 'vitest';
import {
  getOutcomeCalibration,
  getBasinOutcomeStats,
  getPlayTypeOutcomeStats,
  getBasinStats,
  finiteGcos,
} from '../portfolioIntelligence';
import type { Prospect } from '../prospect';
import type { ProspectOutcome } from '../outcomes';

const baseProspect = (overrides: Partial<Prospect>): Prospect => ({
  id: 'p1',
  name: 'P1',
  basin: 'Basin A',
  block: 'B-1',
  playType: 'Shale',
  latitude: -38,
  longitude: -68,
  sourceScore: 0.8,
  migrationScore: 0.8,
  reservoirScore: 0.8,
  sealScore: 0.8,
  trapScore: 0.8,
  timingScore: 0.8,
  commercialScore: 70,
  resourceEstimate: 10,
  ...overrides,
});

const outcome = (label: ProspectOutcome['label']): ProspectOutcome => ({
  label,
  targetVariable: 'geological_success',
  resultConfidence: 'high',
  source: 'historical',
});

describe('finiteGcos', () => {
  it('returns geologicalChanceOfSuccess when finite', () => {
    expect(finiteGcos(baseProspect({ geologicalChanceOfSuccess: 0.42 }))).toBeCloseTo(0.42);
  });

  it('returns 0 for NaN geologicalChanceOfSuccess', () => {
    expect(finiteGcos(baseProspect({ geologicalChanceOfSuccess: NaN }))).toBe(0);
  });

  it('returns 0 for undefined geologicalChanceOfSuccess', () => {
    expect(finiteGcos(baseProspect({ geologicalChanceOfSuccess: undefined }))).toBe(0);
  });
});

describe('getBasinStats', () => {
  it('computes avgGCoS across a basin', () => {
    const prospects = [
      baseProspect({ id: 'a', basin: 'Basin A', geologicalChanceOfSuccess: 0.4 }),
      baseProspect({ id: 'b', basin: 'Basin A', geologicalChanceOfSuccess: 0.6 }),
    ];
    const stats = getBasinStats(prospects);
    expect(stats).toHaveLength(1);
    expect(stats[0].avgGCoS).toBe(50);
  });

  it('does not let a NaN geologicalChanceOfSuccess poison the basin average', () => {
    const prospects = [
      baseProspect({ id: 'a', basin: 'Basin A', geologicalChanceOfSuccess: 0.4 }),
      baseProspect({ id: 'b', basin: 'Basin A', geologicalChanceOfSuccess: NaN }),
    ];
    const stats = getBasinStats(prospects);
    expect(stats[0].avgGCoS).toBe(20);
    expect(Number.isFinite(stats[0].avgGCoS)).toBe(true);
  });
});

describe('getOutcomeCalibration', () => {
  it('returns 10 empty buckets for an empty portfolio', () => {
    const buckets = getOutcomeCalibration([]);
    expect(buckets).toHaveLength(10);
    expect(buckets.every((b) => b.drilled === 0 && b.actualSuccessRate === 0)).toBe(true);
    expect(buckets[0].expectedSuccessRate).toBe(5);
    expect(buckets[9].expectedSuccessRate).toBe(95);
  });

  it('places a drilled prospect in the bucket matching its pre-drill GCoS', () => {
    const prospects = [
      baseProspect({ id: 'a', geologicalChanceOfSuccess: 0.25, outcome: outcome('commercial_discovery') }),
      baseProspect({ id: 'b', geologicalChanceOfSuccess: 0.27, outcome: outcome('dry_hole') }),
    ];
    const buckets = getOutcomeCalibration(prospects);
    const bucket = buckets.find((b) => b.label === '20–30%')!;
    expect(bucket.drilled).toBe(2);
    expect(bucket.successes).toBe(1);
    expect(bucket.actualSuccessRate).toBe(50);
    expect(bucket.expectedSuccessRate).toBe(25);
  });

  it('ignores undrilled prospects and unknown-label outcomes', () => {
    const prospects = [
      baseProspect({ id: 'a', geologicalChanceOfSuccess: 0.15 }),
      baseProspect({ id: 'b', geologicalChanceOfSuccess: 0.15, outcome: outcome('unknown') }),
    ];
    const buckets = getOutcomeCalibration(prospects);
    expect(buckets.every((b) => b.drilled === 0)).toBe(true);
  });

  it('does not propagate NaN GCoS — lands in the first bucket', () => {
    const prospects = [
      baseProspect({ id: 'a', geologicalChanceOfSuccess: NaN, outcome: outcome('dry_hole') }),
    ];
    const buckets = getOutcomeCalibration(prospects);
    expect(buckets[0].drilled).toBe(1);
    expect(Number.isFinite(buckets[0].actualSuccessRate)).toBe(true);
  });

  it('counts technical discoveries as geological successes', () => {
    const prospects = [
      baseProspect({ id: 'a', geologicalChanceOfSuccess: 0.55, outcome: outcome('technical_discovery') }),
    ];
    const bucket = getOutcomeCalibration(prospects).find((b) => b.label === '50–60%')!;
    expect(bucket.successes).toBe(1);
    expect(bucket.actualSuccessRate).toBe(100);
  });
});

describe('getBasinOutcomeStats', () => {
  it('returns [] when no outcomes are recorded', () => {
    expect(getBasinOutcomeStats([baseProspect({})])).toEqual([]);
  });

  it('groups drilled prospects by basin with correct rates', () => {
    const prospects = [
      baseProspect({ id: 'a', basin: 'North', geologicalChanceOfSuccess: 0.3, outcome: outcome('commercial_discovery') }),
      baseProspect({ id: 'b', basin: 'North', geologicalChanceOfSuccess: 0.2, outcome: outcome('dry_hole') }),
      baseProspect({ id: 'c', basin: 'South', geologicalChanceOfSuccess: 0.4, outcome: outcome('technical_discovery') }),
      baseProspect({ id: 'd', basin: 'North', geologicalChanceOfSuccess: 0.1 }), // undrilled, excluded
    ];
    const stats = getBasinOutcomeStats(prospects);
    expect(stats).toHaveLength(2);
    const north = stats.find((s) => s.group === 'North')!;
    expect(north.drilled).toBe(2);
    expect(north.geologicalSuccesses).toBe(1);
    expect(north.commercialSuccesses).toBe(1);
    expect(north.geologicalSuccessRate).toBe(50);
    expect(north.commercialSuccessRate).toBe(50);
    expect(north.avgPredrillGcos).toBe(25);
    const south = stats.find((s) => s.group === 'South')!;
    expect(south.geologicalSuccessRate).toBe(100);
    expect(south.commercialSuccessRate).toBe(0);
  });

  it('sorts groups by drilled count descending', () => {
    const prospects = [
      baseProspect({ id: 'a', basin: 'Busy', outcome: outcome('dry_hole') }),
      baseProspect({ id: 'b', basin: 'Busy', outcome: outcome('dry_hole') }),
      baseProspect({ id: 'c', basin: 'Quiet', outcome: outcome('dry_hole') }),
    ];
    const stats = getBasinOutcomeStats(prospects);
    expect(stats[0].group).toBe('Busy');
  });
});

describe('getPlayTypeOutcomeStats', () => {
  it('groups drilled prospects by play type', () => {
    const prospects = [
      baseProspect({ id: 'a', playType: 'Carbonate', outcome: outcome('commercial_discovery') }),
      baseProspect({ id: 'b', playType: 'Shale', outcome: outcome('dry_hole') }),
    ];
    const stats = getPlayTypeOutcomeStats(prospects);
    expect(stats.map((s) => s.group).sort()).toEqual(['Carbonate', 'Shale']);
    expect(stats.find((s) => s.group === 'Carbonate')!.geologicalSuccessRate).toBe(100);
    expect(stats.find((s) => s.group === 'Shale')!.geologicalSuccessRate).toBe(0);
  });
});
