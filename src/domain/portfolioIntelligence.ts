import type { Prospect } from './prospect';
import { isGeologicalSuccess, isCommercialSuccess } from './outcomes';
import {
  getPortfolioRecommendations,
  getProspectivityTier,
  getRecommendedAction,
  type TargetingRecommendation,
} from './recommendationEngine';

// `?? 0` does not catch an explicit NaN (NaN is a `number`); these stats feed charts.
export const finiteGcos = (p: Prospect): number =>
  Number.isFinite(p.geologicalChanceOfSuccess) ? Math.max(0, p.geologicalChanceOfSuccess as number) : 0;

export type RiskConcentrationResult = {
  /** True when more than 50% of prospects share the same mainRisk */
  concentrated: boolean;
  /** The dominant mainRisk value, if concentrated */
  dominantRisk: string;
  /** Number of prospects with the dominant risk */
  dominantCount: number;
  /** Total prospects analysed */
  total: number;
  /** Percentage of prospects carrying the dominant risk (0–100) */
  dominantPct: number;
};

/**
 * Flags portfolio risk concentration: when >50% of prospects share the same
 * mainRisk the portfolio is vulnerable to a single play-level failure.
 */
export const getRiskConcentration = (prospects: Prospect[]): RiskConcentrationResult => {
  if (!prospects.length) {
    return { concentrated: false, dominantRisk: 'unknown', dominantCount: 0, total: 0, dominantPct: 0 };
  }
  const riskCount = prospects.reduce<Record<string, number>>((acc, p) => {
    const risk = p.mainRisk ?? 'unknown';
    acc[risk] = (acc[risk] ?? 0) + 1;
    return acc;
  }, {});
  const [dominantRisk, dominantCount] = Object.entries(riskCount).sort((a, b) => b[1] - a[1])[0];
  const dominantPct = Math.round((dominantCount / prospects.length) * 100);
  return {
    concentrated: dominantPct > 50,
    dominantRisk,
    dominantCount,
    total: prospects.length,
    dominantPct,
  };
};

export type GCoSBucket = {
  /** Label, e.g. "10–20%" */
  label: string;
  /** Number of prospects in this bucket */
  count: number;
  /** Bottom of bucket, 0–1 */
  min: number;
};

/**
 * Partitions prospects into 10 equal GCoS buckets (0–10%, 10–20%, … 90–100%).
 */
export const getGCoSHistogram = (prospects: Prospect[]): GCoSBucket[] => {
  const buckets: GCoSBucket[] = Array.from({ length: 10 }, (_, i) => ({
    label: `${i * 10}–${(i + 1) * 10}%`,
    count: 0,
    min: i / 10,
  }));
  for (const p of prospects) {
    const gcos = p.geologicalChanceOfSuccess ?? 0;
    const idx = Math.min(Math.floor(gcos * 10), 9);
    buckets[idx].count++;
  }
  return buckets;
};

export type BasinStats = {
  basin: string;
  count: number;
  avgGCoS: number;
  drillCandidates: number;
  avgDataConfidence: number;
};

/**
 * Builds per-basin summary statistics for the portfolio heatmap table.
 */
export const getBasinStats = (prospects: Prospect[]): BasinStats[] => {
  const basinMap = new Map<string, Prospect[]>();
  for (const p of prospects) {
    const basin = p.basin || 'Unknown';
    const existing = basinMap.get(basin) ?? [];
    existing.push(p);
    basinMap.set(basin, existing);
  }
  return Array.from(basinMap.entries())
    .map(([basin, ps]) => ({
      basin,
      count: ps.length,
      avgGCoS: Math.round(ps.reduce((s, p) => s + finiteGcos(p), 0) / ps.length * 100),
      drillCandidates: ps.filter((p) => getRecommendedAction(p) === 'drill_candidate').length,
      avgDataConfidence: Math.round(ps.reduce((s, p) => s + (p.dataConfidence ?? 0), 0) / ps.length),
    }))
    .sort((a, b) => b.avgGCoS - a.avgGCoS);
};

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

