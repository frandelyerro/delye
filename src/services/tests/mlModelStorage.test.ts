import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrainedMLModel } from '../../domain/mlTrainingTypes';
import { clearTrainedMLModel, loadTrainedMLModel, saveTrainedMLModel } from '../mlModelStorage';

const createMemoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    clear: vi.fn(() => values.clear()),
  };
};

const sampleModel: TrainedMLModel = {
  modelType: 'logistic_regression',
  target: 'geological_success',
  featureMode: 'safe_pre_drill',
  featureNames: ['sourceScore', 'reservoirScore'],
  weights: [0.42, -0.18],
  intercept: 0.05,
  normalization: {
    sourceScore: { mean: 0.6, std: 0.2 },
    reservoirScore: { mean: 0.5, std: 0.15 },
  },
  trainedAt: '2026-06-03T00:00:00.000Z',
  trainingExamples: 40,
  testExamples: 10,
  excludedExamples: 5,
  warnings: ['This is a local prototype model only.'],
  classWeight: 'none',
  stoppedEarly: false,
  finalIteration: 1000,
  lossHistory: [0.693, 0.55, 0.42],
};

describe('mlModelStorage', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: createMemoryStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves and loads a model round-trip', () => {
    saveTrainedMLModel(sampleModel);
    const loaded = loadTrainedMLModel();
    expect(loaded).toEqual(sampleModel);
  });

  it('writes under the petrotarget-ai:trained-ml-model key', () => {
    saveTrainedMLModel(sampleModel);
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      'petrotarget-ai:trained-ml-model',
      expect.any(String),
    );
  });

  it('returns null when no model is stored', () => {
    expect(loadTrainedMLModel()).toBeNull();
  });

  it('clears a stored model', () => {
    saveTrainedMLModel(sampleModel);
    clearTrainedMLModel();
    expect(loadTrainedMLModel()).toBeNull();
  });

  it('returns null for corrupted JSON', () => {
    window.localStorage.setItem('petrotarget-ai:trained-ml-model', '{not valid json');
    expect(loadTrainedMLModel()).toBeNull();
  });

  it('returns null for a shape-invalid payload', () => {
    window.localStorage.setItem(
      'petrotarget-ai:trained-ml-model',
      JSON.stringify({ modelType: 'something_else', weights: 'nope' }),
    );
    expect(loadTrainedMLModel()).toBeNull();
  });
});
