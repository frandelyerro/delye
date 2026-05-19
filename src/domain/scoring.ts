import { Prospect, Priority } from './prospect';

const riskComponents = ['sourceScore', 'migrationScore', 'reservoirScore', 'sealScore', 'trapScore', 'timingScore'] as const;

export const calculateGCoS = (p: Prospect): number => riskComponents.reduce((acc, key) => acc * p[key], 1);

export const getMainRisk = (p: Prospect): string => {
  const min = riskComponents.reduce((lowest, key) => (p[key] < p[lowest] ? key : lowest), 'sourceScore');
  return min.replace('Score', ' risk');
};

export const getPriority = (gcos: number, commercialScore: number): Priority => {
  if (gcos >= 0.35 && commercialScore >= 70) return 'high';
  if (gcos >= 0.18) return 'medium';
  return 'low';
};

export const getRecommendation = (priority: Priority): string => {
  if (priority === 'high') return 'Advance to detailed technical evaluation / drilling candidate';
  if (priority === 'medium') return 'Acquire additional data and reduce key uncertainty';
  return 'Do not prioritize unless new evidence improves risk profile';
};

export const generateExplanation = (p: Prospect): string =>
  `${p.name} scored ${Math.round((p.geologicalChanceOfSuccess ?? 0) * 100)}% GCoS with ${p.commercialScore}/100 commercial score. ` +
  `Strengths include ${p.playType} play context in ${p.basin} and ${p.resourceEstimate} MMboe potential. ` +
  `Main uncertainty is ${p.mainRisk}.`;

export const scoreProspect = (p: Prospect): Prospect => {
  const geologicalChanceOfSuccess = calculateGCoS(p);
  const priority = getPriority(geologicalChanceOfSuccess, p.commercialScore);
  const mainRisk = getMainRisk(p);
  const recommendation = getRecommendation(priority);
  return { ...p, geologicalChanceOfSuccess, priority, mainRisk, recommendation, explanation: generateExplanation({ ...p, geologicalChanceOfSuccess, mainRisk }) };
};

export const scoreProspects = (prospects: Prospect[]): Prospect[] =>
  prospects.map(scoreProspect).sort((a, b) => (b.geologicalChanceOfSuccess ?? 0) - (a.geologicalChanceOfSuccess ?? 0));
