// Local (localStorage) persistence for the trained ML baseline model.
//
// No backend storage, no cloud model registry. The model is a small JSON
// blob (weights, intercept, normalisation, metadata) saved under a single
// key. A corrupted or shape-invalid payload loads as null so the UI falls
// back to the deterministic baseline preview.

import type { TrainedMLModel } from '../domain/mlTrainingTypes';

const STORAGE_KEY = 'petrotarget-ai:trained-ml-model';

const canUseStorage = (): boolean =>
  typeof window !== 'undefined' && Boolean(window.localStorage);

const isValidModelShape = (value: unknown): value is TrainedMLModel => {
  if (!value || typeof value !== 'object') return false;
  const m = value as Record<string, unknown>;
  return (
    m.modelType === 'logistic_regression' &&
    typeof m.target === 'string' &&
    typeof m.featureMode === 'string' &&
    Array.isArray(m.featureNames) &&
    Array.isArray(m.weights) &&
    typeof m.intercept === 'number' &&
    typeof m.normalization === 'object' &&
    m.normalization !== null
  );
};

export const saveTrainedMLModel = (model: TrainedMLModel): void => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
  } catch {
    // Storage may be full or unavailable; saving is best-effort.
  }
};

export const loadTrainedMLModel = (): TrainedMLModel | null => {
  if (!canUseStorage()) return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return isValidModelShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const clearTrainedMLModel = (): void => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort removal.
  }
};
