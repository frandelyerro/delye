import { describe, expect, it } from 'vitest';
import {
  assessMigration,
  assessPetroleumSystem,
  assessReservoir,
  assessSeal,
  assessSource,
  assessTiming,
  assessTrap,
  clamp01,
  deriveScoresFromEvidence,
} from './geoscienceEngine';
import { scoreProspect, scoreProspects } from './scoring';
import { getAdvisorResponse } from './advisor';
import type { Prospect } from './prospect';

// ────────── helpers ──────────

const baseManualProspect: Prospect = {
  id: 'test-m1',
  name: 'Manual Prospect',
  basin: 'Test',
  block: 'T1',
  playType: 'Structural',
  latitude: 10,
  longitude: 10,
  sourceScore: 0.8,
  migrationScore: 0.75,
  reservoirScore: 0.7,
  sealScore: 0.65,
  trapScore: 0.72,
  timingScore: 0.78,
  commercialScore: 75,
  resourceEstimate: 100,
};

const baseEvidenceProspect: Prospect = {
  id: 'test-e1',
  name: 'Evidence Prospect',
  basin: 'Test',
  block: 'E1',
  playType: 'Structural',
  latitude: 10,
  longitude: 10,
  sourceScore: 0.5,
  migrationScore: 0.5,
  reservoirScore: 0.5,
  sealScore: 0.5,
  trapScore: 0.5,
  timingScore: 0.5,
  commercialScore: 75,
  resourceEstimate: 100,
  scoringMode: 'evidence_derived',
  targetPhase: 'oil',
};

// ────────── clamp01 ──────────

describe('clamp01', () => {
  it('clamps above 1', () => expect(clamp01(1.5)).toBe(1));
  it('clamps below 0', () => expect(clamp01(-0.3)).toBe(0));
  it('passes through valid value', () => expect(clamp01(0.75)).toBe(0.75));
});

// ────────── assessSource ──────────

describe('assessSource', () => {
  it('high TOC + mature Ro gives high score (> 0.85) and high confidence', () => {
    const r = assessSource({ presence: 'probable', tocPercent: 2.8, roPercent: 0.82 }, 'oil');
    expect(r.score).toBeGreaterThan(0.85);
    expect(r.confidence).toBe('high');
  });

  it('proven source with excellent TOC clamps at 1.0', () => {
    const r = assessSource({ presence: 'proven', tocPercent: 5.0, roPercent: 0.90 }, 'oil');
    expect(r.score).toBe(1.0);
  });

  it('missing TOC and Ro are in missingEvidence', () => {
    const r = assessSource({ presence: 'probable' });
    expect(r.missingEvidence).toContain('TOC data not available');
    expect(r.missingEvidence).toContain('Maturity data (Ro) not available');
  });

  it('very low TOC penalizes the score', () => {
    const base = assessSource({ presence: 'probable', tocPercent: 1.5 });
    const poor = assessSource({ presence: 'probable', tocPercent: 0.3 });
    expect(poor.score).toBeLessThan(base.score);
    expect(poor.negativeEvidence.some((e) => e.includes('TOC'))).toBe(true);
  });

  it('immature source (Ro < 0.5) penalizes score', () => {
    const r = assessSource({ presence: 'probable', tocPercent: 2.0, roPercent: 0.4 }, 'oil');
    expect(r.negativeEvidence.some((e) => e.includes('Immature'))).toBe(true);
  });

  it('distant kitchen penalizes score', () => {
    const near = assessSource({ presence: 'probable', distanceToKitchenKm: 30 });
    const far = assessSource({ presence: 'probable', distanceToKitchenKm: 90 });
    expect(far.score).toBeLessThan(near.score);
  });

  it('absent source gives very low score', () => {
    const r = assessSource({ presence: 'absent' });
    expect(r.score).toBeLessThan(0.10);
  });

  it('gas maturity window applies when targetPhase is gas', () => {
    const gas = assessSource({ presence: 'probable', tocPercent: 2.0, roPercent: 1.5 }, 'gas');
    expect(gas.positiveEvidence.some((e) => e.includes('gas maturity'))).toBe(true);
  });
});

