import type { Prospect } from './prospect';

export type RecommendedAction =
  | 'drill_candidate'
  | 'appraisal_candidate'
  | 'acquire_additional_seismic'
  | 'validate_reservoir_quality'
  | 'validate_seal_continuity'
  | 'improve_timing_model'
  | 'acreage_review'
  | 'farm_in_candidate'
  | 'watchlist'
  | 'do_not_prioritize';

export type ProspectivityTier = 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';

export type TargetingRecommendation = {
  prospectId: string;
  prospectName: string;
  tier: ProspectivityTier;
  action: RecommendedAction;
  rationale: string;
  nextBestStep: string;
  riskFlags: string[];
};

const actionLabels: Record<RecommendedAction, string> = {
  drill_candidate: 'Drill Candidate',
  appraisal_candidate: 'Appraisal Candidate',
  acquire_additional_seismic: 'Acquire Additional Seismic',
  validate_reservoir_quality: 'Validate Reservoir Quality',
  validate_seal_continuity: 'Validate Seal Continuity',
  improve_timing_model: 'Improve Timing Model',
  acreage_review: 'Acreage Review',
  farm_in_candidate: 'Farm-in Candidate',
  watchlist: 'Watchlist',
  do_not_prioritize: 'Do Not Prioritize',
};

const tierLabels: Record<ProspectivityTier, string> = {
  tier_1: 'Tier 1 — High Prospectivity',
  tier_2: 'Tier 2 — Moderate Prospectivity',
  tier_3: 'Tier 3 — Contingent Prospectivity',
  tier_4: 'Tier 4 — Low Prospectivity',
};

export const getRecommendedActionLabel = (action: RecommendedAction): string =>
  actionLabels[action];

export const getTierLabel = (tier: ProspectivityTier): string => tierLabels[tier];

const minComponentScore = (p: Prospect): number =>
  Math.min(p.sourceScore, p.migrationScore, p.reservoirScore, p.sealScore, p.trapScore, p.timingScore);

export const getProspectivityTier = (prospect: Prospect): ProspectivityTier => {
  const gcos = prospect.geologicalChanceOfSuccess ?? 0;
  const dc = prospect.dataConfidence ?? 0;

  // Tier 1: strong across all four quality gates
  if (
    gcos >= 0.35 &&
    prospect.commercialScore >= 70 &&
    dc >= 70 &&
    minComponentScore(prospect) >= 0.40
  ) return 'tier_1';

  // Tier 2: proven potential but not yet tier_1 quality
  if (gcos >= 0.18 && dc >= 50) return 'tier_2';

  // Tier 3: either GCoS meets a minimum floor or resource scale justifies keeping it in portfolio
  if (gcos >= 0.10 || prospect.resourceEstimate >= 100) return 'tier_3';

  return 'tier_4';
};

export const getRecommendedAction = (prospect: Prospect): RecommendedAction => {
  const gcos = prospect.geologicalChanceOfSuccess ?? 0;
  const dc = prospect.dataConfidence ?? 0;
  const tier = getProspectivityTier(prospect);

  // Hard floor — commercial or geological viability too low
  if (prospect.commercialScore < 30 || gcos < 0.05) return 'do_not_prioritize';

  // Tier 1 already guarantees dc >= 70, so drill_candidate is safe here
  if (tier === 'tier_1') {
    // Very large accumulation — needs multi-well appraisal before full commitment
    if (prospect.resourceEstimate >= 200 && prospect.commercialScore >= 80) return 'appraisal_candidate';
    return 'drill_candidate';
  }

  // Good GCoS but insufficient data confidence → must acquire data, never drill
  if (gcos >= 0.25 && dc < 50) return 'acquire_additional_seismic';

  // Risk-specific de-risking (applies to tier_2 / tier_3)
  if (prospect.mainRisk === 'trap') return 'acquire_additional_seismic';
  if (prospect.mainRisk === 'reservoir') return 'validate_reservoir_quality';
  if (prospect.mainRisk === 'seal') return 'validate_seal_continuity';
  if (prospect.mainRisk === 'timing') return 'improve_timing_model';

  // High resource + moderate GCoS → attractive for farm-in or acreage deal
  if (prospect.resourceEstimate >= 150 && gcos >= 0.15) return 'farm_in_candidate';
  if (prospect.resourceEstimate >= 100 && gcos >= 0.15) return 'acreage_review';

  // Some potential but evidence too sparse for action → hold on watchlist
  if (gcos >= 0.10) return 'watchlist';

  return 'do_not_prioritize';
};