export type BasinDiversityResult = {
  /** Herfindahl-Hirschman Index (0–1). Lower = more diversified. */
  hhi: number;
  /** Normalised diversity score 0–100. Higher = more diversified. */
  diversityScore: number;
  /** Number of distinct basins */
  basinCount: number;
};

/**
 * Computes portfolio basin diversity using the Herfindahl-Hirschman Index.
 * HHI = sum of squared share fractions. diversityScore = (1 - HHI) * 100.
 */
export const getBasinDiversityIndex = (prospects: Prospect[]): BasinDiversityResult => {
  if (!prospects.length) return { hhi: 0, diversityScore: 0, basinCount: 0 };
  const counts = prospects.reduce<Record<string, number>>((acc, p) => {
    const b = p.basin || 'Unknown';
    acc[b] = (acc[b] ?? 0) + 1;
    return acc;
  }, {});
  const n = prospects.length;
  const hhi = Object.values(counts).reduce((sum, c) => sum + (c / n) ** 2, 0);
  return {
    hhi: Math.round(hhi * 100) / 100,
    diversityScore: Math.round((1 - hhi) * 100),
    basinCount: Object.keys(counts).length,
  };
};

export type DrillSequenceEntry = {
  rank: number;
  prospectId: string;
  prospectName: string;
  gcos: number;
  commercialScore: number;
  dataConfidence: number;
  /** Composite score: 50% GCoS + 30% commercial score + 20% data confidence (0–100 scale) */
  compositeScore: number;
};

/**
 * Orders prospects for drilling by a composite capital-efficiency score:
 * 50% GCoS + 30% commercial score (normalised /100) + 20% data confidence.
 */
export const getDrillSequenceOrder = (prospects: Prospect[], topN = 5): DrillSequenceEntry[] =>
  prospects
    .map((p) => ({
      rank: 0,
      prospectId: p.id,
      prospectName: p.name,
      gcos: Math.round((p.geologicalChanceOfSuccess ?? 0) * 100),
      commercialScore: p.commercialScore ?? 0,
      dataConfidence: p.dataConfidence ?? 0,
      compositeScore: Math.round(
        Math.max(0, Math.min(100,
          (p.geologicalChanceOfSuccess ?? 0) * 50 +
          ((p.commercialScore ?? 0) / 100) * 30 +
          ((p.dataConfidence ?? 0) / 100) * 20,
        )),
      ),
    }))
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, topN)
    .map((e, i) => ({ ...e, rank: i + 1 }));

export type OutcomeStats = {
  totalDrilled: number;
  commercialDiscoveries: number;
  technicalDiscoveries: number;
  dryHoles: number;
  nonCommercial: number;
  /** Geological success rate (commercial + technical) as 0-100 */
  geologicalSuccessRate: number;
  /** Commercial success rate as 0-100 */
  commercialSuccessRate: number;
  totalResourceDiscoveredMMboe: number;
};

/** Aggregates recorded well outcomes across the portfolio. */
export const getOutcomeStats = (prospects: Prospect[]): OutcomeStats => {
  const drilled = prospects.filter((p) => p.outcome && p.outcome.label !== 'unknown');
  if (!drilled.length) {
    return { totalDrilled: 0, commercialDiscoveries: 0, technicalDiscoveries: 0, dryHoles: 0, nonCommercial: 0, geologicalSuccessRate: 0, commercialSuccessRate: 0, totalResourceDiscoveredMMboe: 0 };
  }
  const commercialDiscoveries = drilled.filter((p) => isCommercialSuccess(p.outcome!)).length;
  const technicalDiscoveries = drilled.filter((p) => isGeologicalSuccess(p.outcome!) && !isCommercialSuccess(p.outcome!)).length;
  const dryHoles = drilled.filter((p) => p.outcome!.label === 'dry_hole').length;
  const nonCommercial = drilled.filter((p) => p.outcome!.label === 'non_commercial').length;
  const geologicalSuccessRate = Math.round(((commercialDiscoveries + technicalDiscoveries) / drilled.length) * 100);
  const commercialSuccessRate = Math.round((commercialDiscoveries / drilled.length) * 100);
  const totalResourceDiscoveredMMboe = drilled
    .filter((p) => isGeologicalSuccess(p.outcome!))
    .reduce((sum, p) => sum + (p.resourceEstimate ?? 0), 0);
  return { totalDrilled: drilled.length, commercialDiscoveries, technicalDiscoveries, dryHoles, nonCommercial, geologicalSuccessRate, commercialSuccessRate, totalResourceDiscoveredMMboe };
};

