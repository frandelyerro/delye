import type { Prospect } from './prospect';
import type { MLModelPrediction, MLModelStatus, MLFeatureVector } from './mlTypes';
import { extractMLFeatures } from './mlFeatures';

const ML_WARNINGS = [
  'No trained ML model is connected yet.',
  'Baseline prediction is deterministic and for development only.',
  'Use expert-system GCoS as the source of truth until a calibrated model is trained.',
];

export const getMLModelStatus = (): MLModelStatus => ({
  available: false,
  modelName: 'No trained model connected',
  limitations: [
    'No real historical drilling dataset has been loaded.',
    'No training pipeline is connected.',
    'Baseline model is a deterministic weighted formula, not a trained classifier.',
    'Synthetic labels are development-only and not suitable for real ML claims.',
    'Calibration requires labeled well outcomes (discoveries, dry holes, commercial wells).',
  ],
});

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

const computeBaselinePrediction = (fv: MLFeatureVector): number =>
  clamp(
    0.35 * fv.gcosExpert +
    0.15 * (fv.dataConfidence / 100) +
    0.10 * fv.evidenceCompleteness +
    0.10 * fv.reservoirScore +
    0.10 * fv.sealScore +
    0.10 * fv.trapScore +
    0.10 * fv.timingScore,
    0,
    1
  );

const deriveTopFactors = (
  fv: MLFeatureVector
): MLModelPrediction['topFactors'] => {
  const candidates: { feature: keyof MLFeatureVector | string; value: number; threshold: number; direction: 'positive' | 'negative'; explanation: string }[] = [
    {
      feature: 'reservoirScore',
      value: fv.reservoirScore,
      threshold: 0.6,
      direction: fv.reservoirScore >= 0.6 ? 'positive' : 'negative',
      explanation: fv.reservoirScore >= 0.6
        ? 'Strong reservoir quality increases predicted success.'
        : 'Weak reservoir quality reduces predicted success.',
    },
    {
      feature: 'sealScore',
      value: fv.sealScore,
      threshold: 0.5,
      direction: fv.sealScore >= 0.5 ? 'positive' : 'negative',
      explanation: fv.sealScore >= 0.5
        ? 'Adequate seal integrity supports retention.'
        : 'Inadequate seal is a critical risk factor.',
    },
    {
      feature: 'dataConfidence',
      value: fv.dataConfidence / 100,
      threshold: 0.7,
      direction: fv.dataConfidence >= 70 ? 'positive' : 'negative',
      explanation: fv.dataConfidence >= 70
        ? 'High data confidence supports reliable scoring.'
        : 'Low data confidence undermines the prediction.',
    },
    {
      feature: 'evidenceCompleteness',
      value: fv.evidenceCompleteness,
      threshold: 0.5,
      direction: fv.evidenceCompleteness >= 0.5 ? 'positive' : 'negative',
      explanation: fv.evidenceCompleteness >= 0.5
        ? 'Good evidence coverage strengthens the assessment.'
        : 'Missing evidence limits assessment confidence.',
    },
    {
      feature: 'missingEvidenceCount',
      value: fv.missingEvidenceCount,
      threshold: 3,
      direction: fv.missingEvidenceCount <= 3 ? 'positive' : 'negative',
      explanation: fv.missingEvidenceCount <= 3
        ? 'Few missing data items — assessment is reasonably complete.'
        : 'Many missing evidence items — data collection required.',
    },
  ];

  return candidates
    .sort((a, b) => Math.abs(a.value - a.threshold) - Math.abs(b.value - b.threshold))
    .slice(0, 4)
    .map((c) => ({
      feature: c.feature,
      direction: c.direction,
      impact: Math.round(Math.abs(c.value - c.threshold) * 100) / 100,
      explanation: c.explanation,
    }));
};

export const predictWithBaselineModel = (prospect: Prospect): MLModelPrediction => {
  const fv = extractMLFeatures(prospect);
  const predictedGCoS = computeBaselinePrediction(fv);

  return {
    prospectId: prospect.id,
    predictedGCoS,
    confidence: 0.3,
    modelName: 'Baseline Deterministic v1',
    modelVersion: '1.0.0-dev',
    topFactors: deriveTopFactors(fv),
    warnings: ML_WARNINGS,
  };
};

export const compareExpertAndML = (prospect: Prospect): {
  expertGCoS: number;
  predictedGCoS: number;
  delta: number;
  agreement: 'high' | 'medium' | 'low';
  interpretation: string;
} => {
  const expertGCoS = prospect.geologicalChanceOfSuccess ?? 0;
  const { predictedGCoS } = predictWithBaselineModel(prospect);
  const delta = predictedGCoS - expertGCoS;
  const absDelta = Math.abs(delta);

  let agreement: 'high' | 'medium' | 'low';
  let interpretation: string;

  if (absDelta < 0.05) {
    agreement = 'high';
    interpretation = 'Expert-system and baseline model are closely aligned. Both assessments reinforce each other.';
  } else if (absDelta < 0.15) {
    agreement = 'medium';
    interpretation = delta > 0
      ? 'Baseline suggests slightly higher probability than expert scoring. Additional evidence could resolve the gap.'
      : 'Baseline suggests slightly lower probability than expert scoring. Review data confidence and evidence completeness.';
  } else {
    agreement = 'low';
    interpretation = delta > 0
      ? 'Significant divergence: baseline scores higher than the expert system. Likely caused by high data confidence or strong individual component scores. A calibrated ML model is needed to resolve this gap.'
      : 'Significant divergence: baseline scores lower than the expert system. Missing evidence or low data confidence may be pulling the baseline down. A calibrated ML model is needed to resolve this gap.';
  }

  return { expertGCoS, predictedGCoS, delta, agreement, interpretation };
};
