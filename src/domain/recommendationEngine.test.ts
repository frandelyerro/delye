import { describe, expect, it } from 'vitest';
import type { Prospect } from './prospect';
import {
  getProspectivityTier,
  getRecommendedAction,
  getRecommendedActionLabel,
  getTierLabel,
  getTierRationale,
  getNextBestStep,
  getRiskFlags,
  getTargetingRecommendation,
  getPortfolioRecommendations,
} from './recommendationEngine';

// ---- Shared fixtures ----

const base: Prospect = {
  id: 'test-1', name: 'Test Prospect', basin: 'Test Basin', block: 'TB-01',
  playType: 'Structural', latitude: 0, longitude: 0,
  sourceScore: 0.80, migrationScore: 0.75, reservoirScore: 0.78,
  sealScore: 0.72, trapScore: 0.76, timingScore: 0.80,
  commercialScore: 75, resourceEstimate: 120,
  geologicalChanceOfSuccess: 0.80 * 0.75 * 0.78 * 0.72 * 0.76 * 0.80,
  dataConfidence: 90, priority: 'high', mainRisk: 'seal',
};

const highGCoSHighDC: Prospect = {
  ...base,
  geologicalChanceOfSuccess: 0.42,
  dataConfidence: 85,
  commercialScore: 78,
  sourceScore: 0.90, migrationScore: 0.88, reservoirScore: 0.86,
  sealScore: 0.82, trapScore: 0.84, timingScore: 0.85,
  mainRisk: 'seal',
};

const highGCoSLowDC: Prospect = {
  ...base,
  geologicalChanceOfSuccess: 0.40,
  dataConfidence: 35,
  commercialScore: 72,
  mainRisk: 'trap',
};

const mediumGCoS: Prospect = {
  ...base,
  geologicalChanceOfSuccess: 0.22,
  dataConfidence: 65,
  commercialScore: 68,
  mainRisk: 'reservoir',
};

const lowGCoS: Prospect = {
  ...base,
  id: 'low1', name: 'Low GCoS',
  geologicalChanceOfSuccess: 0.04,
  dataConfidence: 45,
  commercialScore: 40,
  resourceEstimate: 20,
  mainRisk: 'trap',
  sealScore: 0.30, trapScore: 0.28,
};

const sealRiskProspect: Prospect = {
  ...base,
  geologicalChanceOfSuccess: 0.20,
  dataConfidence: 60,
  commercialScore: 65,
  mainRisk: 'seal',
  sealScore: 0.38,
};

const reservoirRiskProspect: Prospect = {
  ...base,
  geologicalChanceOfSuccess: 0.19,
  dataConfidence: 58,
  commercialScore: 62,
  mainRisk: 'reservoir',
  reservoirScore: 0.35,
};

const timingRiskProspect: Prospect = {
  ...base,
  geologicalChanceOfSuccess: 0.21,
  dataConfidence: 55,
  commercialScore: 60,
  mainRisk: 'timing',
  timingScore: 0.36,
};

const largeResourceTier1: Prospect = {
  ...highGCoSHighDC,
  resourceEstimate: 250,
  commercialScore: 85,
  geologicalChanceOfSuccess: 0.38,
};

// ---- getProspectivityTier ----

describe('getProspectivityTier', () => {
  it('classifies tier_1 when all gates met', () => {
    expect(getProspectivityTier(highGCoSHighDC)).toBe('tier_1');
  });

  it('tier_1 requires dataConfidence >= 70', () => {
    const p = { ...highGCoSHighDC, dataConfidence: 69 };
    expect(getProspectivityTier(p)).not.toBe('tier_1');
  });

  it('tier_1 requires no component score below 0.40', () => {
    const p = { ...highGCoSHighDC, sealScore: 0.39 };
    expect(getProspectivityTier(p)).not.toBe('tier_1');
  });

  it('tier_1 requires commercialScore >= 70', () => {
    const p = { ...highGCoSHighDC, commercialScore: 69 };
    expect(getProspectivityTier(p)).not.toBe('tier_1');
  });

  it('classifies tier_2 when GCoS >= 0.18 and dc >= 50', () => {
    expect(getProspectivityTier(mediumGCoS)).toBe('tier_2');
  });

  it('tier_2 not granted when dc < 50', () => {
    const p = { ...mediumGCoS, dataConfidence: 49 };
    expect(getProspectivityTier(p)).not.toBe('tier_2');
  });

  it('classifies tier_3 when GCoS >= 0.10', () => {
    const p = { ...base, geologicalChanceOfSuccess: 0.12, dataConfidence: 35, commercialScore: 50 };
    expect(getProspectivityTier(p)).toBe('tier_3');
  });

  it('classifies tier_3 for high resource even with low GCoS', () => {
    const p = { ...base, geologicalChanceOfSuccess: 0.07, resourceEstimate: 120, dataConfidence: 30, commercialScore: 45 };
    expect(getProspectivityTier(p)).toBe('tier_3');
  });

  it('classifies tier_4 when GCoS < 0.10 and low resource', () => {
    expect(getProspectivityTier(lowGCoS)).toBe('tier_4');
  });
});

// ---- getRecommendedAction ----

