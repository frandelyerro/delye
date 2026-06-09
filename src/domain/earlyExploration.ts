import type { Prospect } from './prospect';
import { getProspectivityTier } from './recommendationEngine';

export type ExplorationStage =
  | 'concept_lead'
  | 'lead'
  | 'prospect'
  | 'drill_ready_candidate'
  | 'appraisal_candidate';

const stageLabels: Record<ExplorationStage, string> = {
  concept_lead: 'Concept Lead',
  lead: 'Lead',
  prospect: 'Prospect',
  drill_ready_candidate: 'Drill-Ready Candidate',
  appraisal_candidate: 'Appraisal Candidate',
};

export const getExplorationStageLabel = (stage: ExplorationStage): string => stageLabels[stage];

export const getExplorationStage = (prospect: Prospect): ExplorationStage => {
  const gcos = prospect.geologicalChanceOfSuccess ?? 0;
  const dc = prospect.dataConfidence ?? 0;
  const tier = getProspectivityTier(prospect);

  // Highest maturity: tier_1 with large resource → appraisal required before development
  if (gcos >= 0.35 && dc >= 70 && prospect.resourceEstimate >= 200 && prospect.commercialScore >= 80) {
    return 'appraisal_candidate';
  }

  // Drill-ready: strong GCoS, high confidence, and no single component critically weak.
  // Industry practice: all six components must individually exceed 0.25 — a high composite GCoS
  // can otherwise mask a fatal single-component risk (e.g., absent seal).
  const minComponent = Math.min(
    prospect.sourceScore, prospect.migrationScore, prospect.reservoirScore,
    prospect.sealScore, prospect.trapScore, prospect.timingScore,
  );
  if (gcos >= 0.35 && dc >= 70 && tier === 'tier_1' && minComponent >= 0.25) {
    return 'drill_ready_candidate';
  }

  // Prospect: evidence-derived with defined trap and sufficient data for technical evaluation
  if (
    prospect.scoringMode === 'evidence_derived' &&
    dc >= 40 &&
    prospect.trapScore >= 0.40
  ) {
    return 'prospect';
  }

  // Lead: GCoS suggests viable system but not yet fully defined
  if (gcos >= 0.10 || (prospect.resourceEstimate >= 50 && dc >= 30)) {
    return 'lead';
  }

  return 'concept_lead';
};

type ExplorationMaturity = {
  stage: ExplorationStage;
  stageLabel: string;
  readinessScore: number;
  summary: string;
};

export const assessExplorationMaturity = (prospect: Prospect): ExplorationMaturity => {
  const stage = getExplorationStage(prospect);
  const gcos = prospect.geologicalChanceOfSuccess ?? 0;
  const dc = prospect.dataConfidence ?? 0;

  // Readiness 0–100: composite of GCoS, commercial, data confidence
  const readinessScore = Math.round(
    (Math.min(gcos / 0.40, 1) * 40) +
    (Math.min(prospect.commercialScore / 100, 1) * 30) +
    (Math.min(dc / 100, 1) * 30)
  );

  const summaries: Record<ExplorationStage, string> = {
    concept_lead: 'Early-stage concept. Insufficient data to define a drillable lead. Basin screening recommended.',
    lead: 'Viable petroleum system components identified. Trap mapping or data acquisition needed to mature to prospect.',
    prospect: 'Drillable location identified with defined trap and reasonable geological support. Technical work ongoing.',
    drill_ready_candidate: 'All petroleum system components adequately defined. Ready for well planning and FID process.',
    appraisal_candidate: 'High-confidence discovery or large-resource prospect. Multi-well appraisal required before development.',
  };

  return { stage, stageLabel: stageLabels[stage], readinessScore, summary: summaries[stage] };
};

export const getDataGaps = (prospect: Prospect): string[] => {
  const gaps: string[] = [];
  const dc = prospect.dataConfidence ?? 0;

  if (prospect.scoringMode !== 'evidence_derived') {
    gaps.push('No structured evidence model — add geological evidence to enable the Geoscience Intelligence Engine');
  }

  if (prospect.trapScore < 0.50) gaps.push('Trap definition incomplete — structural closure mapping required');
  if (prospect.sourceScore < 0.50) gaps.push('Source rock quality uncertain — TOC and maturity data needed');
  if (prospect.reservoirScore < 0.50) gaps.push('Reservoir quality uncertain — petrophysical data required');
  if (prospect.sealScore < 0.50) gaps.push('Seal integrity uncertain — fault seal and top seal analysis needed');
  if (prospect.migrationScore < 0.50) gaps.push('Migration pathway uncertain — carrier bed and fault connectivity data needed');
  if (prospect.timingScore < 0.50) gaps.push('Charge timing uncertain — burial history modelling needed');
  if (dc < 50) gaps.push(`Low data confidence (${dc}/100) — input completeness and consistency should be improved`);

  if (prospect.geoscienceAssessment?.recommendedNextData?.length) {
    prospect.geoscienceAssessment.recommendedNextData.forEach((item) => {
      if (!gaps.includes(item)) gaps.push(item);
    });
  }

  return gaps;
};

export const getEarlyExplorationRecommendation = (prospect: Prospect): string => {
  const stage = getExplorationStage(prospect);
  const maturity = assessExplorationMaturity(prospect);
  const gaps = getDataGaps(prospect);
  const gapCount = gaps.length;

  const base = `${prospect.name} is classified as a ${maturity.stageLabel} (readiness ${maturity.readinessScore}/100). ${maturity.summary}`;
  if (gapCount === 0) return `${base} No critical data gaps identified.`;
  const topGaps = gaps.slice(0, 3).join('; ');
  return `${base} Key data gaps: ${topGaps}${gapCount > 3 ? ` and ${gapCount - 3} more` : ''}.`;
};
