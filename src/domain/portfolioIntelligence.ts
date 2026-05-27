import type { Prospect } from './prospect';
import {
  getPortfolioRecommendations,
  getProspectivityTier,
  getRecommendedAction,
  type TargetingRecommendation,
} from './recommendationEngine';

export type PortfolioSummary = {
  totalProspects: number;
  tier1Count: number;
  tier2Count: number;
  tier3Count: number;
  tier4Count: number;
  drillCandidateCount: number;
  uncertaintyReductionCount: number;
  farmInCandidateCount: number;
  averageDataConfidence: number;
  portfolioMainRisk: string;
  topProspects: string[];
  keyRecommendations: string[];
};

const uncertaintyReductionActions = new Set([
  'acquire_additional_seismic',
  'validate_reservoir_quality',
  'validate_seal_continuity',
  'improve_timing_model',
]);

const farmInActions = new Set(['farm_in_candidate', 'acreage_review']);

export const getPortfolioMainRisk = (prospects: Prospect[]): string => {
  if (!prospects.length) return 'unknown';
  const riskCount = prospects.reduce<Record<string, number>>((acc, p) => {
    const risk = p.mainRisk ?? 'unknown';
    acc[risk] = (acc[risk] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(riskCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';
};

export const getTopDrillCandidates = (prospects: Prospect[]): Prospect[] =>
  prospects.filter((p) => getRecommendedAction(p) === 'drill_candidate')
    .sort((a, b) => (b.geologicalChanceOfSuccess ?? 0) - (a.geologicalChanceOfSuccess ?? 0));

export const getUncertaintyReductionCandidates = (prospects: Prospect[]): Prospect[] =>
  prospects.filter((p) => uncertaintyReductionActions.has(getRecommendedAction(p)))
    .sort((a, b) => (b.geologicalChanceOfSuccess ?? 0) - (a.geologicalChanceOfSuccess ?? 0));

export const getFarmInCandidates = (prospects: Prospect[]): Prospect[] =>
  prospects.filter((p) => farmInActions.has(getRecommendedAction(p)))
    .sort((a, b) => b.resourceEstimate - a.resourceEstimate);

export const getHighGCoSLowConfidenceProspects = (prospects: Prospect[]): Prospect[] =>
  prospects.filter((p) => (p.geologicalChanceOfSuccess ?? 0) >= 0.25 && (p.dataConfidence ?? 0) < 60)
    .sort((a, b) => (b.geologicalChanceOfSuccess ?? 0) - (a.geologicalChanceOfSuccess ?? 0));

const buildKeyRecommendations = (
  prospects: Prospect[],
  recs: TargetingRecommendation[],
  summary: Omit<PortfolioSummary, 'keyRecommendations'>
): string[] => {
  const lines: string[] = [];

  const drillNames = recs.filter((r) => r.action === 'drill_candidate').map((r) => r.prospectName);
  if (drillNames.length) {
    lines.push(`Advance ${drillNames.slice(0, 2).join(' and ')} to well planning — all quality gates met.`);
  }

  const highGCoSLowDC = getHighGCoSLowConfidenceProspects(prospects);
  if (highGCoSLowDC.length) {
    const names = highGCoSLowDC.slice(0, 2).map((p) => p.name).join(' and ');
    lines.push(`${names} show strong GCoS but low data confidence — acquire data before committing.`);
  }

  const uncertainty = recs.filter((r) => uncertaintyReductionActions.has(r.action)).length;
  if (uncertainty > 0) {
    lines.push(`${uncertainty} prospect${uncertainty > 1 ? 's' : ''} require uncertainty reduction before tier upgrade — target ${summary.portfolioMainRisk} risk first.`);
  }

  const farmIn = recs.filter((r) => farmInActions.has(r.action)).length;
  if (farmIn > 0) {
    lines.push(`${farmIn} farm-in or acreage opportunity${farmIn > 1 ? 's' : ''} identified — evaluate deal terms.`);
  }

  if (summary.tier4Count > 0) {
    lines.push(`${summary.tier4Count} low-prospectivity prospect${summary.tier4Count > 1 ? 's' : ''} should not receive near-term investment until new evidence emerges.`);
  }

  return lines.slice(0, 5);
};

export const getPortfolioSummary = (prospects: Prospect[]): PortfolioSummary => {
  if (!prospects.length) {
    return {
      totalProspects: 0,
      tier1Count: 0, tier2Count: 0, tier3Count: 0, tier4Count: 0,
      drillCandidateCount: 0, uncertaintyReductionCount: 0, farmInCandidateCount: 0,
      averageDataConfidence: 0,
      portfolioMainRisk: 'unknown',
      topProspects: [],
      keyRecommendations: [],
    };
  }

  const recs = getPortfolioRecommendations(prospects);
  const tierCounts = { tier_1: 0, tier_2: 0, tier_3: 0, tier_4: 0 };
  prospects.forEach((p) => { tierCounts[getProspectivityTier(p)]++; });

  const drillCandidateCount = recs.filter((r) => r.action === 'drill_candidate').length;
  const uncertaintyReductionCount = recs.filter((r) => uncertaintyReductionActions.has(r.action)).length;
  const farmInCandidateCount = recs.filter((r) => farmInActions.has(r.action)).length;
  const averageDataConfidence = Math.round(
    prospects.reduce((acc, p) => acc + (p.dataConfidence ?? 0), 0) / prospects.length
  );
  const portfolioMainRisk = getPortfolioMainRisk(prospects);
  const topProspects = recs.slice(0, 3).map((r) => r.prospectName);

  const partial = {
    totalProspects: prospects.length,
    tier1Count: tierCounts.tier_1,
    tier2Count: tierCounts.tier_2,
    tier3Count: tierCounts.tier_3,
    tier4Count: tierCounts.tier_4,
    drillCandidateCount,
    uncertaintyReductionCount,
    farmInCandidateCount,
    averageDataConfidence,
    portfolioMainRisk,
    topProspects,
  };

  return { ...partial, keyRecommendations: buildKeyRecommendations(prospects, recs, partial) };
};
