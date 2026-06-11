import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockProspects } from '../data/mockProspects';
import { Prospect } from '../domain/prospect';
import { scoreProspects } from '../domain/scoring';
import { createDefaultEvidence } from '../domain/evidenceDefaults';
import { getRecommendedAction } from '../domain/recommendationEngine';
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

  it('batchUpdateOutcomes sets outcomes for multiple prospects in one call', () => {
    useProspectStore.getState().replaceProspects([sample, { ...sample, id: 'x2', name: 'X2' }, { ...sample, id: 'x3', name: 'X3' }]);
    useProspectStore.getState().batchUpdateOutcomes([
      { id: 'x1', outcome: { label: 'dry_hole', targetVariable: 'geological_success', resultConfidence: 'high', source: 'manual' } },
      { id: 'x2', outcome: { label: 'commercial_discovery', targetVariable: 'commercial_success', resultConfidence: 'medium', source: 'manual' } },
    ]);
    const state = useProspectStore.getState();
    expect(state.prospects.find((p) => p.id === 'x1')?.outcome?.label).toBe('dry_hole');
    expect(state.prospects.find((p) => p.id === 'x2')?.outcome?.label).toBe('commercial_discovery');
    expect(state.prospects.find((p) => p.id === 'x3')?.outcome).toBeUndefined();
  });

  it('batchUpdateOutcomes overwrites a previously recorded outcome', () => {
    useProspectStore.getState().replaceProspects([sample]);
    useProspectStore.getState().batchUpdateOutcomes([
      { id: 'x1', outcome: { label: 'non_commercial', targetVariable: 'geological_success', resultConfidence: 'low', source: 'manual' } },
    ]);
    useProspectStore.getState().batchUpdateOutcomes([
      { id: 'x1', outcome: { label: 'dry_hole', targetVariable: 'geological_success', resultConfidence: 'high', source: 'manual' } },
    ]);
    const updated = useProspectStore.getState().prospects.find((p) => p.id === 'x1');
    expect(updated?.outcome?.label).toBe('dry_hole');
    expect(updated?.outcome?.resultConfidence).toBe('high');
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

  it('creates an evidence-derived prospect and preserves evidence after scoring', () => {
    useProspectStore.setState({ prospects: [] });
    const evidenceProspect: Prospect = {
      ...sample,
      id: 'ev1',
      name: 'Evidence Test',
      scoringMode: 'evidence_derived',
      targetPhase: 'oil',
      evidence: {
        ...createDefaultEvidence(),
        source: { presence: 'proven', tocPercent: 3.5, sources: ['well'] },
      },
    };
    useProspectStore.getState().createProspect(evidenceProspect);
    const stored = useProspectStore.getState().prospects.find((p) => p.id === 'ev1');
    expect(stored).toBeDefined();
    expect(stored!.scoringMode).toBe('evidence_derived');
    expect(stored!.evidence).toBeDefined();
    expect(stored!.evidence!.source!.presence).toBe('proven');
    // Scores should be engine-derived, not the placeholder 0.8s
    expect(stored!.geologicalChanceOfSuccess).toBeDefined();
    expect(stored!.geoscienceAssessment).toBeDefined();
  });

  it('manual prospect save is unchanged — no evidence or geoscienceAssessment', () => {
    useProspectStore.setState({ prospects: [] });
    useProspectStore.getState().createProspect({ ...sample, scoringMode: 'manual' });
    const stored = useProspectStore.getState().prospects.find((p) => p.id === 'x1');
    expect(stored!.scoringMode).toBe('manual');
    expect(stored!.geoscienceAssessment).toBeUndefined();
  });

  it('updating evidence-derived prospect re-derives scores from new evidence', () => {
    const baseEvidence = createDefaultEvidence();
    const evidenceProspect: Prospect = {
      ...sample,
      id: 'ev2',
      name: 'Evidence Update Test',
      scoringMode: 'evidence_derived',
      targetPhase: 'oil',
      evidence: baseEvidence,
    };
    useProspectStore.getState().replaceProspects([evidenceProspect]);
    const before = useProspectStore.getState().prospects[0].geologicalChanceOfSuccess ?? 0;

    const updatedEvidence = {
      ...baseEvidence,
      source: { presence: 'proven' as const, tocPercent: 4.0, roPercent: 0.8, sources: ['well' as const] },
      reservoir: { presence: 'proven' as const, porosityPercent: 22, permeabilityMd: 150, sources: ['well' as const] },
    };
    useProspectStore.getState().updateProspect('ev2', {
      ...evidenceProspect,
      evidence: updatedEvidence,
    });
    const after = useProspectStore.getState().prospects[0].geologicalChanceOfSuccess ?? 0;
    expect(after).toBeGreaterThan(before);
  });

  it('evidence-derived prospect persists and reloads with evidence intact', () => {
    const localStorage = window.localStorage;
    const evidenceProspect: Prospect = {
      ...sample,
      id: 'ev3',
      scoringMode: 'evidence_derived',
      evidence: { ...createDefaultEvidence(), source: { presence: 'probable', sources: ['seismic'] } },
    };
    useProspectStore.getState().replaceProspects([evidenceProspect]);
    expect(localStorage.setItem).toHaveBeenCalled();

    useProspectStore.setState({ prospects: [] });
    useProspectStore.getState().loadFromStorage();
    const reloaded = useProspectStore.getState().prospects.find((p) => p.id === 'ev3');
    expect(reloaded!.scoringMode).toBe('evidence_derived');
    expect(reloaded!.evidence!.source!.presence).toBe('probable');
  });

  it('high GCoS + low data confidence never produces drill_candidate (targeting regression)', () => {
    const highGcosLowDC: Prospect = {
      ...sample,
      id: 'reg1',
      sourceScore: 0.9, migrationScore: 0.9, reservoirScore: 0.9,
      sealScore: 0.9, trapScore: 0.9, timingScore: 0.9,
      commercialScore: 80,
      geologicalChanceOfSuccess: 0.531441,
      dataConfidence: 35,
    };
    expect(getRecommendedAction(highGcosLowDC)).not.toBe('drill_candidate');
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
