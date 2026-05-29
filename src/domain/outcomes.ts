export type OutcomeLabel =
  | 'commercial_discovery'
  | 'technical_discovery'
  | 'dry_hole'
  | 'non_commercial'
  | 'unknown';

export type ProspectOutcome = {
  label: OutcomeLabel;
  targetVariable: 'geological_success' | 'commercial_success' | 'hydrocarbon_presence';
  wellName?: string;
  drillYear?: number;
  operator?: string;
  resultConfidence: 'high' | 'medium' | 'low';
  source: 'historical' | 'synthetic' | 'manual';
  notes?: string;
};

export const isKnownOutcome = (outcome: ProspectOutcome): boolean =>
  outcome.label !== 'unknown';

export const isGeologicalSuccess = (outcome: ProspectOutcome): boolean =>
  outcome.label === 'commercial_discovery' || outcome.label === 'technical_discovery';

export const isCommercialSuccess = (outcome: ProspectOutcome): boolean =>
  outcome.label === 'commercial_discovery';

export const getOutcomeLabelText = (label: OutcomeLabel): string => {
  const texts: Record<OutcomeLabel, string> = {
    commercial_discovery: 'Commercial Discovery',
    technical_discovery: 'Technical Discovery',
    dry_hole: 'Dry Hole',
    non_commercial: 'Non-Commercial',
    unknown: 'Unknown',
  };
  return texts[label];
};

export const getOutcomeSummary = (outcome: ProspectOutcome): string => {
  const parts: string[] = [getOutcomeLabelText(outcome.label)];
  if (outcome.wellName) parts.push(`Well: ${outcome.wellName}`);
  if (outcome.drillYear) parts.push(`Year: ${outcome.drillYear}`);
  if (outcome.operator) parts.push(`Operator: ${outcome.operator}`);
  return parts.join(' · ');
};
