import type { GeoscienceAssessment, ProspectEvidence, ScoringMode, TargetPhase } from './evidence';
import type { EconomicAssumptions, EconomicAssessment } from './economicTypes';
import type { ProspectOutcome } from './outcomes';

export type Priority = 'high' | 'medium' | 'low';
export type MainRisk = 'source' | 'migration' | 'reservoir' | 'seal' | 'trap' | 'timing';

export const PLAY_TYPES = [
  'Conventional Clastic',
  'Carbonate',
  'Deepwater Clastic',
  'Deepwater Carbonate',
  'Unconventional Tight',
  'Unconventional Shale',
  'Salt Diapir / Sub-Salt',
  'Fractured Basement',
  'Stratigraphic Trap',
  'Combination Trap',
  'Other',
] as const;

export type PlayType = (typeof PLAY_TYPES)[number];

export type Prospect = {
  id: string;
  name: string;
  basin: string;
  block: string;
  playType: string;
  latitude: number;
  longitude: number;
  sourceScore: number;
  migrationScore: number;
  reservoirScore: number;
  sealScore: number;
  trapScore: number;
  timingScore: number;
  commercialScore: number;
  resourceEstimate: number;
  geologicalChanceOfSuccess?: number;
  priority?: Priority;
  mainRisk?: MainRisk;
  dataConfidence?: number;
  recommendation?: string;
  explanation?: string;
  scoringMode?: ScoringMode;
  targetPhase?: TargetPhase;
  evidence?: ProspectEvidence;
  geoscienceAssessment?: GeoscienceAssessment;
  economicAssumptions?: EconomicAssumptions;
  economicAssessment?: EconomicAssessment;
  outcome?: ProspectOutcome;
};

export type ProspectInput = Omit<Prospect, 'geologicalChanceOfSuccess' | 'priority' | 'mainRisk' | 'dataConfidence' | 'recommendation' | 'explanation'>;

export const validateProspect = (prospect: Prospect): string[] => {
  const errors: string[] = [];
  const requiredStringFields: Array<keyof Prospect> = ['id', 'name', 'basin', 'block', 'playType'];
  const scoreFields: Array<keyof Prospect> = ['sourceScore', 'migrationScore', 'reservoirScore', 'sealScore', 'trapScore', 'timingScore'];

  requiredStringFields.forEach((field) => {
    const value = String(prospect[field] ?? '').trim();
    if (!value) errors.push(`${field} is required`);
  });

  scoreFields.forEach((field) => {
    const value = Number(prospect[field]);
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      errors.push(`${field} must be between 0 and 1`);
    }
  });

  const commercialScore = Number(prospect.commercialScore);
  if (!Number.isFinite(commercialScore) || commercialScore < 0 || commercialScore > 100) {
    errors.push('commercialScore must be between 0 and 100');
  }

  const resourceEstimate = Number(prospect.resourceEstimate);
  if (!Number.isFinite(resourceEstimate) || resourceEstimate < 0) {
    errors.push('resourceEstimate must be greater than or equal to 0');
  }

  const latitude = Number(prospect.latitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    errors.push('latitude must be between -90 and 90');
  }

  const longitude = Number(prospect.longitude);
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    errors.push('longitude must be between -180 and 180');
  }

  return errors;
};
