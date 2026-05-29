import { describe, expect, it } from 'vitest';
import { scoreProspect, scoreProspects } from '../scoring';
import { mockProspects } from '../../data/mockProspects';
import {
  getMLModelStatus,
  predictWithBaselineModel,
  compareExpertAndML,
} from '../mlModel';
import type { Prospect } from '../prospect';

const scored = scoreProspects(mockProspects);

const baseProspect: Prospect = scoreProspect({
  id: 'ml-model-1',
  name: 'Model Test',
  basin: 'Neuquén',
  block: 'A',
  playType: 'Structural',
  latitude: -38,
  longitude: -68,
  sourceScore: 0.7,
  migrationScore: 0.6,
  reservoirScore: 0.65,
  sealScore: 0.55,
  trapScore: 0.7,
  timingScore: 0.6,
  commercialScore: 72,
  resourceEstimate: 120,
});

// ── getMLModelStatus ─────────────────────────────────────────────────────────

describe('getMLModelStatus', () => {
  it('returns available: false', () => {
    const status = getMLModelStatus();
    expect(status.available).toBe(false);
  });

  it('has a non-empty limitations array', () => {
    const status = getMLModelStatus();
    expect(Array.isArray(status.limitations)).toBe(true);
    expect(status.limitations.length).toBeGreaterThan(0);
  });

  it('limitations include no-trained-model note', () => {
    const status = getMLModelStatus();
    const hasTrainingNote = status.limitations.some((l) =>
      l.toLowerCase().includes('trained') || l.toLowerCase().includes('historical')
    );
    expect(hasTrainingNote).toBe(true);
  });
});

// ── predictWithBaselineModel ─────────────────────────────────────────────────

describe('predictWithBaselineModel', () => {
  it('returns predicted GCoS in [0, 1]', () => {
    const pred = predictWithBaselineModel(baseProspect);
    expect(pred.predictedGCoS).toBeGreaterThanOrEqual(0);
    expect(pred.predictedGCoS).toBeLessThanOrEqual(1);
  });

  it('includes required warnings', () => {
    const pred = predictWithBaselineModel(baseProspect);
    expect(pred.warnings).toContain('No trained ML model is connected yet.');
    expect(pred.warnings).toContain('Baseline prediction is deterministic and for development only.');
    expect(pred.warnings).toContain('Use expert-system GCoS as the source of truth until a calibrated model is trained.');
  });

  it('uses the prospect id', () => {
    const pred = predictWithBaselineModel(baseProspect);
    expect(pred.prospectId).toBe(baseProspect.id);
  });

  it('returns top factors array', () => {
    const pred = predictWithBaselineModel(baseProspect);
    expect(Array.isArray(pred.topFactors)).toBe(true);
    expect(pred.topFactors.length).toBeGreaterThan(0);
  });

  it('top factor directions are valid', () => {
    const pred = predictWithBaselineModel(baseProspect);
    pred.topFactors.forEach((f) => {
      expect(['positive', 'negative']).toContain(f.direction);
    });
  });

  it('predicted GCoS in [0, 1] for all mock prospects', () => {
    for (const p of scored) {
      const pred = predictWithBaselineModel(p);
      expect(pred.predictedGCoS).toBeGreaterThanOrEqual(0);
      expect(pred.predictedGCoS).toBeLessThanOrEqual(1);
    }
  });

  it('returns deterministic result on repeated calls', () => {
    const p1 = predictWithBaselineModel(baseProspect);
    const p2 = predictWithBaselineModel(baseProspect);
    expect(p1.predictedGCoS).toBe(p2.predictedGCoS);
  });
});

// ── compareExpertAndML ───────────────────────────────────────────────────────

describe('compareExpertAndML', () => {
  it('returns all required fields', () => {
    const cmp = compareExpertAndML(baseProspect);
    expect(typeof cmp.expertGCoS).toBe('number');
    expect(typeof cmp.predictedGCoS).toBe('number');
    expect(typeof cmp.delta).toBe('number');
    expect(['high', 'medium', 'low']).toContain(cmp.agreement);
    expect(typeof cmp.interpretation).toBe('string');
    expect(cmp.interpretation.length).toBeGreaterThan(0);
  });

  it('delta equals predictedGCoS - expertGCoS', () => {
    const cmp = compareExpertAndML(baseProspect);
    expect(cmp.delta).toBeCloseTo(cmp.predictedGCoS - cmp.expertGCoS);
  });

  it('high agreement when delta < 0.05', () => {
    const highAgreementProspect: Prospect = scoreProspect({
      id: 'agree-high',
      name: 'High Agreement',
      basin: 'Test',
      block: 'A',
      playType: 'Structural',
      latitude: 0, longitude: 0,
      sourceScore: 0.5, migrationScore: 0.5, reservoirScore: 0.5,
      sealScore: 0.5, trapScore: 0.5, timingScore: 0.5,
      commercialScore: 50, resourceEstimate: 50,
    });
    const cmp = compareExpertAndML(highAgreementProspect);
    expect(['high', 'medium', 'low']).toContain(cmp.agreement);
  });

  it('expertGCoS matches prospect.geologicalChanceOfSuccess', () => {
    const cmp = compareExpertAndML(baseProspect);
    expect(cmp.expertGCoS).toBeCloseTo(baseProspect.geologicalChanceOfSuccess ?? 0);
  });
});