export type OutcomeCalibrationBucket = {
  /** Label, e.g. "10–20%" */
  label: string;
  /** Bottom of bucket, 0–1 */
  min: number;
  /** Outcome-labeled prospects whose pre-drill GCoS falls in this bucket */
  drilled: number;
  /** Geological successes (commercial + technical discoveries) in this bucket */
  successes: number;
  /** Observed geological success rate for the bucket, 0–100 */
  actualSuccessRate: number;
  /** Bucket midpoint as 0–100 — what a perfectly calibrated GCoS would predict */
  expectedSuccessRate: number;
};

/**
 * Buckets outcome-labeled prospects by pre-drill expert GCoS (10% bins) and
 * compares the observed geological success rate against the bucket midpoint.
 * A well-calibrated portfolio has actual ≈ expected in every populated bucket
 * (Rose & Associates lookback methodology). Small buckets (<5 wells) are noisy.
 */
export const getOutcomeCalibration = (prospects: Prospect[]): OutcomeCalibrationBucket[] => {
  const buckets: OutcomeCalibrationBucket[] = Array.from({ length: 10 }, (_, i) => ({
    label: `${i * 10}–${(i + 1) * 10}%`,
    min: i / 10,
    drilled: 0,
    successes: 0,
    actualSuccessRate: 0,
    expectedSuccessRate: i * 10 + 5,
  }));
  for (const p of prospects) {
    if (!p.outcome || p.outcome.label === 'unknown') continue;
    const idx = Math.min(Math.floor(finiteGcos(p) * 10), 9);
    buckets[idx].drilled++;
    if (isGeologicalSuccess(p.outcome)) buckets[idx].successes++;
  }
  for (const b of buckets) {
    b.actualSuccessRate = b.drilled ? Math.round((b.successes / b.drilled) * 100) : 0;
  }
  return buckets;
};

export type GroupOutcomeStats = {
  group: string;
  drilled: number;
  geologicalSuccesses: number;
  commercialSuccesses: number;
  /** Observed geological success rate, 0–100 */
  geologicalSuccessRate: number;
  /** Observed commercial success rate, 0–100 */
  commercialSuccessRate: number;
  /** Average pre-drill expert GCoS of the drilled prospects, 0–100 */
  avgPredrillGcos: number;
};

const groupOutcomeStats = (prospects: Prospect[], keyOf: (p: Prospect) => string): GroupOutcomeStats[] => {
  const groups = new Map<string, Prospect[]>();
  for (const p of prospects) {
    if (!p.outcome || p.outcome.label === 'unknown') continue;
    const key = keyOf(p) || 'Unknown';
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([group, drilled]) => {
      const geologicalSuccesses = drilled.filter((p) => isGeologicalSuccess(p.outcome!)).length;
      const commercialSuccesses = drilled.filter((p) => isCommercialSuccess(p.outcome!)).length;
      return {
        group,
        drilled: drilled.length,
        geologicalSuccesses,
        commercialSuccesses,
        geologicalSuccessRate: Math.round((geologicalSuccesses / drilled.length) * 100),
        commercialSuccessRate: Math.round((commercialSuccesses / drilled.length) * 100),
        avgPredrillGcos: Math.round((drilled.reduce((s, p) => s + finiteGcos(p), 0) / drilled.length) * 100),
      };
    })
    .sort((a, b) => b.drilled - a.drilled);
};

/** Observed drilling success rates per basin (outcome-labeled prospects only). */
export const getBasinOutcomeStats = (prospects: Prospect[]): GroupOutcomeStats[] =>
  groupOutcomeStats(prospects, (p) => p.basin);

/** Observed drilling success rates per play type (outcome-labeled prospects only). */
export const getPlayTypeOutcomeStats = (prospects: Prospect[]): GroupOutcomeStats[] =>
  groupOutcomeStats(prospects, (p) => p.playType);
