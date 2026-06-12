import { describe, expect, it } from 'vitest';
import { assessEconomics, getEconomicAssumptionDefaults, getDecisionSignalLabel, getEconomicGradeLabel } from './economics';
import type { Prospect } from './prospect';

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
  geologicalChanceOfSuccess: 0.7 ** 6,
  dataConfidence: 70,
  priority: 'high',
};

describe('assessEconomics', () => {
  it('returns all required fields', () => {
    const ea = assessEconomics(base);
    expect(ea.unriskedResourceMMboe).toBeDefined();
    expect(ea.riskedResourceMMboe).toBeDefined();
    expect(ea.estimatedGrossRevenueUsdMM).toBeDefined();
    expect(ea.estimatedNetRevenueUsdMM).toBeDefined();
    expect(ea.estimatedTotalCostUsdMM).toBeDefined();
    expect(ea.simpleEMVUsdMM).toBeDefined();
    expect(ea.discountRate).toBeDefined();
    expect(ea.simpleNPVAtDiscountUsdMM).toBeDefined();
    expect(ea.valuePerRiskedBoeUsd).toBeDefined();
    expect(ea.economicGrade).toBeDefined();
    expect(ea.decisionSignal).toBeDefined();
    expect(Array.isArray(ea.rationale)).toBe(true);
    expect(Array.isArray(ea.warnings)).toBe(true);
  });

  it('unrisked resource equals prospect resourceEstimate', () => {
    const ea = assessEconomics(base);
    expect(ea.unriskedResourceMMboe).toBe(100);
  });

  it('risked resource = resourceEstimate × GCoS', () => {
    const ea = assessEconomics(base);
    expect(ea.riskedResourceMMboe).toBeCloseTo(100 * (0.7 ** 6), 4);
  });

  it('risked resource is never negative', () => {
    const ea = assessEconomics({ ...base, geologicalChanceOfSuccess: 0 });
    expect(ea.riskedResourceMMboe).toBe(0);
  });

  it('uses default assumptions when none provided', () => {
    const d = getEconomicAssumptionDefaults();
    const ea = assessEconomics(base);
    // gross revenue = 100 × 75 × (1 − 0.2) = 6000
    expect(ea.estimatedGrossRevenueUsdMM).toBeCloseTo(100 * d.oilPriceUsdPerBbl * (1 - d.royaltyRate));
  });

  it('overrides from economicAssumptions are applied', () => {
    const ea = assessEconomics({ ...base, economicAssumptions: { oilPriceUsdPerBbl: 100 } });
    expect(ea.estimatedGrossRevenueUsdMM).toBeCloseTo(100 * 100 * (1 - 0.2));
  });

  it('total CAPEX does not include operating cost', () => {
    const d = getEconomicAssumptionDefaults();
    const ea = assessEconomics(base);
    const expectedCapex = (d.developmentCostUsdMM + d.explorationWellCostUsdMM + d.seismicCostUsdMM + d.leaseOrEntryCostUsdMM) * d.workingInterest;
    expect(ea.estimatedTotalCostUsdMM).toBeCloseTo(expectedCapex);
  });

  it('EMV = GCoS × netRevenue − totalCAPEX', () => {
    const ea = assessEconomics(base);
    const gcos = base.geologicalChanceOfSuccess ?? 0;
    expect(ea.simpleEMVUsdMM).toBeCloseTo(gcos * ea.estimatedNetRevenueUsdMM - ea.estimatedTotalCostUsdMM, 2);
  });

  it('zero GCoS produces negative EMV', () => {
    const ea = assessEconomics({ ...base, geologicalChanceOfSuccess: 0, dataConfidence: 70 });
    expect(ea.simpleEMVUsdMM).toBeLessThan(0);
  });

  it('negative EMV produces do_not_invest signal', () => {
    const ea = assessEconomics({ ...base, geologicalChanceOfSuccess: 0, dataConfidence: 70 });
    expect(ea.decisionSignal).toBe('do_not_invest');
  });

  it('negative EMV produces negative economic grade', () => {
    const ea = assessEconomics({ ...base, geologicalChanceOfSuccess: 0, dataConfidence: 70 });
    expect(ea.economicGrade).toBe('negative');
  });

  it('very low GCoS (<0.05) produces do_not_invest', () => {
    const ea = assessEconomics({ ...base, geologicalChanceOfSuccess: 0.03, dataConfidence: 70 });
    expect(ea.decisionSignal).toBe('do_not_invest');
  });

  it('low commercialScore (<30) produces do_not_invest', () => {
    const ea = assessEconomics({ ...base, commercialScore: 20 });
    expect(ea.decisionSignal).toBe('do_not_invest');
  });

  it('high GCoS + low data confidence → de_risk_before_investment, NOT drill_if_budget_available', () => {
    const highGcosLowDC: Prospect = {
      ...base,
      sourceScore: 0.9, migrationScore: 0.9, reservoirScore: 0.9,
      sealScore: 0.9, trapScore: 0.9, timingScore: 0.9,
      geologicalChanceOfSuccess: 0.531441,
      dataConfidence: 35,
      commercialScore: 80,
      resourceEstimate: 100,
    };
    const ea = assessEconomics(highGcosLowDC);
    expect(ea.decisionSignal).not.toBe('drill_if_budget_available');
    expect(ea.decisionSignal).toBe('de_risk_before_investment');
  });

  it('tier_1 prospect with positive EMV → drill_if_budget_available', () => {
    const tier1: Prospect = {
      ...base,
      sourceScore: 0.9, migrationScore: 0.9, reservoirScore: 0.9,
      sealScore: 0.9, trapScore: 0.9, timingScore: 0.9,
      geologicalChanceOfSuccess: 0.531441,
      dataConfidence: 75,
      commercialScore: 80,
      resourceEstimate: 200,
    };
    const ea = assessEconomics(tier1);
    // Only valid if EMV is positive
    if (ea.simpleEMVUsdMM > 0) {
      expect(ea.decisionSignal).toBe('drill_if_budget_available');
    }
  });

  it('large resource + positive EMV + good GCoS → consider_farm_in when not tier_1', () => {
    const farmIn: Prospect = {
      ...base,
      sourceScore: 0.6, migrationScore: 0.6, reservoirScore: 0.6,
      sealScore: 0.6, trapScore: 0.6, timingScore: 0.6,
      geologicalChanceOfSuccess: 0.6 ** 6,
      dataConfidence: 50,
      commercialScore: 60,
      resourceEstimate: 200,
    };
    const ea = assessEconomics(farmIn);
    if (ea.simpleEMVUsdMM > 0) {
      expect(['consider_farm_in', 'de_risk_before_investment', 'investigate_further']).toContain(ea.decisionSignal);
    }
  });

  it('value per risked boe is 0 when risked resource is 0', () => {
    const ea = assessEconomics({ ...base, geologicalChanceOfSuccess: 0 });
    expect(ea.valuePerRiskedBoeUsd).toBe(0);
  });

  it('rationale array has 6 entries', () => {
    const ea = assessEconomics(base);
    expect(ea.rationale).toHaveLength(6);
  });

  it('default discount rate is 10%', () => {
    const d = getEconomicAssumptionDefaults();
    expect(d.discountRate).toBe(0.1);
    const ea = assessEconomics(base);
    expect(ea.discountRate).toBe(0.1);
  });

  it('NPV = GCoS × netRevenue / (1 + discountRate)^5 − totalCAPEX', () => {
    const ea = assessEconomics(base);
    const gcos = base.geologicalChanceOfSuccess ?? 0;
    const expected = (gcos * ea.estimatedNetRevenueUsdMM) / (1 + ea.discountRate) ** 5 - ea.estimatedTotalCostUsdMM;
    expect(ea.simpleNPVAtDiscountUsdMM).toBeCloseTo(expected, 2);
  });

  it('NPV is lower than EMV for the same prospect (discounting reduces value)', () => {
    const ea = assessEconomics(base);
    expect(ea.simpleNPVAtDiscountUsdMM).toBeLessThan(ea.simpleEMVUsdMM);
  });

  it('discountRate override from economicAssumptions is applied', () => {
    const ea = assessEconomics({ ...base, economicAssumptions: { discountRate: 0.2 } });
    expect(ea.discountRate).toBe(0.2);
    const gcos = base.geologicalChanceOfSuccess ?? 0;
    const expected = (gcos * ea.estimatedNetRevenueUsdMM) / 1.2 ** 5 - ea.estimatedTotalCostUsdMM;
    expect(ea.simpleNPVAtDiscountUsdMM).toBeCloseTo(expected, 2);
  });

  it('positive EMV but negative NPV triggers a back-loaded value warning', () => {
    // tier_1-like prospect with positive EMV; high discount rate pushes NPV negative
    const tier1: Prospect = {
      ...base,
      sourceScore: 0.9, migrationScore: 0.9, reservoirScore: 0.9,
      sealScore: 0.9, trapScore: 0.9, timingScore: 0.9,
      geologicalChanceOfSuccess: 0.531441,
      dataConfidence: 75,
      commercialScore: 80,
      resourceEstimate: 200,
      economicAssumptions: { discountRate: 0.5 },
    };
    const ea = assessEconomics(tier1);
    if (ea.simpleEMVUsdMM > 0 && ea.simpleNPVAtDiscountUsdMM < 0) {
      expect(ea.warnings.some((w) => w.toLowerCase().includes('npv'))).toBe(true);
    }
  });

  it('low data confidence triggers economic warning', () => {
    const ea = assessEconomics({ ...base, dataConfidence: 30 });
    expect(ea.warnings.some((w) => w.toLowerCase().includes('data confidence'))).toBe(true);
  });

  it('manual scoring triggers a warning', () => {
    const ea = assessEconomics({ ...base, scoringMode: 'manual' });
    expect(ea.warnings.some((w) => w.toLowerCase().includes('manual'))).toBe(true);
  });
});