// ────────── assessMigration ──────────

describe('assessMigration', () => {
  it('proven pathway + good fault connectivity + proven carrier is strong', () => {
    const r = assessMigration({ pathway: 'proven', faultConnectivity: 'good', carrierBedPresence: 'proven' });
    expect(r.score).toBeGreaterThan(0.90);
  });

  it('absent carrier bed penalizes strongly', () => {
    const base = assessMigration({ pathway: 'probable', carrierBedPresence: 'probable' });
    const absent = assessMigration({ pathway: 'probable', carrierBedPresence: 'absent' });
    expect(absent.score).toBeLessThan(base.score - 0.10);
  });

  it('unlikely pathway gives low base score', () => {
    const r = assessMigration({ pathway: 'unlikely' });
    expect(r.score).toBeLessThan(0.20);
  });

  it('missing fault connectivity appears in missingEvidence', () => {
    const r = assessMigration({ pathway: 'possible' });
    expect(r.missingEvidence.some((e) => e.toLowerCase().includes('fault'))).toBe(true);
  });
});

// ────────── assessReservoir ──────────

describe('assessReservoir', () => {
  it('excellent porosity and permeability gives high score', () => {
    const r = assessReservoir({ presence: 'proven', porosityPercent: 20, permeabilityMd: 150, netPayM: 15 });
    expect(r.score).toBeGreaterThan(0.95);
  });

  it('poor porosity and permeability are penalized', () => {
    const r = assessReservoir({ presence: 'probable', porosityPercent: 5, permeabilityMd: 0.5 });
    expect(r.score).toBeLessThan(0.50);
    expect(r.negativeEvidence.length).toBeGreaterThan(0);
  });

  it('high Vshale penalizes score', () => {
    const base = assessReservoir({ presence: 'probable', porosityPercent: 14 });
    const shaly = assessReservoir({ presence: 'probable', porosityPercent: 14, vshaleFraction: 0.45 });
    expect(shaly.score).toBeLessThan(base.score);
  });

  it('absent reservoir gives very low score', () => {
    const r = assessReservoir({ presence: 'absent' });
    expect(r.score).toBeLessThan(0.10);
  });

  it('missing porosity and permeability are flagged', () => {
    const r = assessReservoir({ presence: 'possible' });
    expect(r.missingEvidence.some((e) => e.includes('Porosity'))).toBe(true);
    expect(r.missingEvidence.some((e) => e.includes('Permeability'))).toBe(true);
  });
});

// ────────── assessSeal ──────────

describe('assessSeal', () => {
  it('proven salt seal with low fault seal risk is near maximum', () => {
    const r = assessSeal({ presence: 'proven', lithology: 'salt', thicknessM: 40, faultSealRisk: 'low' });
    expect(r.score).toBeGreaterThan(0.95);
  });

  it('high fault seal risk strongly penalizes score (-0.20)', () => {
    const base = assessSeal({ presence: 'probable', lithology: 'shale', faultSealRisk: 'medium' });
    const high = assessSeal({ presence: 'probable', lithology: 'shale', faultSealRisk: 'high' });
    expect(high.score).toBeLessThan(base.score - 0.15);
    expect(high.negativeEvidence.some((e) => e.includes('fault seal'))).toBe(true);
  });

  it('poor lithology penalizes seal score', () => {
    const good = assessSeal({ presence: 'probable', lithology: 'shale' });
    const poor = assessSeal({ presence: 'probable', lithology: 'other' });
    expect(poor.score).toBeLessThan(good.score);
  });

  it('absent seal gives near-zero score', () => {
    const r = assessSeal({ presence: 'absent' });
    expect(r.score).toBeLessThan(0.10);
  });
});

// ────────── assessTrap ──────────

