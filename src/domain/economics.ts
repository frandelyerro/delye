import type { Prospect } from './prospect';
import { getProspectivityTier } from './recommendationEngine';
import type { EconomicAssumptions, EconomicAssessment } from './economicTypes';

export type { EconomicAssumptions, EconomicAssessment };

const DEFAULTS: Required<EconomicAssumptions> = {
  oilPriceUsdPerBbl: 75,
  gasPriceUsdPerMcf: 3.5,
  developmentCostUsdMM: 350,
  explorationWellCostUsdMM: 45,
  seismicCostUsdMM: 12,
  leaseOrEntryCostUsdMM: 20,
  operatingCostUsdPerBbl: 18,
  netRevenueInterest: 0.75,
  workingInterest: 1,
  royaltyRate: 0.2,
};

const mergeAssumptions = (overrides?: EconomicAssumptions): Required<EconomicAssumptions> => ({
  ...DEFAULTS,
  ...Object.fromEntries(Object.entries(overrides ?? {}).filter(([, v]) => v !== undefined && v !== null)),
});

export const getEconomicAssumptionDefaults = (): Required<EconomicAssumptions> => ({ ...DEFAULTS });

export const assessEconomics = (prospect: Prospect): EconomicAssessment => {
  const a = mergeAssumptions(prospect.economicAssumptions);
  const gcos = prospect.geologicalChanceOfSuccess ?? 0;
  const dc = prospect.dataConfidence ?? 0;

  const unriskedResourceMMboe = prospect.resourceEstimate;
  const riskedResourceMMboe = Math.max(0, unriskedResourceMMboe * gcos);

  // Gross revenue: resource × price × (1 − royalty) — before NRI/WI/OpEx
  const estimatedGrossRevenueUsdMM = unriskedResourceMMboe * a.oilPriceUsdPerBbl * (1 - a.royaltyRate);

  // Operating cost is only incurred on success, so it reduces net revenue (not total CAPEX)
  const operatingCostUsdMM = unriskedResourceMMboe * a.operatingCostUsdPerBbl * a.workingInterest;

  // Net revenue: after NRI, WI, and OpEx
  const estimatedNetRevenueUsdMM =
    estimatedGrossRevenueUsdMM * a.netRevenueInterest * a.workingInterest - operatingCostUsdMM;

  // Total CAPEX: exploration + development + seismic + lease — committed regardless of outcome
  const estimatedTotalCostUsdMM =
    (a.developmentCostUsdMM + a.explorationWellCostUsdMM + a.seismicCostUsdMM + a.leaseOrEntryCostUsdMM) *
    a.workingInterest;

  // Simple EMV = GCoS × Net Revenue − Total CAPEX
  const simpleEMVUsdMM = gcos * estimatedNetRevenueUsdMM - estimatedTotalCostUsdMM;

  const valuePerRiskedBoeUsd = riskedResourceMMboe > 0 ? simpleEMVUsdMM / riskedResourceMMboe : 0;

  // Economic grade
  const costBase = Math.max(1, estimatedTotalCostUsdMM);
  let economicGrade: EconomicAssessment['economicGrade'];
  if (simpleEMVUsdMM < 0) {
    economicGrade = 'negative';
  } else if (simpleEMVUsdMM / costBase >= 1.5 && simpleEMVUsdMM >= 100) {
    economicGrade = 'strong';
  } else if (simpleEMVUsdMM / costBase >= 0.5 && simpleEMVUsdMM >= 20) {
    economicGrade = 'moderate';
  } else {
    economicGrade = 'weak';
  }

  // Decision signal — ordered strictly by precedence
  // Rule: high GCoS + low dc must route to de_risk_before_investment, never drill_if_budget_available
  let decisionSignal: EconomicAssessment['decisionSignal'];
  if (simpleEMVUsdMM < 0 || gcos < 0.05 || prospect.commercialScore < 30) {
    decisionSignal = 'do_not_invest';
  } else if (getProspectivityTier(prospect) === 'tier_1' && dc >= 70 && simpleEMVUsdMM > 0) {
    // tier_1 already requires dc >= 70, but we check explicitly to be safe
    decisionSignal = 'drill_if_budget_available';
  } else if (gcos >= 0.18 && dc < 70) {
    decisionSignal = 'de_risk_before_investment';
  } else if (unriskedResourceMMboe >= 150 && simpleEMVUsdMM > 0 && gcos >= 0.15) {
    decisionSignal = 'consider_farm_in';
  } else {
    decisionSignal = 'investigate_further';
  }

  const royaltyPct = Math.round(a.royaltyRate * 100);
  const rationale: string[] = [
    `Unrisked resources: ${unriskedResourceMMboe.toFixed(0)} MMboe. Risked: ${riskedResourceMMboe.toFixed(1)} MMboe (${Math.round(gcos * 100)}% GCoS applied).`,
    `Gross revenue (after ${royaltyPct}% royalty): $${estimatedGrossRevenueUsdMM.toFixed(0)}M. Net revenue (NRI ${a.netRevenueInterest}, WI ${a.workingInterest}, less OpEx): $${estimatedNetRevenueUsdMM.toFixed(0)}M.`,
    `Total CAPEX: $${estimatedTotalCostUsdMM.toFixed(0)}M (development $${(a.developmentCostUsdMM * a.workingInterest).toFixed(0)}M + exploration $${(a.explorationWellCostUsdMM * a.workingInterest).toFixed(0)}M + seismic $${(a.seismicCostUsdMM * a.workingInterest).toFixed(0)}M + lease $${(a.leaseOrEntryCostUsdMM * a.workingInterest).toFixed(0)}M).`,
    `Simple EMV: $${simpleEMVUsdMM.toFixed(0)}M (${Math.round(gcos * 100)}% GCoS × $${estimatedNetRevenueUsdMM.toFixed(0)}M net − $${estimatedTotalCostUsdMM.toFixed(0)}M CAPEX).`,
    `Value per risked boe: $${valuePerRiskedBoeUsd.toFixed(1)}/boe. Economic grade: ${economicGrade}.`,
  ];

  const warnings: string[] = [];
  if (dc < 50) warnings.push('Low data confidence — economic estimates are highly uncertain.');
  if (gcos < 0.15) warnings.push('Low GCoS significantly discounts expected value.');
  if (unriskedResourceMMboe < 20) warnings.push('Small resource size — economics are sensitive to cost assumptions.');
  if (prospect.scoringMode !== 'evidence_derived') warnings.push('Manual scoring in use — no structured evidence model supports these scores.');
  if (simpleEMVUsdMM > 0 && dc < 70 && gcos >= 0.18) warnings.push('Positive EMV is tentative — data confidence gate not met. De-risk before committing capital.');

  return {
    unriskedResourceMMboe,
    riskedResourceMMboe,
    estimatedGrossRevenueUsdMM,
    estimatedNetRevenueUsdMM,
    estimatedTotalCostUsdMM,
    simpleEMVUsdMM,
    valuePerRiskedBoeUsd,
    economicGrade,
    decisionSignal,
    rationale,
    warnings,
  };
};

export const getDecisionSignalLabel = (signal: EconomicAssessment['decisionSignal']): string => ({
  drill_if_budget_available: 'Drill if Budget Available',
  de_risk_before_investment: 'De-risk Before Investment',
  consider_farm_in: 'Consider Farm-in',
  investigate_further: 'Investigate Further',
  do_not_invest: 'Do Not Invest',
}[signal]);

export const getEconomicGradeLabel = (grade: EconomicAssessment['economicGrade']): string => ({
  strong: 'Strong',
  moderate: 'Moderate',
  weak: 'Weak',
  negative: 'Negative',
}[grade]);