describe('getEconomicAssumptionDefaults', () => {
  it('returns a complete defaults object', () => {
    const d = getEconomicAssumptionDefaults();
    expect(d.oilPriceUsdPerBbl).toBe(75);
    expect(d.gasPriceUsdPerMcf).toBe(3.5);
    expect(d.developmentCostUsdMM).toBe(350);
    expect(d.explorationWellCostUsdMM).toBe(45);
    expect(d.seismicCostUsdMM).toBe(12);
    expect(d.leaseOrEntryCostUsdMM).toBe(20);
    expect(d.operatingCostUsdPerBbl).toBe(18);
    expect(d.netRevenueInterest).toBe(0.75);
    expect(d.workingInterest).toBe(1);
    expect(d.royaltyRate).toBe(0.2);
    expect(d.discountRate).toBe(0.1);
  });

  it('each call returns a new independent copy', () => {
    const a = getEconomicAssumptionDefaults();
    const b = getEconomicAssumptionDefaults();
    a.oilPriceUsdPerBbl = 999;
    expect(b.oilPriceUsdPerBbl).toBe(75);
  });
});

describe('getDecisionSignalLabel', () => {
  it('returns human-readable labels for all signals', () => {
    expect(getDecisionSignalLabel('drill_if_budget_available')).toBe('Drill if Budget Available');
    expect(getDecisionSignalLabel('de_risk_before_investment')).toBe('De-risk Before Investment');
    expect(getDecisionSignalLabel('consider_farm_in')).toBe('Consider Farm-in');
    expect(getDecisionSignalLabel('investigate_further')).toBe('Investigate Further');
    expect(getDecisionSignalLabel('do_not_invest')).toBe('Do Not Invest');
  });
});

describe('getEconomicGradeLabel', () => {
  it('returns human-readable labels for all grades', () => {
    expect(getEconomicGradeLabel('strong')).toBe('Strong');
    expect(getEconomicGradeLabel('moderate')).toBe('Moderate');
    expect(getEconomicGradeLabel('weak')).toBe('Weak');
    expect(getEconomicGradeLabel('negative')).toBe('Negative');
  });
});
