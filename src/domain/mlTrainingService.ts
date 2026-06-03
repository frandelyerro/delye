// Orchestration layer for the ML training baseline.
//
// Ties together feature building, the logistic-regression trainer, the
// train/test split, and evaluation. Also provides the expert-vs-ML
// comparison used in the UI.
//
// SAFETY: nothing in this module overrides expert-system GCoS, prospect
// priority, recommended action, drill-candidate logic, economics decision
// signals, or geoscience scores. The trained model is advisory only.

import type { Prospect } from './prospect';
import type {
  MLMetrics,
  MLPredictionResult,
  MLTrainingConfig,
  MLTrainingResult,
  MLTrainingRow,
  TrainedMLModel,
} from './mlTrainingTypes';
import { buildTrainingRows, extractTrainingFeatures, looksDefaultedFeatures } from './mlTrainingFeatures';
import {
  buildPredictionResult,
  predictProbability,
  predictWithModel,
  trainLogisticRegression,
} from './mlLogisticRegression';
import { evaluateModel, splitTrainTest } from './mlEvaluation';

// Fixed seed keeps the train/test split reproducible across runs. The
// config type intentionally does not expose it — the split must be stable
// so saved models and reported metrics stay comparable.
export const DEFAULT_TRAINING_SEED = 42;

export const getDefaultMLTrainingConfig = (): MLTrainingConfig => ({
  target: 'geological_success',
  featureMode: 'safe_pre_drill',
  trainRatio: 0.8,
  learningRate: 0.05,
  iterations: 1000,
  l2Penalty: 0.001,
  minExamples: 30,
  excludeSynthetic: true,
});

/**
 * Returns dataset-quality and safety warnings for a set of training rows.
 * These are advisory and always include the prototype/non-decision caveats.
 */
export const validateTrainingReadinessForModel = (
  rows: MLTrainingRow[],
  config: MLTrainingConfig,
): string[] => {
  const warnings: string[] = [];
  const positives = rows.filter((r) => r.label === 1).length;
  const negatives = rows.length - positives;

  if (rows.length < 30) {
    warnings.push('Fewer than 30 labeled examples — the model may overfit and metrics will be unstable.');
  }
  if (positives < 10) {
    warnings.push('Fewer than 10 positive examples — the model may not learn the positive class reliably.');
  }
  if (negatives < 10) {
    warnings.push('Fewer than 10 negative examples — the model may not learn the negative class reliably.');
  }
  if (positives === 0 || negatives === 0) {
    warnings.push('Only one outcome class is present — the model cannot learn to discriminate between success and failure.');
  }
  if (config.excludeSynthetic) {
    warnings.push('Synthetic examples are excluded — only real labeled outcomes are used for training.');
  }
  const defaulted = rows.filter((r) => looksDefaultedFeatures(r.features)).length;
  if (defaulted > 0 && defaulted >= rows.length * 0.5) {
    warnings.push('Many geoscience scores may be defaulted. Model performance may reflect geography/outcome distribution rather than calibrated petroleum system features.');
  }

  warnings.push('This is a local prototype model only.');
  warnings.push('It is not calibrated for investment or drilling decisions.');
  warnings.push('A positive prediction is not a discovery guarantee.');

  return warnings;
};

/**
 * Trains the baseline logistic-regression model from the portfolio's
 * labeled historical outcomes. Throws when there are fewer labeled rows
 * than `minExamples` (the UI guards against this and surfaces readiness
 * warnings before enabling training).
 */
export const trainBaselineMLModel = (
  prospects: Prospect[],
  configOverride: Partial<MLTrainingConfig> = {},
): MLTrainingResult => {
  const config = { ...getDefaultMLTrainingConfig(), ...configOverride };
  const { rows, excluded, warnings: buildWarnings } = buildTrainingRows(prospects, config);

  if (rows.length < config.minExamples) {
    throw new Error(
      `Insufficient training examples: ${rows.length} labeled rows available, minimum ${config.minExamples} required. ` +
        'Import or label more real historical outcomes before training.',
    );
  }

  const { trainRows, testRows } = splitTrainTest(rows, config.trainRatio, DEFAULT_TRAINING_SEED);
  const model = trainLogisticRegression(trainRows, config);
  model.testExamples = testRows.length;
  model.excludedExamples = excluded.length;

  const { metrics } = evaluateModel(model, testRows, 0.5);

  const readinessWarnings = validateTrainingReadinessForModel(rows, config);
  const warnings = Array.from(new Set([...readinessWarnings, ...buildWarnings]));
  model.warnings = warnings;

  // Predictions over the full labeled set so the UI table can show every
  // labeled prospect. Metrics, by contrast, come from the test set only.
  const predictions = rows.map((r) => buildPredictionResult(model, r.prospectId, r.features, 0.5));

  return { model, metrics, trainRows, testRows, predictions, warnings };
};

/** Scores every prospect in a portfolio with a trained model. */
export const predictPortfolioWithTrainedModel = (
  model: TrainedMLModel,
  prospects: Prospect[],
): MLPredictionResult[] => prospects.map((p) => predictWithModel(model, p));

/**
 * Compares a trained model's probability against the expert-system GCoS for
 * a single prospect. Advisory only — does not change any targeting output.
 */
export const compareTrainedModelWithExpertGCoS = (
  model: TrainedMLModel,
  prospect: Prospect,
): {
  expertGCoS: number;
  mlProbability: number;
  delta: number;
  agreement: 'high' | 'medium' | 'low';
  interpretation: string;
} => {
  const expertGCoS = prospect.geologicalChanceOfSuccess ?? 0;
  const mlProbability = predictProbability(model, extractTrainingFeatures(prospect, model.featureMode));
  const delta = mlProbability - expertGCoS;
  const absDelta = Math.abs(delta);

  let agreement: 'high' | 'medium' | 'low';
  let interpretation: string;
  if (absDelta < 0.05) {
    agreement = 'high';
    interpretation = 'Trained model and expert-system GCoS are closely aligned. ML remains advisory only.';
  } else if (absDelta < 0.15) {
    agreement = 'medium';
    interpretation = delta > 0
      ? 'Trained model is somewhat more optimistic than the expert score. Treat as advisory; expert GCoS governs targeting.'
      : 'Trained model is somewhat more cautious than the expert score. Treat as advisory; expert GCoS governs targeting.';
  } else {
    agreement = 'low';
    interpretation = delta > 0
      ? 'Large divergence: the trained model scores notably higher than the expert system. This is a prototype signal only and does not override expert GCoS or targeting gates.'
      : 'Large divergence: the trained model scores notably lower than the expert system. This is a prototype signal only and does not override expert GCoS or targeting gates.';
  }

  return { expertGCoS, mlProbability, delta, agreement, interpretation };
};

export type { MLMetrics };
