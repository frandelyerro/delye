import { describe, expect, it } from 'vitest';
import type { Prospect } from './prospect';
import {
  getPortfolioSummary,
  getPortfolioMainRisk,
  getTopDrillCandidates,
  getUncertaintyReductionCandidates,
  getFarmInCandidates,
  getHighGCoSLowConfidenceProspects,
} from './portfolioIntelligence';

const mkProspect = (overrides: Partial<Prospect>): Prospect => ({
  id: 'p0', name: 'Base', basin: 'Basin', block: 'B-01', playType: 'Structural',
  latitude: 0, longitude: 0,
  sourceScore: 0.80, migrationScore: 0.78, reservoirScore: 0.76,
  sealScore: 0.74, trapScore: 0.77, timingScore: 0.80,
  commercialScore: 75, resourceEstimate: 100,
  geologicalChanceOfSuccess: 0.22,
  dataConfidence: 75, priority: 'medium', mainRisk: 'seal',
  ...overrides,
});

const tier1Prospect = mkProspect({
  id: 't1', name: 'Tier 1',
  geologicalChanceOfSuccess: 0.42, dataConfidence: 85,
  commercialScore: 80,
  sourceScore: 0.88, migrationScore: 0.85, reservoirScore: 0.84,
  sealScore: 0.82, trapScore: 0.83, timingScore: 0.86,
  mainRisk: 'seal', priority: 'high',
});

const tier2Prospect = mkProspect({
  id: 't2', name: 'Tier 2',
  geologicalChanceOfSuccess: 0.22, dataConfidence: 60,
  commercialScore: 68, mainRisk: 'reservoir',
  reservoirScore: 0.35, priority: 'medium',
});

const tier3Prospect = mkProspect({
  id: 't3', name: 'Tier 3',
  geologicalChanceOfSuccess: 0.12, dataConfidence: 35,
  commercialScore: 50, mainRisk: 'trap', priority: 'low',
});

const tier4Prospect = mkProspect({
  id: 't4', name: 'Tier 4',
  geologicalChanceOfSuccess: 0.04, dataConfidence: 25,
  commercialScore: 28, mainRisk: 'source', priority: 'low',
  sourceScore: 0.20, trapScore: 0.22,
});

const highGCoSLowDC = mkProspect({
  id: 'hg', name: 'High GCoS Low DC',
  geologicalChanceOfSuccess: 0.38, dataConfidence: 30,
  commercialScore: 70, mainRisk: 'trap',
});

const farmInProspect = mkProspect({
  id: 'fi', name: 'Farm-in',
  geologicalChanceOfSuccess: 0.20, dataConfidence: 60,
  resourceEstimate: 200, commercialScore: 65,
  mainRisk: 'source',
});

const samplePortfolio = [tier1Prospect, tier2Prospect, tier3Prospect, tier4Prospect, highGCoSLowDC];

// ---- getPortfolioMainRisk ----

describe('getPortfolioMainRisk', () => {
  it('returns most frequent mainRisk', () => {
    const prospects = [
      mkProspect({ id: 'a', mainRisk: 'seal' }),
      mkProspect({ id: 'b', mainRisk: 'seal' }),
      mkProspect({ id: 'c', mainRisk: 'trap' }),
    ];
    expect(getPortfolioMainRisk(prospects)).toBe('seal');
  });

  it('returns "unknown" for empty portfolio', () => {
    expect(getPortfolioMainRisk([])).toBe('unknown');
  });
});

// ---- getTopDrillCandidates ----

describe('getTopDrillCandidates', () => {
  it('tier_1 prospect appears in drill candidates', () => {
    const candidates = getTopDrillCandidates([tier1Prospect]);
    expect(candidates.map((p) => p.id)).toContain('t1');
  });

  it('high GCoS + low dc prospect NOT in drill candidates', () => {
    const candidates = getTopDrillCandidates([highGCoSLowDC]);
    expect(candidates.map((p) => p.id)).not.toContain('hg');
  });

  it('low GCoS prospect NOT in drill candidates', () => {
    const candidates = getTopDrillCandidates([tier4Prospect]);
    expect(candidates.map((p) => p.id)).not.toContain('t4');
  });
});

