// Feature selection and leakage prevention for the ML training baseline.
//
// CRITICAL: this module is the single point that decides which prospect
// attributes are allowed to become model inputs. Post-drill and outcome-
// derived fields (reserves, actual production, discovery/field status,
// economics, prospectivity tier, priority, recommended action, the outcome
// label itself) are NEVER included as features — using them would leak the
// answer into the inputs and produce a model that cannot generalise to
// undrilled prospects.

import type { Prospect } from './prospect';
import { scoreProspect } from './scoring';
import { calculateEvidenceCompleteness } from './mlFeatures';
import { isKnownOutcome } from './outcomes';
import type {
  MLFeatureMode,
  MLTrainingConfig,
  MLTrainingRow,
  MLTrainingTarget,
} from './mlTrainingTypes';

// Stable, deterministic string hash mapped to [0, 1). Used to encode
// categorical fields (basin, play type) as a single numeric feature. The
// magnitude is arbitrary for a linear model — normalization rescales it —
// but it is stable across runs so trained models remain reproducible.
const stableHash = (value: string): number => {
  let h = 2166136261; // FNV-1a 32-bit offset basis
  const s = (value ?? '').trim().toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
};

// Ensures derived fields (GCoS, mainRisk, dataConfidence) are present.
const ensureScored = (prospect: Prospect): Prospect =>
  prospect.geologicalChanceOfSuccess === undefined ? scoreProspect(prospect) : prospect;

/**
 * Detects prospects whose six geoscience component scores all sit at the
 * neutral 0.5 default. The Norway FactPages adapter (and any importer that
 * lacks pre-drill risking) emits this pattern. When many training rows look
 * defaulted, the model is learning geography/outcome distribution rather
 * than calibrated petroleum-system features.
 */
export const looksDefaultedFeatures = (features: Record<string, number>): boolean =>
  features.sourceScore === 0.5 &&
  features.migrationScore === 0.5 &&
  features.reservoirScore === 0.5 &&
  features.sealScore === 0.5 &&
  features.trapScore === 0.5 &&
  features.timingScore === 0.5;

/**
 * Extracts the allowed feature set for a prospect under the given mode.
 *
 * safe_pre_drill: only information available BEFORE drilling.
 * expert_calibration: safe_pre_drill + the expert-system GCoS (lets the
 * baseline learn how to calibrate against the expert score).
 */
export const extractTrainingFeatures = (
  prospect: Prospect,
  mode: MLFeatureMode,
): Record<string, number> => {
  const p = ensureScored(prospect);
  const mainRisk = p.mainRisk ?? 'timing';

  const features: Record<string, number> = {
    latitude: Number.isFinite(p.latitude) ? p.latitude : 0,
    longitude: Number.isFinite(p.longitude) ? p.longitude : 0,

    sourceScore: p.sourceScore,
    migrationScore: p.migrationScore,
    reservoirScore: p.reservoirScore,
    sealScore: p.sealScore,
    trapScore: p.trapScore,
    timingScore: p.timingScore,

    dataConfidence: p.dataConfidence ?? 0,

    isEvidenceDerived: p.scoringMode === 'evidence_derived' ? 1 : 0,
    evidenceCompleteness: calculateEvidenceCompleteness(p),

    mainRisk_source: mainRisk === 'source' ? 1 : 0,
    mainRisk_migration: mainRisk === 'migration' ? 1 : 0,
    mainRisk_reservoir: mainRisk === 'reservoir' ? 1 : 0,
    mainRisk_seal: mainRisk === 'seal' ? 1 : 0,
    mainRisk_trap: mainRisk === 'trap' ? 1 : 0,
    mainRisk_timing: mainRisk === 'timing' ? 1 : 0,

    basin_hash: stableHash(p.basin),
    play_type_hash: stableHash(p.playType),
  };

  // Composite component-score features — safe pre-drill (derived from the 6 scores).
  // These let the model learn patterns like "all scores uniformly weak" vs
  // "one bottleneck, rest strong" which the individual scores alone cannot express.
  const componentScores = [
    p.sourceScore, p.migrationScore, p.reservoirScore,
    p.sealScore, p.trapScore, p.timingScore,
  ];
  const compMin = Math.min(...componentScores);
  const compMax = Math.max(...componentScores);
  const compMean = componentScores.reduce((a, b) => a + b, 0) / 6;
  const compVariance = componentScores.reduce((acc, v) => acc + (v - compMean) ** 2, 0) / 6;
  features.componentMin = compMin;
  features.componentMax = compMax;
  features.componentRange = compMax - compMin;
  features.componentVariance = compVariance;

  if (mode === 'expert_calibration') {
    features.gcosExpert = p.geologicalChanceOfSuccess ?? 0;
  }

  return features;
};

