import { MainRisk, Prospect } from './prospect';

export const componentMap: Record<MainRisk, keyof Prospect> = {
  source: 'sourceScore',
  migration: 'migrationScore',
  reservoir: 'reservoirScore',
  seal: 'sealScore',
  trap: 'trapScore',
  timing: 'timingScore'
};

export const componentNames = Object.keys(componentMap) as MainRisk[];

export const componentLabels: Record<MainRisk, string> = {
  source: 'Source',
  migration: 'Migration',
  reservoir: 'Reservoir',
  seal: 'Seal',
  trap: 'Trap',
  timing: 'Timing'
};

const strongestNarrative: Record<MainRisk, string> = {
  source: 'strong source rock support',
  migration: 'effective migration support',
  reservoir: 'good reservoir quality',
  seal: 'effective sealing conditions',
  trap: 'credible trap definition',
  timing: 'favorable timing'
};

const weakestNarrative: Record<MainRisk, string> = {
  source: 'source presence and maturity remain uncertain',
  migration: 'migration pathways remain uncertain',
  reservoir: 'reservoir quality remains uncertain',
  seal: 'seal continuity is the main uncertainty',
  trap: 'trap definition is the main uncertainty',
  timing: 'charge timing is the main uncertainty'
};

const nextStepByRisk: Record<MainRisk, string> = {
  source: 'Acquire additional geochemical and source maturity data to reduce source risk.',
  migration: 'Acquire migration pathway and pressure data to reduce migration risk.',
  reservoir: 'Acquire reservoir quality and petrophysical data to reduce reservoir risk.',
  seal: 'Acquire additional data to reduce seal risk.',
  trap: 'Acquire structural imaging and closure data to reduce trap risk.',
  timing: 'Acquire burial history and charge-timing data to reduce timing risk.'
};

export type ScoreBreakdown = {
  components: Array<{ key: MainRisk; label: string; value: number }>;
  geologicalChanceOfSuccess: number;
};

export const getScoreBreakdown = (prospect: Prospect): ScoreBreakdown => {
  const components = componentNames.map((key) => ({
    key,
    label: componentLabels[key],
    value: Number(prospect[componentMap[key]])
  }));

  return {
    components,
    geologicalChanceOfSuccess: components.reduce((acc, component) => acc * component.value, 1)
  };
};

export const getStrongestComponents = (prospect: Prospect): MainRisk[] =>
  [...getScoreBreakdown(prospect).components]
    .sort((a, b) => b.value - a.value)
    .slice(0, 2)
    .map((component) => component.key);

export const getWeakestComponent = (prospect: Prospect): MainRisk =>
  [...getScoreBreakdown(prospect).components]
    .sort((a, b) => a.value - b.value)[0]?.key ?? 'seal';

export const getGCoSFormulaString = (prospect: Prospect): string => {
  const breakdown = getScoreBreakdown(prospect);
  const values = breakdown.components.map((component) => component.value.toFixed(2)).join(' Ã— ');
  return `${values} = ${(breakdown.geologicalChanceOfSuccess * 100).toFixed(1)}%`;
};

export const getGCoSInterpretation = (prospect: Prospect): string => {
  const strongest = getStrongestComponents(prospect);
  const weakest = getWeakestComponent(prospect);
  const strongestText = strongest.map((component) => strongestNarrative[component]).join(' and ');

  return `The prospect has ${strongestText}, but ${weakestNarrative[weakest]}.`;
};

export const getRecommendedNextStep = (prospect: Prospect): string =>
  nextStepByRisk[getWeakestComponent(prospect)];

export const calculateDataConfidence = (prospect: Prospect): number => {
  let score = 100;

  if (prospect.resourceEstimate === 0) score -= 10;
  if (prospect.commercialScore === 0) score -= 10;
  if (prospect.latitude === 0 || prospect.longitude === 0) score -= 5;

  componentNames.forEach((key) => {
    if (Number(prospect[componentMap[key]]) < 0.25) score -= 5;
  });

  return Math.min(100, Math.max(0, score));
};
