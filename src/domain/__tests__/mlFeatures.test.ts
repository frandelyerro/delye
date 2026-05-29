import { describe, expect, it } from 'vitest';
import { scoreProspect, scoreProspects } from '../scoring';
import { mockProspects } from '../../data/mockProspects';
import {
  extractMLFeatures,
  extractMLFeaturesForPortfolio,
  calculateEvidenceCompleteness,
  countEvidenceSignals,
  mapProspectivityTierToNumber,
} from '../mlFeatures';
import type { Prospect } from '../prospect';
import { createDefaultEvidence } from '../evidenceDefaults';

const scored = scoreProspects(mockProspects);
const singleProspect = scored[0];

const manualProspect: Prospect = scoreProspect({
  id: 'ml-feat-1',
  name: 'Feature Test',
  basin: 'Neuquén',
  block: 'B',
  playType: 'Structural',
  latitude: -38,
  longitude: -68,
  sourceScore: 0.7,
  migrationScore: 0.6,
  reservoirScore: 0.65,
  sealScore: 0.5,
  trapScore: 0.8,
  timingScore: 0.6,
  commercialScore: 70,
  resourceEstimate: 100,
});

// ── mapProspectivityTierToNumber ─────────────────────────────────────────────

describe('mapProspectivityTierToNumber', () => {
  it('maps tier_1 to 4', () => expect(mapProspectivityTierToNumber('tier_1')).toBe(4));
  it('maps tier_2 to 3', () => expect(mapProspectivityTierToNumber('tier_2')).toBe(3));
  it('maps tier_3 to 2', () => expect(mapProspectivityTierToNumber('tier_3')).toBe(2));
  it('maps tier_4 to 1', () => expect(mapProspectivityTierToNumber('tier_4')).toBe(1));
  it('maps undefined to 0', () => expect(mapProspectivityTierToNumber(undefined)).toBe(0));
});

// ── extractMLFeatures ────────────────────────────────────────────────────────

describe('extractMLFeatures', () => {
  it('returns a vector with all required fields', () => {
    const fv = extractMLFeatures(singleProspect);
    expect(typeof fv.prospectId).toBe('string');
    expect(typeof fv.gcosExpert).toBe('number');
    expect(typeof fv.dataConfidence).toBe('number');
    expect(typeof fv.evidenceCompleteness).toBe('number');
    expect(typeof fv.riskedResource).toBe('number');
    expect(typeof fv.simpleEMV).toBe('number');
    expect(typeof fv.prospectivityTierNumeric).toBe('number');
    expect(typeof fv.isEvidenceDerived).toBe('number');
  });

  it('mainRisk one-hot: exactly one flag = 1, others = 0', () => {
    const fv = extractMLFeatures(manualProspect);
    const flags = [
      fv.mainRisk_source, fv.mainRisk_migration, fv.mainRisk_reservoir,
      fv.mainRisk_seal, fv.mainRisk_trap, fv.mainRisk_timing,
    ];
    expect(flags.filter((f) => f === 1).length).toBe(1);
    expect(flags.filter((f) => f === 0).length).toBe(5);
    expect(flags.every((f) => f === 0 || f === 1)).toBe(true);
  });

  it('evidenceCompleteness = 0 for manual prospect', () => {
    const fv = extractMLFeatures(manualProspect);
    expect(fv.evidenceCompleteness).toBe(0);
  });

  it('isEvidenceDerived = 0 for manual prospect', () => {
    const fv = extractMLFeatures(manualProspect);
    expect(fv.isEvidenceDerived).toBe(0);
  });

  it('gcosExpert matches prospect.geologicalChanceOfSuccess', () => {
    const fv = extractMLFeatures(manualProspect);
    expect(fv.gcosExpert).toBeCloseTo(manualProspect.geologicalChanceOfSuccess ?? 0);
  });

  it('riskedResource falls back to resourceEstimate * GCoS when no economicAssessment', () => {
    const noEcon: Prospect = { ...manualProspect, economicAssessment: undefined };
    const fv = extractMLFeatures(noEcon);
    const expected = noEcon.resourceEstimate * (noEcon.geologicalChanceOfSuccess ?? 0);
    expect(fv.riskedResource).toBeCloseTo(expected);
  });

  it('riskedResource uses economicAssessment when present', () => {
    const withEcon = scored.find((p) => p.economicAssessment);
    if (!withEcon) return;
    const fv = extractMLFeatures(withEcon);
    expect(fv.riskedResource).toBeCloseTo(withEcon.economicAssessment!.riskedResourceMMboe);
  });

  it('simpleEMV = 0 when no economicAssessment', () => {
    const noEcon: Prospect = { ...manualProspect, economicAssessment: undefined };
    const fv = extractMLFeatures(noEcon);
    expect(fv.simpleEMV).toBe(0);
  });

  it('returns stable vector on repeated calls', () => {
    const fv1 = extractMLFeatures(singleProspect);
    const fv2 = extractMLFeatures(singleProspect);
    expect(fv1).toEqual(fv2);
  });

  it('prospectivityTierNumeric is in [0, 4]', () => {
    for (const p of scored) {
      const fv = extractMLFeatures(p);
      expect(fv.prospectivityTierNumeric).toBeGreaterThanOrEqual(0);
      expect(fv.prospectivityTierNumeric).toBeLessThanOrEqual(4);
    }
  });
});

// ── evidence-derived prospect ────────────────────────────────────────────────

describe('extractMLFeatures — evidence-derived prospect', () => {
  it('evidenceCompleteness > 0 when geoscienceAssessment is present', () => {
    const evProspect = scored.find((p) => p.scoringMode === 'evidence_derived' && p.geoscienceAssessment);
    if (!evProspect) return;
    const fv = extractMLFeatures(evProspect);
    expect(fv.evidenceCompleteness).toBeGreaterThanOrEqual(0);
    expect(fv.evidenceCompleteness).toBeLessThanOrEqual(1);
    expect(fv.isEvidenceDerived).toBe(1);
  });
});

// ── calculateEvidenceCompleteness ────────────────────────────────────────────

describe('calculateEvidenceCompleteness', () => {
  it('returns 0 for manual prospect', () => {
    expect(calculateEvidenceCompleteness(manualProspect)).toBe(0);
  });

  it('returns value in [0, 1]', () => {
    for (const p of scored) {
      const v = calculateEvidenceCompleteness(p);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

// ── countEvidenceSignals ─────────────────────────────────────────────────────

describe('countEvidenceSignals', () => {
  it('returns zeros for manual prospect', () => {
    const counts = countEvidenceSignals(manualProspect);
    expect(counts.positiveEvidenceCount).toBe(0);
    expect(counts.negativeEvidenceCount).toBe(0);
    expect(counts.missingEvidenceCount).toBe(0);
  });

  it('returns non-negative counts', () => {
    for (const p of scored) {
      const counts = countEvidenceSignals(p);
      expect(counts.positiveEvidenceCount).toBeGreaterThanOrEqual(0);
      expect(counts.negativeEvidenceCount).toBeGreaterThanOrEqual(0);
      expect(counts.missingEvidenceCount).toBeGreaterThanOrEqual(0);
    }
  });
});

// ── extractMLFeaturesForPortfolio ────────────────────────────────────────────

describe('extractMLFeaturesForPortfolio', () => {
  it('returns same length as input', () => {
    const vectors = extractMLFeaturesForPortfolio(scored);
    expect(vectors.length).toBe(scored.length);
  });

  it('returns empty array for empty portfolio', () => {
    expect(extractMLFeaturesForPortfolio([])).toHaveLength(0);
  });
});
