import { useEffect, useState } from 'react';
import { trainBaselineMLModel } from '../domain/mlTrainingService';
import type { MLTrainingConfig, MLTrainingResult, TrainedMLModel } from '../domain/mlTrainingTypes';
import { loadTrainedMLModel, saveTrainedMLModel, clearTrainedMLModel } from '../services/mlModelStorage';
import { downloadJson } from '../utils/exportReport';
import type { Prospect } from '../domain/prospect';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export interface MLTrainingActions {
  runCV: boolean;
  setRunCV: SetState<boolean>;
  cvFolds: number;
  setCvFolds: SetState<number>;
  trainingResult: MLTrainingResult | null;
  trainingError: string | null;
  savedModel: TrainedMLModel | null;
  handleTrainModel: () => void;
  handleSaveModel: () => void;
  handleLoadModel: () => void;
  handleClearModel: () => void;
  handleExportModelJson: () => void;
  handleExportMetricsJson: () => void;
}

export function useMLTraining(params: {
  prospects: Prospect[];
  trainingConfig: MLTrainingConfig;
}): MLTrainingActions {
  const { prospects, trainingConfig } = params;

  const [trainingResult, setTrainingResult] = useState<MLTrainingResult | null>(null);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [savedModel, setSavedModel] = useState<TrainedMLModel | null>(null);
  const [runCV, setRunCV] = useState(false);
  const [cvFolds, setCvFolds] = useState(5);

  useEffect(() => {
    setSavedModel(loadTrainedMLModel());
  }, []);

  const handleTrainModel = () => {
    try {
      const result = trainBaselineMLModel(prospects, trainingConfig, runCV, cvFolds);
      setTrainingResult(result);
      setTrainingError(null);
    } catch (err) {
      setTrainingResult(null);
      setTrainingError((err as Error).message);
    }
  };

  const handleSaveModel = () => {
    if (!trainingResult) return;
    saveTrainedMLModel(trainingResult.model);
    setSavedModel(trainingResult.model);
  };

  const handleLoadModel = () => {
    setSavedModel(loadTrainedMLModel());
  };

  const handleClearModel = () => {
    clearTrainedMLModel();
    setSavedModel(null);
  };

  const handleExportModelJson = () => {
    if (trainingResult) downloadJson('ml-trained-model.json', trainingResult.model);
  };

  const handleExportMetricsJson = () => {
    if (trainingResult) downloadJson('ml-model-metrics.json', trainingResult.metrics);
  };

  return {
    runCV,
    setRunCV,
    cvFolds,
    setCvFolds,
    trainingResult,
    trainingError,
    savedModel,
    handleTrainModel,
    handleSaveModel,
    handleLoadModel,
    handleClearModel,
    handleExportModelJson,
    handleExportMetricsJson,
  };
}

export { loadTrainedMLModel };
