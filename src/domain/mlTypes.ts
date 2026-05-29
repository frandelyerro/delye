export type OutcomeLabel =
  | 'commercial_discovery'
  | 'technical_discovery'
  | 'dry_hole'
  | 'non_commercial'
  | 'unknown';

export type TargetVariable =
  | 'geological_success'
  | 'commercial_success'
  | 'hydrocarbon_presence';

export type MLFeatureVector = {
  prospectId: string;
  basin: string;
  playType: string;
  scoringMode: 'manual' | 'evidence_derived' | undefined;

  sourceScore: number;
  migrationScore: number;
  reservoirScore: number;
  sealScore: number;
  trapScore: number;
  timingScore: number;

  gcosExpert: number;
  dataConfidence: number;
  commercialScore: number;
  resourceEstimate: number;

  latitude: number;
  longitude: number;

  mainRisk_source: number;
  mainRisk_migration: number;
  mainRisk_reservoir: number;
  mainRisk_seal: number;
  mainRisk_trap: number;
  mainRisk_timing: number;

  isEvidenceDerived: number;

  evidenceCompleteness: number;
  positiveEvidenceCount: number;
  negativeEvidenceCount: number;
  missingEvidenceCount: number;

  riskedResource: number;
  simpleEMV: number;

  prospectivityTierNumeric: number;
};

export type MLTrainingExample = {
  features: MLFeatureVector;
  label: OutcomeLabel;
  target: TargetVariable;
  metadata: {
    prospectName: string;
    basin: string;
    playType: string;
    source: 'historical' | 'synthetic' | 'manual';
    notes?: string;
  };
};

export type MLModelPrediction = {
  prospectId: string;
  predictedGCoS: number;
  predictedCommercialChance?: number;
  confidence: number;
  modelName: string;
  modelVersion: string;
  topFactors: {
    feature: keyof MLFeatureVector | string;
    direction: 'positive' | 'negative';
    impact: number;
    explanation: string;
  }[];
  warnings: string[];
};

export type MLModelStatus = {
  available: boolean;
  modelName?: string;
  modelVersion?: string;
  trainedOnExamples?: number;
  lastTrainedAt?: string;
  limitations: string[];
};
