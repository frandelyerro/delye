import type { Prospect } from './prospect';
import type { MLFeatureVector } from './mlTypes';
import { getProspectivityTier, type ProspectivityTier } from './recommendationEngine';
import { scoreProspect } from './scoring';

export const mapProspectivityTierToNumber = (tier: ProspectivityTier | undefined): number => {
  if (tier === 'tier_1') return 4;
  if (tier === 'tier_2') return 3;
  if (tier === 'tier_3') return 2;
  if (tier === 'tier_4') return 1;
  return 0;
};

export const countEvidenceSignals = (prospect: Prospect): {
  positiveEvidenceCount: number;
  negativeEvidenceCount: number;
  missingEvidenceCount: number;
} => {
  if (!prospect.geoscienceAssessment) {
    return { positiveEvidenceCount: 0, negativeEvidenceCount: 0, missingEvidenceCount: 0 };
  }
  let positive = 0;
  let negative = 0;
  let missing = 0;
  for (const c of prospect.geoscienceAssessment.components) {
    positive += c.positiveEvidence.length;
    negative += c.negativeEvidence.length;
    missing += c.missingEvidence.length;
  }
  return { positiveEvidenceCount: positive, negativeEvidenceCount: negative, missingEvidenceCount: missing };
};

export const calculateEvidenceCompleteness = (prospect: Prospect): number => {
  if (!prospect.geoscienceAssessment) return 0;
  const { positiveEvidenceCount, negativeEvidenceCount, missingEvidenceCount } = countEvidenceSignals(prospect);
  const total = positiveEvidenceCount + negativeEvidenceCount + missingEvidenceCount;
  if (total === 0) return 0;
  const completeness = 1 - missingEvidenceCount / total;
  return Math.max(0, Math.min(1, completeness));
};

export const extractMLFeatures = (prospect: Prospect): MLFeatureVector => {
  // Ensure derived fields (GCoS, dataConfidence, mainRisk, etc.) are present
  const p = prospect.geologicalChanceOfSuccess === undefined ? scoreProspect(prospect) : prospect;
  const gcos = p.geologicalChanceOfSuccess ?? 0;
  const dc = p.dataConfidence ?? 0;
  const mainRisk = p.mainRisk ?? 'timing';
  const tier = getProspectivityTier(p);
  const { positiveEvidenceCount, negativeEvidenceCount, missingEvidenceCount } = countEvidenceSignals(p);
  const evidenceCompleteness = calculateEvidenceCompleteness(p);
  const isEvidenceDerived = p.scoringMode === 'evidence_derived' ? 1 : 0;

  const riskedResource = p.economicAssessment
    ? p.economicAssessment.riskedResourceMMboe
    : p.resourceEstimate * gcos;

  const simpleEMV = p.economicAssessment
    ? p.economicAssessment.simpleEMVUsdMM
    : 0;

  return {
    prospectId: p.id,
    basin: p.basin,
    playType: p.playType,
    scoringMode: (p.scoringMode as 'manual' | 'evidence_derived' | undefined) ?? 'manual',

    sourceScore: p.sourceScore,
    migrationScore: p.migrationScore,
    reservoirScore: p.reservoirScore,
    sealScore: p.sealScore,
    trapScore: p.trapScore,
    timingScore: p.timingScore,

    gcosExpert: gcos,
    dataConfidence: dc,
    commercialScore: p.commercialScore,
    resourceEstimate: p.resourceEstimate,

    latitude: p.latitude,
    longitude: p.longitude,

    mainRisk_source: mainRisk === 'source' ? 1 : 0,
    mainRisk_migration: mainRisk === 'migration' ? 1 : 0,
    mainRisk_reservoir: mainRisk === 'reservoir' ? 1 : 0,
    mainRisk_seal: mainRisk === 'seal' ? 1 : 0,
    mainRisk_trap: mainRisk === 'trap' ? 1 : 0,
    mainRisk_timing: mainRisk === 'timing' ? 1 : 0,

    isEvidenceDerived,
    evidenceCompleteness,
    positiveEvidenceCount,
    negativeEvidenceCount,
    missingEvidenceCount,

    riskedResource,
    simpleEMV,

    prospectivityTierNumeric: mapProspectivityTierToNumber(tier),
  };
};

export const extractMLFeaturesForPortfolio = (prospects: Prospect[]): MLFeatureVector[] =>
  prospects.map(extractMLFeatures);