/**
 * Maps a prospect's recorded historical outcome to a binary training label
 * for the requested target. Returns null when the prospect has no usable
 * label (no outcome or an unknown outcome).
 *
 * Label semantics (derived from outcome.label):
 *  - hydrocarbon_presence / geological_success: hydrocarbons encountered
 *    (commercial, technical, or non-commercial discovery) = 1; dry hole = 0.
 *  - commercial_success: commercial discovery = 1; everything else with a
 *    known outcome = 0.
 */
export const getTrainingLabel = (
  prospect: Prospect,
  target: MLTrainingTarget,
): 0 | 1 | null => {
  const outcome = prospect.outcome;
  if (!outcome || !isKnownOutcome(outcome)) return null;

  const label = outcome.label;

  if (target === 'commercial_success') {
    if (label === 'commercial_discovery') return 1;
    // technical_discovery, non_commercial, dry_hole are all commercial failures
    return 0;
  }

  // hydrocarbon_presence and geological_success share the same mapping:
  // any discovery (commercial / technical / non-commercial) means
  // hydrocarbons were encountered; a dry hole means they were not.
  if (label === 'dry_hole') return 0;
  if (
    label === 'commercial_discovery' ||
    label === 'technical_discovery' ||
    label === 'non_commercial'
  ) {
    return 1;
  }

  return null;
};

const hasValidCoordinates = (p: Prospect): boolean =>
  Number.isFinite(p.latitude) &&
  Number.isFinite(p.longitude) &&
  p.latitude >= -90 &&
  p.latitude <= 90 &&
  p.longitude >= -180 &&
  p.longitude <= 180;

const hasValidNumericFields = (p: Prospect): boolean =>
  [p.sourceScore, p.migrationScore, p.reservoirScore, p.sealScore, p.trapScore, p.timingScore].every(
    (v) => Number.isFinite(v),
  );

/**
 * Builds the labeled training rows for the portfolio under a given config,
 * applying all exclusion rules and emitting dataset-quality warnings.
 */
export const buildTrainingRows = (
  prospects: Prospect[],
  config: MLTrainingConfig,
): {
  rows: MLTrainingRow[];
  excluded: { prospectId?: string; reason: string }[];
  warnings: string[];
} => {
  const rows: MLTrainingRow[] = [];
  const excluded: { prospectId?: string; reason: string }[] = [];

  for (const prospect of prospects) {
    const outcome = prospect.outcome;
    if (!outcome) {
      excluded.push({ prospectId: prospect.id, reason: 'No recorded historical outcome.' });
      continue;
    }
    if (!isKnownOutcome(outcome)) {
      excluded.push({ prospectId: prospect.id, reason: 'Outcome label is unknown.' });
      continue;
    }
    const isSynthetic = outcome.source === 'synthetic';
    if (isSynthetic && config.excludeSynthetic) {
      excluded.push({ prospectId: prospect.id, reason: 'Synthetic outcome excluded by configuration.' });
      continue;
    }
    const label = getTrainingLabel(prospect, config.target);
    if (label === null) {
      excluded.push({ prospectId: prospect.id, reason: `No valid label for target "${config.target}".` });
      continue;
    }
    if (!hasValidCoordinates(prospect)) {
      excluded.push({ prospectId: prospect.id, reason: 'Invalid coordinates.' });
      continue;
    }
    if (!hasValidNumericFields(prospect)) {
      excluded.push({ prospectId: prospect.id, reason: 'Invalid numeric feature values.' });
      continue;
    }

    rows.push({
      prospectId: prospect.id,
      prospectName: prospect.name,
      features: extractTrainingFeatures(prospect, config.featureMode),
      label,
      target: config.target,
      isSynthetic,
    });
  }

  const warnings: string[] = [];
  const defaultedCount = rows.filter((r) => looksDefaultedFeatures(r.features)).length;
  if (defaultedCount > 0 && defaultedCount >= rows.length * 0.5) {
    warnings.push(
      'Many geoscience scores may be defaulted. Model performance may reflect geography/outcome distribution rather than calibrated petroleum system features.',
    );
  }

  return { rows, excluded, warnings };
};
