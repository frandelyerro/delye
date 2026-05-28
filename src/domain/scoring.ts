import { MainRisk, Priority, Prospect, validateProspect } from './prospect';
import {
  calculateDataConfidence,
  componentMap,
  componentNames,
  getGCoSInterpretation,
  getRecommendedNextStep,
  getStrongestComponents,
  getWeakestComponent
} from './explainability';
import { recommendationByPriority } from './recommendations';
import { assessPetroleumSystem } from './geoscienceEngine';
import { assessEconomics } from './economics';
import type { EvidenceConfidence, GeoscienceAssessment } from './evidence';
import type { EconomicAssessment } from './economicTypes';

// Penalty applied to dataConfidence for evidence-derived prospects based on overall evidence quality.
// Manual scoring path is unaffected.
const evidenceConfidencePenalty: Record<EvidenceConfidence, number> = {
  high: 0, medium: -15, low: -30, unknown: -50,
};

const assertValidProspect = (prospect: Prospect) => {
  const errors = validateProspect(prospect);
  if (errors.length > 0) {
    throw new Error(`Invalid prospect ${prospect.name || prospect.id}: ${errors.join('; ')}`);
  }
};

export const calculateGCoS = (prospect: Prospect): number => {
  assertValidProspect(prospect);
  return componentNames.reduce((acc, key) => acc * Number(prospect[componentMap[key]]), 1);
};

export const getMainRisk = (prospect: Prospect): MainRisk => {
  assertValidProspect(prospect);
  return getWeakestComponent(prospect);
};

export const getPriority = (prospect: Prospect): Priority => {
  assertValidProspect(prospect);
  const gcos = prospect.geologicalChanceOfSuccess ?? calculateGCoS(prospect);
  if (gcos >= 0.35 && prospect.commercialScore >= 70) return 'high';
  if (gcos >= 0.18) return 'medium';
  return 'low';
};

export const getRecommendation = (prospect: Prospect): string => {
  const priority = prospect.priority ?? getPriority(prospect);
  return recommendationByPriority[priority];
};

export const generateExplanation = (prospect: Prospect): string => {
  assertValidProspect(prospect);
  const strongest = getStrongestComponents(prospect);
  const weakest = getWeakestComponent(prospect);
  const highResource = prospect.resourceEstimate >= 100;
  const commercialSupport = prospect.commercialScore >= 70;
  const recommendation = getRecommendation(prospect);
  const interpretation = getGCoSInterpretation(prospect);
  const strongestText = strongest.join(' and ');

  return `${prospect.name} shows strongest petroleum system support in ${strongestText}. ` +
    `Primary uncertainty is ${weakest}, which is the weakest component. ` +
    `${highResource ? 'Resource potential is high for portfolio impact.' : 'Resource potential is moderate and should be calibrated carefully.'} ` +
    `${commercialSupport ? 'Commercial score supports advancement.' : 'Commercial score does not fully support immediate advancement.'} ` +
    `${interpretation} ` +
    `Recommended next step: ${getRecommendedNextStep(prospect)} ` +
    `Recommendation: ${recommendation}.`;
};

export const scoreProspect = (prospect: Prospect): Prospect => {
  let workingProspect = prospect;
  let geoscienceAssessment: GeoscienceAssessment | undefined;

  if (prospect.scoringMode === 'evidence_derived' && prospect.evidence) {
    geoscienceAssessment = assessPetroleumSystem(prospect.evidence, prospect.targetPhase);
    workingProspect = { ...prospect, ...geoscienceAssessment.derivedScores };
  }

  const geologicalChanceOfSuccess = calculateGCoS(workingProspect);
  const mainRisk = getMainRisk(workingProspect);
  const rawDataConfidence = calculateDataConfidence(workingProspect);
  // For evidence-derived prospects, adjust dataConfidence downward when overall evidence confidence is low.
  // This ensures that all-unknown or sparse evidence cannot produce a misleadingly high dataConfidence.
  // Manual scoring path is unaffected (geoscienceAssessment is undefined for manual).
  const dataConfidence = geoscienceAssessment
    ? Math.min(100, Math.max(0, rawDataConfidence + evidenceConfidencePenalty[geoscienceAssessment.overallConfidence]))
    : rawDataConfidence;
  const priority = getPriority({ ...workingProspect, geologicalChanceOfSuccess });
  const recommendation = getRecommendation({ ...workingProspect, geologicalChanceOfSuccess, priority });
  const explanation = generateExplanation({ ...workingProspect, geologicalChanceOfSuccess, priority, mainRisk, dataConfidence, recommendation });

  const scoredProspect: Prospect = {
    ...workingProspect,
    geologicalChanceOfSuccess,
    mainRisk,
    dataConfidence,
    priority,
    recommendation,
    explanation,
    ...(geoscienceAssessment ? { geoscienceAssessment } : {}),
  };

  const economicAssessment: EconomicAssessment = assessEconomics(scoredProspect);

  return { ...scoredProspect, economicAssessment };
};

export const scoreProspects = (prospects: Prospect[]): Prospect[] =>
  prospects.map(scoreProspect).sort((a, b) => (b.geologicalChanceOfSuccess ?? 0) - (a.geologicalChanceOfSuccess ?? 0));
