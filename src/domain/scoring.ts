import { MainRisk, Priority, Prospect, validateProspect } from './prospect';
import { recommendationByPriority } from './recommendations';

const componentMap: Record<MainRisk, keyof Prospect> = {
  source: 'sourceScore',
  migration: 'migrationScore',
  reservoir: 'reservoirScore',
  seal: 'sealScore',
  trap: 'trapScore',
  timing: 'timingScore'
};

const componentNames = Object.keys(componentMap) as MainRisk[];

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
  return componentNames.reduce((lowest, key) =>
    Number(prospect[componentMap[key]]) < Number(prospect[componentMap[lowest]]) ? key : lowest
  , 'source');
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
  const rankedComponents = componentNames
    .map((k) => ({ key: k, value: Number(prospect[componentMap[k]]) }))
    .sort((a, b) => b.value - a.value);

  const strongest = rankedComponents.slice(0, 2).map((x) => x.key).join(' and ');
  const weakest = rankedComponents[rankedComponents.length - 1]?.key ?? 'seal';
  const highResource = prospect.resourceEstimate >= 100;
  const commercialSupport = prospect.commercialScore >= 70;
  const recommendation = getRecommendation(prospect);

  return `${prospect.name} shows strongest petroleum system support in ${strongest}. ` +
    `Primary uncertainty is ${weakest}, which is the weakest component. ` +
    `${highResource ? 'Resource potential is high for portfolio impact.' : 'Resource potential is moderate and should be calibrated carefully.'} ` +
    `${commercialSupport ? 'Commercial score supports advancement.' : 'Commercial score does not fully support immediate advancement.'} ` +
    `Recommendation: ${recommendation}.`;
};

export const scoreProspect = (prospect: Prospect): Prospect => {
  const geologicalChanceOfSuccess = calculateGCoS(prospect);
  const mainRisk = getMainRisk(prospect);
  const priority = getPriority({ ...prospect, geologicalChanceOfSuccess });
  const recommendation = getRecommendation({ ...prospect, geologicalChanceOfSuccess, priority });
  const explanation = generateExplanation({ ...prospect, geologicalChanceOfSuccess, priority, mainRisk, recommendation });
  return { ...prospect, geologicalChanceOfSuccess, mainRisk, priority, recommendation, explanation };
};

export const scoreProspects = (prospects: Prospect[]): Prospect[] =>
  prospects.map(scoreProspect).sort((a, b) => (b.geologicalChanceOfSuccess ?? 0) - (a.geologicalChanceOfSuccess ?? 0));