describe('assessTrap', () => {
  it('closureMapped false gives lower base score than mapped', () => {
    const mapped = assessTrap({ closureMapped: true });
    const unmapped = assessTrap({ closureMapped: false });
    expect(unmapped.score).toBeLessThan(mapped.score);
    expect(unmapped.score).toBeCloseTo(0.30, 1);
  });

  it('high seismic confidence boosts score', () => {
    const low = assessTrap({ closureMapped: true, seismicConfidence: 'low' });
    const high = assessTrap({ closureMapped: true, seismicConfidence: 'high' });
    expect(high.score).toBeGreaterThan(low.score + 0.15);
  });

  it('structural trap type adds bonus', () => {
    const unk = assessTrap({ closureMapped: true, trapType: 'unknown' });
    const str = assessTrap({ closureMapped: true, trapType: 'structural' });
    expect(str.score).toBeGreaterThan(unk.score);
  });

  it('large closure area and height add to score', () => {
    const base = assessTrap({ closureMapped: true });
    const full = assessTrap({ closureMapped: true, closureAreaKm2: 25, closureHeightM: 60 });
    expect(full.score).toBeGreaterThan(base.score);
  });
});

// ────────── assessTiming ──────────

describe('assessTiming', () => {
  it('yes timing + favorable charge + high burial history gives high score', () => {
    const r = assessTiming({ trapFormedBeforeMigration: 'yes', chargeTiming: 'favorable', burialHistoryConfidence: 'high' });
    expect(r.score).toBeGreaterThan(0.90);
  });

  it('unfavorable chargeTiming strongly penalizes score', () => {
    const base = assessTiming({ trapFormedBeforeMigration: 'likely', chargeTiming: 'possible' });
    const bad = assessTiming({ trapFormedBeforeMigration: 'likely', chargeTiming: 'unfavorable' });
    expect(bad.score).toBeLessThan(base.score - 0.15);
    expect(bad.negativeEvidence.some((e) => e.includes('Unfavorable'))).toBe(true);
  });

  it('low burial history confidence penalizes score', () => {
    const r = assessTiming({ trapFormedBeforeMigration: 'likely', burialHistoryConfidence: 'low' });
    expect(r.negativeEvidence.some((e) => e.includes('burial'))).toBe(true);
  });

  it('no timing gives near-zero score', () => {
    const r = assessTiming({ trapFormedBeforeMigration: 'no' });
    expect(r.score).toBeLessThan(0.10);
  });
});

// ────────── assessPetroleumSystem ──────────

