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
  /** Annual discount rate used for the simple NPV approximation (default 0.10 = 10%). */
  discountRate?: number;
};

export type EconomicAssessment = {
  unriskedResourceMMboe: number;
  riskedResourceMMboe: number;
  estimatedGrossRevenueUsdMM: number;
  estimatedNetRevenueUsdMM: number;
  estimatedTotalCostUsdMM: number;
  simpleEMVUsdMM: number;
  /** Discount rate applied to compute simpleNPVAtDiscountUsdMM (decimal, e.g. 0.10 = 10%). */
  discountRate: number;
  /**
   * Single-point NPV approximation: discounts the risked net revenue back from an assumed
   * realization year (5 years) at `discountRate`, then subtracts upfront CAPEX (undiscounted,
   * incurred at year 0). This is a simplification — there is no multi-year cash-flow timeline
   * in this model — and should be read as a directional indicator, not a full DCF.
   */
  simpleNPVAtDiscountUsdMM: number;
  valuePerRiskedBoeUsd: number;
  economicGrade: 'strong' | 'moderate' | 'weak' | 'negative';
  decisionSignal: 'investigate_further' | 'de_risk_before_investment' | 'consider_farm_in' | 'drill_if_budget_available' | 'do_not_invest';
  rationale: string[];
  warnings: string[];
};
