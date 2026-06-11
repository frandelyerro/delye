import type { Prospect } from './prospect';
import type { MLTrainingExample, TargetVariable } from './mlTypes';
import type { OutcomeLabel } from './outcomes';
import { isKnownOutcome } from './outcomes';
import { extractMLFeatures } from './mlFeatures';
import type { MLFeatureVector } from './mlTypes';

const deriveSyntheticLabel = (prospect: Prospect): OutcomeLabel => {
  const gcos = prospect.geologicalChanceOfSuccess ?? 0;
  const dc = prospect.dataConfidence ?? 0;

  if (gcos >= 0.35 && prospect.commercialScore >= 70 && dc >= 70) return 'commercial_discovery';
  if (gcos >= 0.30 && prospect.commercialScore < 70) return 'technical_discovery';
  if (gcos < 0.15) return 'dry_hole';
  if (gcos < 0.30) return 'non_commercial';
  return 'unknown';
};

export const createTrainingExample = (
  prospect: Prospect,
  label: OutcomeLabel,
  target: TargetVariable,
  metadata?: Partial<MLTrainingExample['metadata']>
): MLTrainingExample => ({
  features: extractMLFeatures(prospect),
  label,
  target,
  metadata: {
    prospectName: prospect.name,
    basin: prospect.basin,
    playType: prospect.playType,
    source: 'manual',
    ...metadata,
  },
});

export const createTrainingDatasetFromOutcomes = (prospects: Prospect[]): MLTrainingExample[] =>
  prospects
    .filter((p) => p.outcome && isKnownOutcome(p.outcome))
    .map((p) => {
      const outcome = p.outcome!;
      return createTrainingExample(p, outcome.label, outcome.targetVariable, {
        source: outcome.source,
        notes: outcome.notes,
      });
    });

export const createSyntheticTrainingDataset = (prospects: Prospect[]): MLTrainingExample[] =>
  prospects.map((p) =>
    createTrainingExample(p, deriveSyntheticLabel(p), 'geological_success', {
      source: 'synthetic',
      notes: 'Synthetic label derived from expert-system GCoS, commercial score and data confidence. NOT suitable for real ML claims.',
    })
  );

export const validateTrainingExample = (example: MLTrainingExample): string[] => {
  const errors: string[] = [];
  const f = example.features;

  const scoreFields: Array<keyof MLFeatureVector> = [
    'sourceScore', 'migrationScore', 'reservoirScore', 'sealScore', 'trapScore', 'timingScore',
    'gcosExpert', 'evidenceCompleteness',
  ];
  for (const field of scoreFields) {
    const v = f[field] as number;
    if (!Number.isFinite(v) || v < 0 || v > 1) {
      errors.push(`${field} must be a finite number in [0, 1], got ${v}`);
    }
  }

  if (!Number.isFinite(f.dataConfidence) || f.dataConfidence < 0 || f.dataConfidence > 100) {
    errors.push(`dataConfidence must be in [0, 100], got ${f.dataConfidence}`);
  }
  if (!Number.isFinite(f.commercialScore) || f.commercialScore < 0 || f.commercialScore > 100) {
    errors.push(`commercialScore must be in [0, 100], got ${f.commercialScore}`);
  }
  if (!Number.isFinite(f.resourceEstimate) || f.resourceEstimate < 0) {
    errors.push(`resourceEstimate must be >= 0, got ${f.resourceEstimate}`);
  }

  const oneHotFields: Array<keyof MLFeatureVector> = [
    'mainRisk_source', 'mainRisk_migration', 'mainRisk_reservoir',
    'mainRisk_seal', 'mainRisk_trap', 'mainRisk_timing',
  ];
  for (const field of oneHotFields) {
    const v = f[field] as number;
    if (v !== 0 && v !== 1) {
      errors.push(`${field} must be 0 or 1, got ${v}`);
    }
  }

  if (!example.metadata.prospectName) errors.push('metadata.prospectName is required');
  if (!example.label) errors.push('label is required');
  if (!example.target) errors.push('target is required');

  return errors;
};

export const exportTrainingDatasetAsJson = (examples: MLTrainingExample[]): string =>
  JSON.stringify(examples, null, 2);

export const exportTrainingDatasetAsCsv = (examples: MLTrainingExample[]): string => {
  if (!examples.length) return '';

  const scalarFeatureKeys: Array<keyof MLFeatureVector> = [
    'gcosExpert', 'dataConfidence', 'commercialScore', 'resourceEstimate',
    'sourceScore', 'migrationScore', 'reservoirScore', 'sealScore', 'trapScore', 'timingScore',
    'latitude', 'longitude',
    'mainRisk_source', 'mainRisk_migration', 'mainRisk_reservoir',
    'mainRisk_seal', 'mainRisk_trap', 'mainRisk_timing',
    'isEvidenceDerived', 'evidenceCompleteness',
    'positiveEvidenceCount', 'negativeEvidenceCount', 'missingEvidenceCount',
  ];

  const headers = ['prospectName', 'basin', 'playType', 'source', 'label', 'target', ...scalarFeatureKeys];
  const rows = examples.map((ex) => {
    const cells = [
      ex.metadata.prospectName,
      ex.metadata.basin,
      ex.metadata.playType,
      ex.metadata.source,
      ex.label,
      ex.target,
      ...scalarFeatureKeys.map((k) => String(ex.features[k])),
    ];
    return cells.map((c) => (String(c).includes(',') ? `"${c}"` : c)).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
};
