import { describe, expect, it } from 'vitest';
import { useProspectStore } from './useProspectStore';

const sample = {
  id: 'x1', name: 'X1', basin: 'Neuquén Basin', block: 'X', playType: 'Shale', latitude: -38, longitude: -68,
  sourceScore: 0.8, migrationScore: 0.8, reservoirScore: 0.8, sealScore: 0.8, trapScore: 0.8, timingScore: 0.8,
  commercialScore: 80, resourceEstimate: 20
};

describe('useProspectStore import behavior', () => {
  it('replaceProspects replaces portfolio', () => {
    useProspectStore.setState({ prospects: [] as any, filters: { basin: '', block: '', playType: '', priority: '' } as any });
    useProspectStore.getState().replaceProspects([sample as any]);
    expect(useProspectStore.getState().prospects).toHaveLength(1);
    expect(useProspectStore.getState().prospects[0].id).toBe('x1');
  });

  it('appendProspects appends without deleting existing', () => {
    useProspectStore.getState().replaceProspects([sample as any]);
    useProspectStore.getState().appendProspects([{ ...sample, id: 'x2', name: 'X2' } as any]);
    expect(useProspectStore.getState().prospects.length).toBeGreaterThanOrEqual(2);
    expect(useProspectStore.getState().prospects.some((p) => p.id === 'x1')).toBe(true);
    expect(useProspectStore.getState().prospects.some((p) => p.id === 'x2')).toBe(true);
  });
});