describe('getRecommendedAction', () => {
  it('tier_1 high GCoS + high dataConfidence → drill_candidate', () => {
    expect(getRecommendedAction(highGCoSHighDC)).toBe('drill_candidate');
  });

  it('HIGH GCoS + LOW dataConfidence → NEVER drill_candidate (hard rule)', () => {
    const action = getRecommendedAction(highGCoSLowDC);
    expect(action).not.toBe('drill_candidate');
  });

  it('high GCoS + low dc → acquire_additional_seismic', () => {
    expect(getRecommendedAction(highGCoSLowDC)).toBe('acquire_additional_seismic');
  });

  it('mainRisk seal → validate_seal_continuity', () => {
    expect(getRecommendedAction(sealRiskProspect)).toBe('validate_seal_continuity');
  });

  it('mainRisk reservoir → validate_reservoir_quality', () => {
    expect(getRecommendedAction(reservoirRiskProspect)).toBe('validate_reservoir_quality');
  });

  it('mainRisk timing → improve_timing_model', () => {
    expect(getRecommendedAction(timingRiskProspect)).toBe('improve_timing_model');
  });

  it('mainRisk trap → acquire_additional_seismic', () => {
    const p = { ...mediumGCoS, mainRisk: 'trap' as const };
    expect(getRecommendedAction(p)).toBe('acquire_additional_seismic');
  });

  it('very low GCoS → do_not_prioritize', () => {
    expect(getRecommendedAction(lowGCoS)).toBe('do_not_prioritize');
  });

  it('very low commercialScore → do_not_prioritize', () => {
    const p = { ...base, geologicalChanceOfSuccess: 0.25, commercialScore: 20, dataConfidence: 80 };
    expect(getRecommendedAction(p)).toBe('do_not_prioritize');
  });

  it('large resource tier_1 → appraisal_candidate', () => {
    expect(getRecommendedAction(largeResourceTier1)).toBe('appraisal_candidate');
  });

  it('high resource + medium GCoS → farm_in_candidate or acreage_review', () => {
    const p = {
      ...base, geologicalChanceOfSuccess: 0.20, resourceEstimate: 180,
      commercialScore: 65, dataConfidence: 60, mainRisk: 'source' as const,
    };
    const action = getRecommendedAction(p);
    expect(['farm_in_candidate', 'acreage_review']).toContain(action);
  });

  it('medium GCoS + sparse evidence → watchlist', () => {
    const p = {
      ...base, geologicalChanceOfSuccess: 0.11, resourceEstimate: 40,
      commercialScore: 55, dataConfidence: 55, mainRisk: 'source' as const,
    };
    expect(getRecommendedAction(p)).toBe('watchlist');
  });
});

// ---- Labels ----

describe('label helpers', () => {
  it('getRecommendedActionLabel returns human-readable label', () => {
    expect(getRecommendedActionLabel('drill_candidate')).toBe('Drill Candidate');
    expect(getRecommendedActionLabel('validate_seal_continuity')).toBe('Validate Seal Continuity');
    expect(getRecommendedActionLabel('do_not_prioritize')).toBe('Do Not Prioritize');
  });

  it('getTierLabel returns full tier description', () => {
    expect(getTierLabel('tier_1')).toContain('Tier 1');
    expect(getTierLabel('tier_4')).toContain('Tier 4');
  });
});

// ---- getRiskFlags ----

describe('getRiskFlags', () => {
  it('flags high GCoS + low dc combination', () => {
    const flags = getRiskFlags(highGCoSLowDC);
    expect(flags.some((f) => f.includes('low data confidence'))).toBe(true);
  });

  it('flags critical seal score below 0.40', () => {
    const p = { ...base, sealScore: 0.35 };
    const flags = getRiskFlags(p);
    expect(flags.some((f) => f.includes('seal risk'))).toBe(true);
  });

  it('flags manual scoring', () => {
    const flags = getRiskFlags({ ...base, scoringMode: 'manual' });
    expect(flags.some((f) => f.includes('Manual scoring'))).toBe(true);
  });

  it('no dc flag when confidence is good', () => {
    const flags = getRiskFlags(highGCoSHighDC);
    expect(flags.some((f) => f.includes('Low data confidence'))).toBe(false);
  });
});

// ---- getTargetingRecommendation ----

describe('getTargetingRecommendation', () => {
  it('returns all required fields', () => {
    const rec = getTargetingRecommendation(highGCoSHighDC);
    expect(rec).toHaveProperty('prospectId');
    expect(rec).toHaveProperty('tier');
    expect(rec).toHaveProperty('action');
    expect(rec).toHaveProperty('rationale');
    expect(rec).toHaveProperty('nextBestStep');
    expect(rec).toHaveProperty('riskFlags');
  });

  it('drill candidate has appropriate next step text', () => {
    const rec = getTargetingRecommendation(highGCoSHighDC);
    expect(rec.nextBestStep.toLowerCase()).toContain('well planning');
  });
});

// ---- getPortfolioRecommendations ----

describe('getPortfolioRecommendations', () => {
  it('returns one recommendation per prospect sorted by GCoS descending', () => {
    const prospects = [lowGCoS, highGCoSHighDC, mediumGCoS];
    const recs = getPortfolioRecommendations(prospects);
    expect(recs).toHaveLength(3);
    const gcos = recs.map((r) => prospects.find((p) => p.id === r.prospectId)?.geologicalChanceOfSuccess ?? 0);
    expect(gcos[0]).toBeGreaterThanOrEqual(gcos[1]);
    expect(gcos[1]).toBeGreaterThanOrEqual(gcos[2]);
  });

  it('empty portfolio returns empty array', () => {
    expect(getPortfolioRecommendations([])).toHaveLength(0);
  });
});
