import { describe, expect, it } from 'vitest';
import { Prospect } from '../prospect';
import { calculateGCoS, getMainRisk, getPriority, scoreProspect } from '../scoring';
import { calculateDataConfidence } from '../explainability';
import { getAdvisorResponse } from '../advisor';
import { scoreProspects } from '../scoring';

const fullScoreProspect: Prospect = {
  id: 'pt1',
  name: 'Perfect Prospect',
  basin: 'Test Basin',
  block: 'T1',
  playType: 'Structural',
  latitude: 10,
  longitude: 10,
  sourceScore: 1.0,
  migrationScore: 1.0,
  reservoirScore: 1.0,
  sealScore: 1.0,
  trapScore: 1.0,
  timingScore: 1.0,
  commercialScore: 80,
  resourceEstimate: 100
};

const zeroSourceProspect: Prospect = {
  ...fullScoreProspect,
  id: 'pt2',
  name: 'Zero Source',
  sourceScore: 0.0
};

const typicalProspect: Prospect = {
  id: 'pt3',
  name: 'Typical',
  basin: 'North Sea',
  block: 'NS-10',
  playType: 'Structural',
  latitude: 55,
  longitude: 2,
  sourceScore: 0.8,
  migrationScore: 0.7,
  reservoirScore: 0.6,
  sealScore: 0.7,
  trapScore: 0.75,
  timingScore: 0.8,
  commercialScore: 75,
  resourceEstimate: 80
};

const highPriorityProspect: Prospect = {
  ...typicalProspect,
  id: 'pt4',
  name: 'High Priority',
  geologicalChanceOfSuccess: 0.40,
  commercialScore: 80
};

const mediumPriorityProspect: Prospect = {
  ...typicalProspect,
  id: 'pt5',
  name: 'Medium Priority',
  geologicalChanceOfSuccess: 0.20,
  commercialScore: 55
};

const lowPriorityProspect: Prospect = {
  ...typicalProspect,
  id: 'pt6',
  name: 'Low Priority',
  geologicalChanceOfSuccess: 0.10,
  commercialScore: 90
};

const sealRiskProspect: Prospect = {
  ...typicalProspect,
  id: 'pt7',
  name: 'Seal Risk',
  sealScore: 0.1,
  sourceScore: 0.8,
  migrationScore: 0.75,
  reservoirScore: 0.72,
  trapScore: 0.7,
  timingScore: 0.75
};

const reservoirRiskProspect: Prospect = {
  ...typicalProspect,
  id: 'pt8',
  name: 'Reservoir Risk',
  reservoirScore: 0.1,
  sourceScore: 0.8,
  migrationScore: 0.75,
  sealScore: 0.72,
  trapScore: 0.7,
  timingScore: 0.75
};

const timingRiskProspect: Prospect = {
  ...typicalProspect,
  id: 'pt9',
  name: 'Timing Risk',
  timingScore: 0.1,
  sourceScore: 0.8,
  migrationScore: 0.75,
  reservoirScore: 0.72,
  sealScore: 0.7,
  trapScore: 0.75
};

