export type EconomicAssumptions = {
  oilPriceUsdPerBbl?: number;
  gasPriceUsdPerMcf?: number;
  developmentCostUsdMM?: number;
  explorationWellCostUsdMM?: number;
  seismicCostUsdMM?: number;
  leaseOrEntryCostUsdMM?: number;
  operatingCostUsdPerBbl?: number;
  netRevenueInterest?: number;
  workingInterest?: number;
  royaltyRate?: number;
};

export type EconomicAssessment = {
  unriskedResourceMMboe: number;
  riskedResourceMMboe: number;
  estimatedGrossRevenueUsdMM: number;
  estimatedNetRevenueUsdMM: number;
  estimatedTotalCostUsdMM: number;
  simpleEMVUsdMM: number;
  valuePerRiskedBoeUsd: number;
  economicGrade: 'strong' | 'moderate' | 'weak' | 'negative';
  decisionSignal: 'investigate_further' | 'de_risk_before_investment' | 'consider_farm_in' | 'drill_if_budget_available' | 'do_not_invest';
  rationale: string[];
  warnings: string[];
};
