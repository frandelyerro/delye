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
  const geologicalChanceOfSuccess = calculateGCoS(prospect);
  const mainRisk = getMainRisk(prospect);
  const dataConfidence = calculateDataConfidence(prospect);
  const priority = getPriority({ ...prospect, geologicalChanceOfSuccess });
  const recommendation = getRecommendation({ ...prospect, geologicalChanceOfSuccess, priority });
  const explanation = generateExplanation({ ...prospect, geologicalChanceOfSuccess, priority, mainRisk, dataConfidence, recommendation });
  return { ...prospect, geologicalChanceOfSuccess, mainRisk, dataConfidence, priority, recommendation, explanation };
};

export const scoreProspects = (prospects: Prospect[]): Prospect[] =>
  prospects.map(scoreProspect).sort((a, b) => (b.geologicalChanceOfSuccess ?? 0) - (a.geologicalChanceOfSuccess ?? 0));
