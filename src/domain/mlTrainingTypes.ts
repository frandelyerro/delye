// ML Training Baseline types.
//
// These types describe a transparent, local, supervised baseline model
// (logistic regression) that can train on imported labeled historical
// prospects/wells. This is NOT a production ML system: the expert-system
// GCoS remains the source of truth for all targeting and investment
// decisions until a trained model is validated and calibrated.

export type MLTrainingTarget =
  | 'hydrocarbon_presence'
  | 'geological_success'
  | 'commercial_success';

export type MLFeatureMode =
  | 'safe_pre_drill'
  | 'expert_calibration';

export type MLClassWeight = 'none' | 'balanced';

export type MLTrainTestSplit = {
  trainRatio: number;
  seed: number;
};

export type MLTrainingConfig = {
  target: MLTrainingTarget;
  featureMode: MLFeatureMode;
  trainRatio: number;
  learningRate: number;
  iterations: number;
  l2Penalty: number;
  minExamples: number;
  excludeSynthetic: boolean;
  classWeight: MLClassWeight;
  patience: number;       // early stopping: consecutive non-improving checks
  convergenceTol: number; // early stopping: minimum loss improvement
  momentum?: number;      // classic momentum coefficient for gradient descent (0 = disabled)
};

export type MLTrainingRow = {
  prospectId: string;
  prospectName: string;
  features: Record<string, number>;
  label: 0 | 1;
  target: MLTrainingTarget;
  isSynthetic: boolean;
};

export type TrainedMLModel = {
  modelType: 'logistic_regression';
  target: MLTrainingTarget;
  featureMode: MLFeatureMode;
  featureNames: string[];
  weights: number[];
  intercept: number;
  normalization: Record<string, { mean: number; std: number }>;
  trainedAt: string;
  trainingExamples: number;
  testExamples: number;
  excludedExamples: number;
  warnings: string[];
  classWeight: MLClassWeight;
  stoppedEarly: boolean;
  finalIteration: number;
  lossHistory: number[];
};

export type MLPredictionResult = {
  prospectId: string;
  probability: number;
  predictedLabel: 0 | 1;
  threshold: number;
  topFactors: {
    feature: string;
    value: number;
    weight: number;
    contribution: number;
    direction: 'positive' | 'negative';
  }[];
};

export type MLMetrics = {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  brierScore: number;
  rocAUC: number;
  optimalThreshold: number;
  confusionMatrix: {
    truePositive: number;
    falsePositive: number;
    trueNegative: number;
    falseNegative: number;
  };
  positiveRate: number;
  predictedPositiveRate: number;
  trainSize: number;
  testSize: number;
};

export type MLCrossValidationResult = {
  folds: number;
  meanMetrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    rocAUC: number;
    brierScore: number;
  };
  stdMetrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    rocAUC: number;
    brierScore: number;
  };
};

// Aliases for backward compatibility with test files
export type CVFoldMetrics = MLCrossValidationResult['meanMetrics'];
export type CVResult = MLCrossValidationResult;

export type MLTrainingResult = {
  model: TrainedMLModel;
  metrics: MLMetrics;
  trainRows: MLTrainingRow[];
  testRows: MLTrainingRow[];
  predictions: MLPredictionResult[];
  warnings: string[];
  cvResult?: MLCrossValidationResult;
};