// ---- getUncertaintyReductionCandidates ----

describe('getUncertaintyReductionCandidates', () => {
  it('returns prospects flagged for uncertainty reduction', () => {
    const candidates = getUncertaintyReductionCandidates([tier2Prospect, tier3Prospect, tier4Prospect]);
    expect(candidates.length).toBeGreaterThan(0);
  });

  it('does not include drill candidates', () => {
    const candidates = getUncertaintyReductionCandidates([tier1Prospect]);
    expect(candidates.map((p) => p.id)).not.toContain('t1');
  });
});

// ---- getFarmInCandidates ----

describe('getFarmInCandidates', () => {
  it('high resource medium GCoS → farm-in candidate', () => {
    const candidates = getFarmInCandidates([farmInProspect]);
    expect(candidates.length).toBeGreaterThan(0);
  });

  it('sorted by resourceEstimate descending', () => {
    const p2 = { ...farmInProspect, id: 'fi2', resourceEstimate: 300 };
    const candidates = getFarmInCandidates([farmInProspect, p2]);
    expect(candidates[0].resourceEstimate).toBeGreaterThanOrEqual(candidates[candidates.length - 1].resourceEstimate);
  });
});

// ---- getHighGCoSLowConfidenceProspects ----

describe('getHighGCoSLowConfidenceProspects', () => {
  it('flags prospect with GCoS >= 0.25 and dc < 60', () => {
    const flagged = getHighGCoSLowConfidenceProspects([highGCoSLowDC]);
    expect(flagged.map((p) => p.id)).toContain('hg');
  });

  it('does not flag prospect with good data confidence', () => {
    const flagged = getHighGCoSLowConfidenceProspects([tier1Prospect]);
    expect(flagged.map((p) => p.id)).not.toContain('t1');
  });
});

// ---- getPortfolioSummary ----

describe('getPortfolioSummary', () => {
  it('empty portfolio returns zeroed summary', () => {
    const s = getPortfolioSummary([]);
    expect(s.totalProspects).toBe(0);
    expect(s.drillCandidateCount).toBe(0);
    expect(s.keyRecommendations).toHaveLength(0);
  });

  it('counts correct totals', () => {
    const s = getPortfolioSummary(samplePortfolio);
    expect(s.totalProspects).toBe(samplePortfolio.length);
    expect(s.tier1Count + s.tier2Count + s.tier3Count + s.tier4Count).toBe(samplePortfolio.length);
  });

  it('tier_1 prospect contributes to drillCandidateCount', () => {
    const s = getPortfolioSummary([tier1Prospect]);
    expect(s.drillCandidateCount).toBe(1);
    expect(s.tier1Count).toBe(1);
  });

  it('averageDataConfidence is computed correctly', () => {
    const prospects = [
      mkProspect({ id: 'a', dataConfidence: 80 }),
      mkProspect({ id: 'b', dataConfidence: 40 }),
    ];
    const s = getPortfolioSummary(prospects);
    expect(s.averageDataConfidence).toBe(60);
  });

  it('topProspects lists up to 3 highest-GCoS names', () => {
    const s = getPortfolioSummary(samplePortfolio);
    expect(s.topProspects.length).toBeLessThanOrEqual(3);
  });

  it('keyRecommendations is non-empty for a non-trivial portfolio', () => {
    const s = getPortfolioSummary(samplePortfolio);
    expect(s.keyRecommendations.length).toBeGreaterThan(0);
  });

  it('main portfolio risk is identified', () => {
    const s = getPortfolioSummary(samplePortfolio);
    expect(typeof s.portfolioMainRisk).toBe('string');
    expect(s.portfolioMainRisk.length).toBeGreaterThan(0);
  });
});