const nextStepByAction: Record<RecommendedAction, string> = {
  drill_candidate: 'Advance to well planning and final investment decision.',
  appraisal_candidate: 'Design multi-well appraisal program to define resource range.',
  acquire_additional_seismic: 'Acquire and process new seismic data to improve structural and stratigraphic confidence.',
  validate_reservoir_quality: 'Run petrophysical study or analogue data review to characterize reservoir quality.',
  validate_seal_continuity: 'Conduct fault seal analysis and regional top seal integrity review.',
  improve_timing_model: 'Commission burial history and charge-timing modelling to reduce timing risk.',
  acreage_review: 'Review acreage position and assess strategic options.',
  farm_in_candidate: 'Evaluate farm-in terms and technical due diligence package.',
  watchlist: 'Monitor basin activity and revisit when new regional data becomes available.',
  do_not_prioritize: 'No immediate action. Retain in low-priority inventory.',
};

export const getNextBestStep = (prospect: Prospect): string =>
  nextStepByAction[getRecommendedAction(prospect)];

export const getTierRationale = (prospect: Prospect): string => {
  const gcos = prospect.geologicalChanceOfSuccess ?? 0;
  const dc = prospect.dataConfidence ?? 0;
  const tier = getProspectivityTier(prospect);
  switch (tier) {
    case 'tier_1':
      return `GCoS ${Math.round(gcos * 100)}% meets the high-confidence threshold. Commercial score ${prospect.commercialScore} and data confidence ${dc}/100 both support immediate action.`;
    case 'tier_2':
      return `GCoS ${Math.round(gcos * 100)}% shows real potential. Data confidence ${dc}/100 indicates some uncertainty remains before committing to a well.`;
    case 'tier_3':
      return `GCoS ${Math.round(gcos * 100)}% is below the medium threshold or data confidence ${dc}/100 is insufficient. Resource scale or basin position keeps this in the portfolio.`;
    case 'tier_4':
      return `GCoS ${Math.round(gcos * 100)}% is very low or data quality ${dc}/100 does not support any near-term investment decision.`;
  }
};

export const getRiskFlags = (prospect: Prospect): string[] => {
  const flags: string[] = [];
  const gcos = prospect.geologicalChanceOfSuccess ?? 0;
  const dc = prospect.dataConfidence ?? 0;

  if (gcos >= 0.35 && dc < 70) flags.push('High GCoS but low data confidence — do not drill without additional data');
  if (dc < 40) flags.push(`Low data confidence (${dc}/100) — scoring inputs may be incomplete`);
  if (prospect.sealScore < 0.40) flags.push('Critical seal risk — seal score below minimum threshold');
  if (prospect.trapScore < 0.40) flags.push('Critical trap risk — structural closure not adequately defined');
  if (prospect.reservoirScore < 0.40) flags.push('Critical reservoir risk — reservoir quality highly uncertain');
  if (prospect.sourceScore < 0.40) flags.push('Critical source risk — source presence or maturity uncertain');
  if (prospect.timingScore < 0.40) flags.push('Critical timing risk — charge timing model unreliable');
  if (prospect.migrationScore < 0.40) flags.push('Critical migration risk — migration pathway poorly defined');
  if (prospect.commercialScore < 50) flags.push('Marginal commercial score — economic viability uncertain');
  if (prospect.scoringMode !== 'evidence_derived') flags.push('Manual scoring — no structured evidence model; confidence reflects input consistency only');

  return flags;
};

export const getTargetingRecommendation = (prospect: Prospect): TargetingRecommendation => ({
  prospectId: prospect.id,
  prospectName: prospect.name,
  tier: getProspectivityTier(prospect),
  action: getRecommendedAction(prospect),
  rationale: getTierRationale(prospect),
  nextBestStep: getNextBestStep(prospect),
  riskFlags: getRiskFlags(prospect),
});

export const getPortfolioRecommendations = (prospects: Prospect[]): TargetingRecommendation[] =>
  [...prospects]
    .sort((a, b) => (b.geologicalChanceOfSuccess ?? 0) - (a.geologicalChanceOfSuccess ?? 0))
    .map(getTargetingRecommendation);
