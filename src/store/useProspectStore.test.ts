import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockProspects } from '../data/mockProspects';
import { Prospect } from '../domain/prospect';
import { scoreProspects } from '../domain/scoring';
import { useProspectStore } from './useProspectStore';

const sample: Prospect = {
  id: 'x1',
  name: 'X1',
  basin: 'Neuquen Basin',
  block: 'X',
  playType: 'Shale',
  latitude: -38,
  longitude: -68,
  sourceScore: 0.8,
  migrationScore: 0.8,
  reservoirScore: 0.8,
  sealScore: 0.8,
  trapScore: 0.8,
  timingScore: 0.8,
  commercialScore: 80,
  resourceEstimate: 20
};

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
    clear: vi.fn(() => values.clear())
  };
};

describe('useProspectStore portfolio behavior', () => {
  beforeEach(() => {
    const localStorage = createMemoryStorage();
    vi.stubGlobal('window', { localStorage });
    useProspectStore.setState({
      prospects: scoreProspects(mockProspects),
      filters: { basin: '', block: '', playType: '', priority: '' }
    });
  });

  it('replaceProspects replaces portfolio', () => {
    useProspectStore.getState().replaceProspects([sample]);
    expect(useProspectStore.getState().prospects).toHaveLength(1);
    expect(useProspectStore.getState().prospects[0].id).toBe('x1');
  });

  it('appendProspects appends without deleting existing', () => {
    useProspectStore.getState().replaceProspects([sample]);
    useProspectStore.getState().appendProspects([{ ...sample, id: 'x2', name: 'X2' }]);
    expect(useProspectStore.getState().prospects.length).toBeGreaterThanOrEqual(2);
    expect(useProspectStore.getState().prospects.some((p) => p.id === 'x1')).toBe(true);
    expect(useProspectStore.getState().prospects.some((p) => p.id === 'x2')).toBe(true);
  });

  it('createProspect adds and scores a new prospect', () => {
    useProspectStore.setState({ prospects: [] });
    useProspectStore.getState().createProspect(sample);
    const created = useProspectStore.getState().prospects[0];
    expect(created.id).toBe('x1');
    expect(created.geologicalChanceOfSuccess).toBeCloseTo(0.262144);
    expect(created.priority).toBe('medium');
  });

  it('updateProspect updates and re-scores the prospect', () => {
    useProspectStore.getState().replaceProspects([sample]);
    const before = useProspectStore.getState().prospects[0].geologicalChanceOfSuccess;
    useProspectStore.getState().updateProspect('x1', { ...sample, sourceScore: 0.9, migrationScore: 0.9 });
    const updated = useProspectStore.getState().prospects[0];
    expect(updated.sourceScore).toBe(0.9);
    expect(updated.migrationScore).toBe(0.9);
    expect(updated.geologicalChanceOfSuccess).not.toBe(before);
    expect(updated.geologicalChanceOfSuccess).toBeCloseTo(0.331776);
  });

  it('deleteProspect removes a prospect', () => {
    useProspectStore.getState().replaceProspects([sample, { ...sample, id: 'x2', name: 'X2' }]);
    useProspectStore.getState().deleteProspect('x1');
    expect(useProspectStore.getState().prospects).toHaveLength(1);
    expect(useProspectStore.getState().prospects[0].id).toBe('x2');
  });

  it('resetProspects restores scored sample data and clears storage', () => {
    const localStorage = window.localStorage;
    useProspectStore.getState().replaceProspects([sample]);
    useProspectStore.getState().resetProspects();
    expect(useProspectStore.getState().prospects).toHaveLength(mockProspects.length);
    expect(useProspectStore.getState().prospects[0].geologicalChanceOfSuccess).toBeDefined();
    expect(localStorage.removeItem).toHaveBeenCalledWith('petrotarget-ai:prospects');
  });

  it('persists and loads prospects from localStorage', () => {
    const localStorage = window.localStorage;
    useProspectStore.getState().replaceProspects([sample]);
    expect(localStorage.setItem).toHaveBeenCalledWith('petrotarget-ai:prospects', expect.any(String));

    useProspectStore.setState({ prospects: [] });
    useProspectStore.getState().loadFromStorage();
    expect(useProspectStore.getState().prospects).toHaveLength(1);
    expect(useProspectStore.getState().prospects[0].id).toBe('x1');
    expect(useProspectStore.getState().prospects[0].geologicalChanceOfSuccess).toBeDefined();
  });
});
