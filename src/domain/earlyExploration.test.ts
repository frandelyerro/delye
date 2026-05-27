import { describe, expect, it } from 'vitest';
import type { Prospect } from './prospect';
import {
  getExplorationStage,
  getExplorationStageLabel,
  assessExplorationMaturity,
  getDataGaps,
  getEarlyExplorationRecommendation,
} from './earlyExploration';

const manualBase: Prospect = {
  id: 'm1', name: 'Manual Prospect', basin: 'Test', block: 'T-01', playType: 'Structural',
  latitude: 0, longitude: 0,
  sourceScore: 0.60, migrationScore: 0.55, reservoirScore: 0.58,
  sealScore: 0.52, trapScore: 0.56, timingScore: 0.60,
  commercialScore: 60, resourceEstimate: 60,
  geologicalChanceOfSuccess: 0.15, dataConfidence: 85,
  priority: 'medium', mainRisk: 'seal',
};

const evidenceDerivedGood: Prospect = {
  ...manualBase,
  id: 'e1', name: 'Evidence Good',
  scoringMode: 'evidence_derived',
  geologicalChanceOfSuccess: 0.25, dataConfidence: 65,
  trapScore: 0.70, sealScore: 0.65,
};

const drillReady: Prospect = {
  ...manualBase,
  id: 'd1', name: 'Drill Ready',
  geologicalChanceOfSuccess: 0.38,
  dataConfidence: 80, commercialScore: 75,
  sourceScore: 0.85, migrationScore: 0.82, reservoirScore: 0.80,
  sealScore: 0.78, trapScore: 0.82, timingScore: 0.84,
  mainRisk: 'seal',
};

const appraisalReady: Prospect = {
  ...drillReady,
  id: 'a1', name: 'Appraisal Ready',
  resourceEstimate: 250, commercialScore: 88,
  geologicalChanceOfSuccess: 0.40, dataConfidence: 85,
};

const sparseManual: Prospect = {
  ...manualBase,
  id: 'm2', name: 'Sparse Manual',
  geologicalChanceOfSuccess: 0.06,
  dataConfidence: 40, commercialScore: 35,
  resourceEstimate: 20,
};

// ---- getExplorationStage ----

describe('getExplorationStage', () => {
  it('manual prospect with low GCoS → concept_lead or lead', () => {
    const stage = getExplorationStage(sparseManual);
    expect(['concept_lead', 'lead']).toContain(stage);
  });

  it('manual prospect with GCoS >= 0.10 → lead', () => {
    expect(getExplorationStage(manualBase)).toBe('lead');
  });

  it('evidence_derived with defined trap and dc >= 40 → prospect', () => {
    expect(getExplorationStage(evidenceDerivedGood)).toBe('prospect');
  });

  it('high GCoS + high dc + tier_1 → drill_ready_candidate', () => {
    expect(getExplorationStage(drillReady)).toBe('drill_ready_candidate');
  });

  it('large resource + tier_1 + high commercial → appraisal_candidate', () => {
    expect(getExplorationStage(appraisalReady)).toBe('appraisal_candidate');
  });
});

// ---- getExplorationStageLabel ----

describe('getExplorationStageLabel', () => {
  it('returns human-readable labels', () => {
    expect(getExplorationStageLabel('concept_lead')).toBe('Concept Lead');
    expect(getExplorationStageLabel('drill_ready_candidate')).toBe('Drill-Ready Candidate');
    expect(getExplorationStageLabel('appraisal_candidate')).toBe('Appraisal Candidate');
  });
});

// ---- assessExplorationMaturity ----

describe('assessExplorationMaturity', () => {
  it('returns stage, stageLabel, readinessScore and summary', () => {
    const m = assessExplorationMaturity(drillReady);
    expect(m).toHaveProperty('stage');
    expect(m).toHaveProperty('stageLabel');
    expect(m).toHaveProperty('readinessScore');
    expect(m).toHaveProperty('summary');
  });

  it('readiness 0-100 range', () => {
    [manualBase, sparseManual, drillReady, appraisalReady].forEach((p) => {
      const m = assessExplorationMaturity(p);
      expect(m.readinessScore).toBeGreaterThanOrEqual(0);
      expect(m.readinessScore).toBeLessThanOrEqual(100);
    });
  });

  it('drill_ready_candidate has higher readiness than concept_lead', () => {
    expect(assessExplorationMaturity(drillReady).readinessScore)
      .toBeGreaterThan(assessExplorationMaturity(sparseManual).readinessScore);
  });
});

// ---- getDataGaps ----

describe('getDataGaps', () => {
  it('manual prospect has no-structured-evidence gap', () => {
    const gaps = getDataGaps(manualBase);
    expect(gaps.some((g) => g.includes('No structured evidence model'))).toBe(true);
  });

  it('low trap score generates trap gap', () => {
    const p = { ...manualBase, trapScore: 0.35 };
    const gaps = getDataGaps(p);
    expect(gaps.some((g) => g.includes('Trap'))).toBe(true);
  });

  it('low dc generates confidence gap', () => {
    const p = { ...manualBase, dataConfidence: 30 };
    const gaps = getDataGaps(p);
    expect(gaps.some((g) => g.includes('data confidence'))).toBe(true);
  });

  it('high-quality evidence-derived prospect with no geoscienceAssessment missing data has fewer gaps', () => {
    const highQuality: Prospect = {
      ...evidenceDerivedGood,
      sourceScore: 0.90, migrationScore: 0.88, reservoirScore: 0.87,
      sealScore: 0.85, trapScore: 0.88, timingScore: 0.84,
      dataConfidence: 80, scoringMode: 'evidence_derived',
    };
    const gaps = getDataGaps(highQuality);
    // No manual scoring gap
    expect(gaps.some((g) => g.includes('No structured evidence model'))).toBe(false);
  });
});

// ---- getEarlyExplorationRecommendation ----

describe('getEarlyExplorationRecommendation', () => {
  it('returns a non-empty string for every prospect type', () => {
    [manualBase, sparseManual, drillReady, appraisalReady, evidenceDerivedGood].forEach((p) => {
      expect(getEarlyExplorationRecommendation(p).length).toBeGreaterThan(0);
    });
  });

  it('mentions the prospect name', () => {
    expect(getEarlyExplorationRecommendation(drillReady)).toContain(drillReady.name);
  });

  it('mentions the stage label', () => {
    const rec = getEarlyExplorationRecommendation(drillReady);
    expect(rec).toContain('Drill-Ready Candidate');
  });
});