describe('assessPetroleumSystem', () => {
  it('returns exactly 6 component assessments', () => {
    const r = assessPetroleumSystem({ source: { presence: 'probable' } });
    expect(r.components).toHaveLength(6);
  });

  it('identifies correct criticalRisk as lowest score component', () => {
    const r = assessPetroleumSystem({
      source: { presence: 'proven', tocPercent: 3.0, roPercent: 0.85 },
      migration: { pathway: 'proven', faultConnectivity: 'good', carrierBedPresence: 'proven' },
      reservoir: { presence: 'proven', porosityPercent: 16, permeabilityMd: 40 },
      seal: { presence: 'possible', faultSealRisk: 'high' },
      trap: { closureMapped: true, seismicConfidence: 'high', trapType: 'structural' },
      timing: { trapFormedBeforeMigration: 'yes', chargeTiming: 'favorable' },
    });
    expect(r.criticalRisk).toBe('seal');
  });

  it('includes derived scores for all 6 components', () => {
    const r = assessPetroleumSystem({});
    expect(Object.keys(r.derivedScores)).toHaveLength(6);
    for (const v of Object.values(r.derivedScores)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('handles completely empty evidence (all unknown defaults)', () => {
    const r = assessPetroleumSystem({});
    expect(r.components).toHaveLength(6);
    expect(r.overallConfidence).toBeDefined();
  });
});

// ────────── deriveScoresFromEvidence ──────────

describe('deriveScoresFromEvidence', () => {
  it('all returned scores are in 0..1 range', () => {
    const scores = deriveScoresFromEvidence({
      source: { presence: 'proven', tocPercent: 3.5, roPercent: 0.85 },
      migration: { pathway: 'proven', faultConnectivity: 'good' },
      reservoir: { presence: 'proven', porosityPercent: 18, permeabilityMd: 120 },
      seal: { presence: 'proven', lithology: 'salt', faultSealRisk: 'low' },
      trap: { closureMapped: true, seismicConfidence: 'high', trapType: 'structural' },
      timing: { trapFormedBeforeMigration: 'yes', chargeTiming: 'favorable' },
    });
    for (const v of Object.values(scores)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

// ────────── scoreProspect integration ──────────

describe('scoreProspect — evidence-derived integration', () => {
  it('uses evidence-derived scores when scoringMode is evidence_derived and evidence provided', () => {
    const prospect: Prospect = {
      ...baseEvidenceProspect,
      evidence: {
        source: { presence: 'proven', tocPercent: 3.0, roPercent: 0.85 },
        migration: { pathway: 'proven', faultConnectivity: 'good', carrierBedPresence: 'proven' },
        reservoir: { presence: 'proven', porosityPercent: 16, permeabilityMd: 50, netPayM: 12 },
        seal: { presence: 'proven', lithology: 'shale', thicknessM: 35, faultSealRisk: 'low' },
        trap: { closureMapped: true, trapType: 'structural', closureAreaKm2: 25, closureHeightM: 60, seismicConfidence: 'high' },
        timing: { trapFormedBeforeMigration: 'yes', chargeTiming: 'favorable', burialHistoryConfidence: 'high' },
      },
    };
    const scored = scoreProspect(prospect);
    expect(scored.geoscienceAssessment).toBeDefined();
    expect(scored.sourceScore).not.toBe(0.5);
    expect(scored.geologicalChanceOfSuccess).toBeGreaterThan(0);
  });

  it('keeps manual placeholder scores when scoringMode is manual', () => {
    const scored = scoreProspect(baseManualProspect);
    expect(scored.sourceScore).toBe(baseManualProspect.sourceScore);
    expect(scored.geoscienceAssessment).toBeUndefined();
  });

  it('keeps manual scores when scoringMode is undefined', () => {
    const scored = scoreProspect({ ...baseManualProspect, scoringMode: undefined });
    expect(scored.sourceScore).toBe(baseManualProspect.sourceScore);
  });

  it('seal-risk evidence-derived prospect has seal as mainRisk', () => {
    const sealRiskProspect: Prospect = {
      ...baseEvidenceProspect,
      id: 'seal-risk',
      evidence: {
        source: { presence: 'proven', tocPercent: 3.0, roPercent: 0.85 },
        migration: { pathway: 'proven', faultConnectivity: 'good', carrierBedPresence: 'proven' },
        reservoir: { presence: 'proven', porosityPercent: 15, permeabilityMd: 40 },
        seal: { presence: 'possible', faultSealRisk: 'high' },
        trap: { closureMapped: true, seismicConfidence: 'high', trapType: 'structural' },
        timing: { trapFormedBeforeMigration: 'yes', chargeTiming: 'favorable' },
      },
    };
    const scored = scoreProspect(sealRiskProspect);
    expect(scored.mainRisk).toBe('seal');
  });
});

// ────────── localStorage persistence ──────────

describe('evidence-derived prospect survives JSON serialization', () => {
  it('serializes and deserializes evidence without data loss', () => {
    const original: Prospect = {
      ...baseEvidenceProspect,
      evidence: {
        source: { presence: 'proven', tocPercent: 2.0, roPercent: 0.75 },
        seal: { presence: 'probable', faultSealRisk: 'medium' },
      },
    };
    const serialized = JSON.stringify(original);
    const parsed: Prospect = JSON.parse(serialized);
    expect(parsed.evidence?.source?.tocPercent).toBe(2.0);
    expect(parsed.evidence?.seal?.faultSealRisk).toBe('medium');
    expect(parsed.scoringMode).toBe('evidence_derived');
  });

  it('re-scored after deserialization produces same derived scores', () => {
    const original: Prospect = {
      ...baseEvidenceProspect,
      evidence: {
        source: { presence: 'probable', tocPercent: 1.8, roPercent: 0.72 },
        migration: { pathway: 'probable', faultConnectivity: 'good' },
        reservoir: { presence: 'probable', porosityPercent: 13, permeabilityMd: 25 },
        seal: { presence: 'probable', lithology: 'shale', faultSealRisk: 'medium' },
        trap: { closureMapped: true, trapType: 'structural', seismicConfidence: 'medium' },
        timing: { trapFormedBeforeMigration: 'likely', chargeTiming: 'possible' },
      },
    };
    const first = scoreProspect(original);
    const parsed: Prospect = JSON.parse(JSON.stringify(first));
    const second = scoreProspect(parsed);
    expect(second.sourceScore).toBeCloseTo(first.sourceScore, 5);
    expect(second.geologicalChanceOfSuccess).toBeCloseTo(first.geologicalChanceOfSuccess ?? 0, 5);
  });
});

// ────────── Advisor evidence queries ──────────

describe('advisor — evidence-derived queries', () => {
  const evidenceProspectFull: Prospect = {
    ...baseEvidenceProspect,
    id: 'adv-e1',
    name: 'North Sea Deepwater',
    evidence: {
      source: { presence: 'probable', tocPercent: 2.5, roPercent: 0.80 },
      migration: { pathway: 'probable', faultConnectivity: 'good', carrierBedPresence: 'probable' },
      reservoir: { presence: 'probable', porosityPercent: 15, permeabilityMd: 35 },
      seal: { presence: 'probable', lithology: 'shale', thicknessM: 32, faultSealRisk: 'low' },
      trap: { closureMapped: true, trapType: 'structural', seismicConfidence: 'high' },
      timing: { trapFormedBeforeMigration: 'likely', chargeTiming: 'favorable', burialHistoryConfidence: 'high' },
    },
  };

  const sealRiskProspect: Prospect = {
    ...baseEvidenceProspect,
    id: 'adv-e2',
    name: 'Seal Risk Prospect',
    evidence: {
      source: { presence: 'probable', tocPercent: 1.8, roPercent: 0.75 },
      migration: { pathway: 'probable' },
      reservoir: { presence: 'probable', porosityPercent: 13 },
      seal: { presence: 'possible', faultSealRisk: 'high' },
      trap: { closureMapped: true, seismicConfidence: 'medium' },
      timing: { trapFormedBeforeMigration: 'likely' },
    },
  };

  const manualProspect: Prospect = {
    ...baseManualProspect,
    id: 'adv-m1',
    name: 'Manual Alpha',
  };

  const prospects = scoreProspects([evidenceProspectFull, sealRiskProspect, manualProspect]);

  it('lists evidence-derived prospects', () => {
    const r = getAdvisorResponse('Which prospects are evidence-derived?', prospects);
    expect(r).toContain('North Sea Deepwater');
    expect(r).toContain('Seal Risk Prospect');
  });

  it('lists manual scoring prospects', () => {
    const r = getAdvisorResponse('Which prospects are still manual scoring?', prospects);
    expect(r).toContain('Manual Alpha');
  });

  it('reports seal risk prospects', () => {
    const r = getAdvisorResponse('Which prospects have seal risk?', prospects);
    expect(r).toContain('Seal Risk Prospect');
  });

  it('reports critical geoscience risk', () => {
    const r = getAdvisorResponse('What is the critical geoscience risk?', prospects);
    expect(r.toLowerCase()).toMatch(/risk|source|migration|reservoir|seal|trap|timing/);
  });

  it('reports main portfolio risk', () => {
    const r = getAdvisorResponse('What is the main risk?', prospects);
    expect(r.toLowerCase()).toMatch(/risk/);
  });

  it('supports evidence supports query for named prospect', () => {
    const r = getAdvisorResponse('What evidence supports North Sea Deepwater?', prospects);
    expect(r).toContain('North Sea Deepwater');
  });

  it('supports missing evidence query for named prospect', () => {
    const r = getAdvisorResponse('What evidence is missing for North Sea Deepwater?', prospects);
    expect(r).toContain('North Sea Deepwater');
  });
});