describe('petroleum technical parameters', () => {
  describe('GCoS formula', () => {
    it('all components = 1.0 gives GCoS = 1.0', () => {
      expect(calculateGCoS(fullScoreProspect)).toBe(1.0);
    });

    it('one component = 0 gives GCoS = 0', () => {
      expect(calculateGCoS(zeroSourceProspect)).toBe(0);
    });

    it('typical values (source=0.8, migration=0.7, reservoir=0.6, seal=0.7, trap=0.75, timing=0.8) gives reasonable GCoS', () => {
      const gcos = calculateGCoS(typicalProspect);
      expect(gcos).toBeGreaterThan(0.10);
      expect(gcos).toBeLessThan(0.30);
    });

    it('typical GCoS is approximately 0.141 (within 1% tolerance)', () => {
      const gcos = calculateGCoS(typicalProspect);
      // 0.8 × 0.7 × 0.6 × 0.7 × 0.75 × 0.8 = 0.14112
      expect(gcos).toBeCloseTo(0.14112, 3);
    });
  });

  describe('priority thresholds', () => {
    it('priority is high when GCoS >= 0.35 and commercialScore >= 70', () => {
      expect(getPriority(highPriorityProspect)).toBe('high');
    });

    it('priority is medium when GCoS >= 0.18 and commercialScore < 70', () => {
      expect(getPriority(mediumPriorityProspect)).toBe('medium');
    });

    it('priority is low when GCoS < 0.18 regardless of commercialScore', () => {
      expect(getPriority(lowPriorityProspect)).toBe('low');
    });

    it('high GCoS but commercialScore < 70 does not qualify as high priority', () => {
      const p: Prospect = { ...typicalProspect, geologicalChanceOfSuccess: 0.40, commercialScore: 65 };
      expect(getPriority(p)).toBe('medium');
    });
  });

  describe('mainRisk is the weakest component', () => {
    it('identifies seal as mainRisk when sealScore is lowest', () => {
      expect(getMainRisk(sealRiskProspect)).toBe('seal');
    });

    it('identifies reservoir as mainRisk when reservoirScore is lowest', () => {
      expect(getMainRisk(reservoirRiskProspect)).toBe('reservoir');
    });

    it('identifies timing as mainRisk when timingScore is lowest', () => {
      expect(getMainRisk(timingRiskProspect)).toBe('timing');
    });
  });

  describe('data confidence', () => {
    it('prospect with all values populated has higher data confidence than one with zeros', () => {
      const highConfidence = calculateDataConfidence(fullScoreProspect);
      const lowConfidence = calculateDataConfidence({
        ...fullScoreProspect,
        resourceEstimate: 0,
        commercialScore: 0,
        sourceScore: 0.2,
        migrationScore: 0.2,
        reservoirScore: 0.2,
        sealScore: 0.2,
        trapScore: 0.2,
        timingScore: 0.2
      });
      expect(highConfidence).toBeGreaterThan(lowConfidence);
    });

    it('zero resource estimate reduces data confidence', () => {
      const base = calculateDataConfidence(typicalProspect);
      const withZeroResource = calculateDataConfidence({ ...typicalProspect, resourceEstimate: 0 });
      expect(withZeroResource).toBeLessThan(base);
    });

    it('zero commercial score reduces data confidence', () => {
      const base = calculateDataConfidence(typicalProspect);
      const withZeroCommercial = calculateDataConfidence({ ...typicalProspect, commercialScore: 0 });
      expect(withZeroCommercial).toBeLessThan(base);
    });
  });

  describe('scoreProspect integration', () => {
    it('scored prospect has GCoS, mainRisk, priority and dataConfidence populated', () => {
      const scored = scoreProspect(typicalProspect);
      expect(scored.geologicalChanceOfSuccess).toBeDefined();
      expect(scored.mainRisk).toBeDefined();
      expect(scored.priority).toBeDefined();
      expect(scored.dataConfidence).toBeDefined();
    });

    it('scored typical prospect has priority low (GCoS ~0.14, below 0.18 threshold)', () => {
      // GCoS = 0.8×0.7×0.6×0.7×0.75×0.8 ≈ 0.141, which is below the medium threshold of 0.18
      const scored = scoreProspect(typicalProspect);
      expect(scored.priority).toBe('low');
    });

    it('scored typical prospect mainRisk is reservoir (lowest at 0.6)', () => {
      const scored = scoreProspect(typicalProspect);
      expect(scored.mainRisk).toBe('reservoir');
    });
  });

  describe('advisor petroleum targeting questions', () => {
    const prospects = scoreProspects([
      typicalProspect,
      { ...typicalProspect, id: 'pa2', name: 'High Scorer', sourceScore: 0.9, migrationScore: 0.88, reservoirScore: 0.85, sealScore: 0.82, trapScore: 0.85, timingScore: 0.9, commercialScore: 88, resourceEstimate: 200 },
      { ...typicalProspect, id: 'pa3', name: 'Low Scorer', sourceScore: 0.3, migrationScore: 0.3, reservoirScore: 0.25, sealScore: 0.28, trapScore: 0.3, timingScore: 0.3, commercialScore: 40, resourceEstimate: 15 }
    ]);

    it('advisor answers best prospect query', () => {
      const response = getAdvisorResponse('What is the best prospect?', prospects);
      expect(response).toContain('High Scorer');
      expect(response).toContain('GCoS');
    });

    it('advisor answers main risk portfolio query', () => {
      const response = getAdvisorResponse('What is the main risk?', prospects);
      expect(response.toLowerCase()).toMatch(/risk|source|migration|reservoir|seal|trap|timing/);
    });

    it('advisor answers data confidence query', () => {
      const response = getAdvisorResponse('What is the data confidence?', prospects);
      expect(response).toContain('Data Confidence');
    });

    it('advisor answers portfolio summary query', () => {
      const response = getAdvisorResponse('portfolio summary', prospects);
      expect(response).toContain('prospects');
      expect(response).toContain('GCoS');
    });

    it('advisor returns fallback with help text when question is unrecognized', () => {
      const response = getAdvisorResponse('zxqwerty unknown question', prospects);
      expect(response.length).toBeGreaterThan(10);
    });
  });
});
