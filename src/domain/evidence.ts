export type EvidenceConfidence = 'high' | 'medium' | 'low' | 'unknown';
export type EvidenceSourceType = 'well' | 'seismic' | 'geochemistry' | 'report' | 'analog' | 'assumption';
export type ComponentName = 'source' | 'migration' | 'reservoir' | 'seal' | 'trap' | 'timing';
export type ScoringMode = 'manual' | 'evidence_derived';
export type TargetPhase = 'oil' | 'gas' | 'condensate' | 'unknown';

export type SourcePresence = 'proven' | 'probable' | 'possible' | 'unknown' | 'absent';
export type MigrationPathway = 'proven' | 'probable' | 'possible' | 'unknown' | 'unlikely';
export type ReservoirPresence = 'proven' | 'probable' | 'possible' | 'unknown' | 'absent';
export type SealPresence = 'proven' | 'probable' | 'possible' | 'unknown' | 'absent';
export type SealLithology = 'salt' | 'evaporite' | 'shale' | 'mudstone' | 'carbonate' | 'other' | 'unknown';
export type FaultSealRisk = 'low' | 'medium' | 'high' | 'unknown';
export type FaultConnectivity = 'good' | 'moderate' | 'poor' | 'unknown';
export type CarrierBedPresence = 'proven' | 'probable' | 'possible' | 'absent' | 'unknown';
export type ReservoirContinuity = 'good' | 'moderate' | 'poor' | 'unknown';
export type TrapType = 'structural' | 'stratigraphic' | 'combination' | 'subsalt' | 'unknown';
export type SeismicConfidence = 'high' | 'medium' | 'low' | 'unknown';
export type TrapTimingRelation = 'yes' | 'likely' | 'uncertain' | 'unlikely' | 'no';
export type ChargeTiming = 'favorable' | 'possible' | 'unfavorable' | 'unknown';
export type BurialHistoryConfidence = 'high' | 'medium' | 'low' | 'unknown';

export type SourceEvidence = {
  presence: SourcePresence;
  tocPercent?: number;
  roPercent?: number;
  tmaxC?: number;
  keroGenType?: string;
  sourceThicknessM?: number;
  distanceToKitchenKm?: number;
  sources?: EvidenceSourceType[];
};

export type MigrationEvidence = {
  pathway: MigrationPathway;
  faultConnectivity?: FaultConnectivity;
  carrierBedPresence?: CarrierBedPresence;
  distanceFromKitchenKm?: number;
  showsPresent?: boolean;
  sources?: EvidenceSourceType[];
};

export type ReservoirEvidence = {
  presence: ReservoirPresence;
  porosityPercent?: number;
  permeabilityMd?: number;
  netPayM?: number;
  vshaleFraction?: number;
  continuity?: ReservoirContinuity;
  sources?: EvidenceSourceType[];
};

export type SealEvidence = {
  presence: SealPresence;
  lithology?: SealLithology;
  thicknessM?: number;
  faultSealRisk?: FaultSealRisk;
  sources?: EvidenceSourceType[];
};

export type TrapEvidence = {
  closureMapped: boolean;
  trapType?: TrapType;
  closureAreaKm2?: number;
  closureHeightM?: number;
  seismicConfidence?: SeismicConfidence;
  sources?: EvidenceSourceType[];
};

export type TimingEvidence = {
  trapFormedBeforeMigration: TrapTimingRelation;
  chargeTiming?: ChargeTiming;
  burialHistoryConfidence?: BurialHistoryConfidence;
  sources?: EvidenceSourceType[];
};

export type ProspectEvidence = {
  source?: SourceEvidence;
  migration?: MigrationEvidence;
  reservoir?: ReservoirEvidence;
  seal?: SealEvidence;
  trap?: TrapEvidence;
  timing?: TimingEvidence;
};

export type ComponentAssessment = {
  component: ComponentName;
  score: number;
  confidence: EvidenceConfidence;
  rationale: string;
  positiveEvidence: string[];
  negativeEvidence: string[];
  missingEvidence: string[];
};

export type GeoscienceAssessment = {
  scoringMode: ScoringMode;
  targetPhase: TargetPhase;
  components: ComponentAssessment[];
  derivedScores: {
    sourceScore: number;
    migrationScore: number;
    reservoirScore: number;
    sealScore: number;
    trapScore: number;
    timingScore: number;
  };
  criticalRisk: ComponentName;
  overallConfidence: EvidenceConfidence;
  summary: string;
  /** Aggregated missing evidence from all components — the recommended next data acquisition steps. */
  recommendedNextData: string[];
};
