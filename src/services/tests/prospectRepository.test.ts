import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prospectToRow, rowToProspect, getProspectRepository, localProspectRepository } from '../prospectRepository';
import type { Prospect } from '../../domain/prospect';
import type { DbProspectRow } from '../prospectRepository';
import { createDefaultEvidence } from '../../domain/evidenceDefaults';

const baseProspect: Prospect = {
  id: 'test-repo-1',
  name: 'Repo Test Prospect',
  basin: 'Test Basin',
  block: 'A',
  playType: 'Structural',
  latitude: -38,
  longitude: -68,
  sourceScore: 0.7,
  migrationScore: 0.7,
  reservoirScore: 0.7,
  sealScore: 0.7,
  trapScore: 0.7,
  timingScore: 0.7,
  commercialScore: 75,
  resourceEstimate: 100,
};

const baseRow: DbProspectRow = {
  id: 'test-repo-1',
  name: 'Repo Test Prospect',
  basin: 'Test Basin',
  block: 'A',
  play_type: 'Structural',
  latitude: -38,
  longitude: -68,
  source_score: 0.7,
  migration_score: 0.7,
  reservoir_score: 0.7,
  seal_score: 0.7,
  trap_score: 0.7,
  timing_score: 0.7,
  commercial_score: 75,
  resource_estimate: 100,
  scoring_mode: 'manual',
};

// ── Mapping: Prospect → DB row ────────────────────────────────────────────────

describe('prospectToRow', () => {
  it('maps all base fields to snake_case', () => {
    const row = prospectToRow(baseProspect);
    expect(row.id).toBe('test-repo-1');
    expect(row.play_type).toBe('Structural');
    expect(row.source_score).toBe(0.7);
    expect(row.commercial_score).toBe(75);
    expect(row.resource_estimate).toBe(100);
    expect(row.latitude).toBe(-38);
    expect(row.longitude).toBe(-68);
  });

  it('defaults scoring_mode to manual when not set', () => {
    const row = prospectToRow(baseProspect);
    expect(row.scoring_mode).toBe('manual');
  });

  it('preserves scoringMode evidence_derived', () => {
    const row = prospectToRow({ ...baseProspect, scoringMode: 'evidence_derived' });
    expect(row.scoring_mode).toBe('evidence_derived');
  });

  it('preserves evidence as JSONB', () => {
    const evidence = createDefaultEvidence();
    const row = prospectToRow({ ...baseProspect, scoringMode: 'evidence_derived', evidence });
    expect(row.evidence).toEqual(evidence);
  });

  it('preserves economicAssumptions as JSONB', () => {
    const assumptions = { oilPriceUsdPerBbl: 90, developmentCostUsdMM: 400 };
    const row = prospectToRow({ ...baseProspect, economicAssumptions: assumptions });
    expect(row.economic_assumptions).toEqual(assumptions);
  });

  it('sets evidence to null when not present', () => {
    const row = prospectToRow(baseProspect);
    expect(row.evidence).toBeNull();
  });

  it('sets economic_assumptions to null when not present', () => {
    const row = prospectToRow(baseProspect);
    expect(row.economic_assumptions).toBeNull();
  });
});

// ── Mapping: DB row → Prospect ────────────────────────────────────────────────

describe('rowToProspect', () => {
  it('maps snake_case fields to camelCase', () => {
    const p = rowToProspect(baseRow);
    expect(p.playType).toBe('Structural');
    expect(p.sourceScore).toBe(0.7);
    expect(p.commercialScore).toBe(75);
    expect(p.resourceEstimate).toBe(100);
  });

  it('regenerates derived fields via scoreProspect', () => {
    const p = rowToProspect(baseRow);
    expect(p.geologicalChanceOfSuccess).toBeDefined();
    expect(p.priority).toBeDefined();
    expect(p.mainRisk).toBeDefined();
    expect(p.dataConfidence).toBeDefined();
    expect(p.economicAssessment).toBeDefined();
  });

  it('preserves evidence from DB', () => {
    const evidence = createDefaultEvidence();
    const p = rowToProspect({ ...baseRow, scoring_mode: 'evidence_derived', evidence });
    expect(p.evidence).toEqual(evidence);
    expect(p.scoringMode).toBe('evidence_derived');
  });

  it('preserves economicAssumptions from DB', () => {
    const assumptions = { oilPriceUsdPerBbl: 90 };
    const p = rowToProspect({ ...baseRow, economic_assumptions: assumptions });
    expect(p.economicAssumptions).toEqual(assumptions);
  });

  it('round-trip: prospect → row → prospect preserves all user-set fields', () => {
    const evidence = createDefaultEvidence();
    const assumptions = { oilPriceUsdPerBbl: 90, developmentCostUsdMM: 400 };
    const original: Prospect = {
      ...baseProspect,
      scoringMode: 'evidence_derived',
      targetPhase: 'oil',
      evidence,
      economicAssumptions: assumptions,
    };
    const row = prospectToRow(original);
    const restored = rowToProspect(row as DbProspectRow);
    expect(restored.id).toBe(original.id);
    expect(restored.name).toBe(original.name);
    expect(restored.scoringMode).toBe('evidence_derived');
    expect(restored.targetPhase).toBe('oil');
    expect(restored.evidence).toEqual(evidence);
    expect(restored.economicAssumptions).toEqual(assumptions);
    // Derived fields regenerated
    expect(restored.geologicalChanceOfSuccess).toBeDefined();
    expect(restored.economicAssessment).toBeDefined();
  });
});

// ── Repository factory ────────────────────────────────────────────────────────

describe('getProspectRepository', () => {
  it('returns local repository when Supabase is not configured', () => {
    // isSupabaseConfigured is false in test env (no VITE_SUPABASE_URL/ANON_KEY)
    const repo = getProspectRepository();
    expect(repo).toBe(localProspectRepository);
  });
});

// ── Local repository ──────────────────────────────────────────────────────────

describe('localProspectRepository', () => {
  const createMemoryStorage = () => {
    const values = new Map<string, string>();
    return {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
      removeItem: vi.fn((key: string) => { values.delete(key); }),
      clear: vi.fn(() => values.clear()),
    };
  };

  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: createMemoryStorage() });
  });

  it('listProspects returns scored prospects (falls back to sample data)', async () => {
    const prospects = await localProspectRepository.listProspects();
    expect(Array.isArray(prospects)).toBe(true);
    expect(prospects.length).toBeGreaterThan(0);
    expect(prospects[0].geologicalChanceOfSuccess).toBeDefined();
  });

  it('createProspect adds and scores a prospect', async () => {
    await localProspectRepository.createProspect(baseProspect);
    const prospects = await localProspectRepository.listProspects();
    const created = prospects.find((p) => p.id === 'test-repo-1');
    expect(created).toBeDefined();
    expect(created!.geologicalChanceOfSuccess).toBeDefined();
    expect(created!.economicAssessment).toBeDefined();
  });

  it('updateProspect updates and re-scores', async () => {
    await localProspectRepository.createProspect(baseProspect);
    const updated = await localProspectRepository.updateProspect('test-repo-1', { ...baseProspect, sourceScore: 0.9 });
    expect(updated.sourceScore).toBe(0.9);
    expect(updated.geologicalChanceOfSuccess).toBeDefined();
  });

  it('deleteProspect removes the prospect', async () => {
    await localProspectRepository.createProspect(baseProspect);
    await localProspectRepository.deleteProspect('test-repo-1');
    const prospects = await localProspectRepository.listProspects();
    expect(prospects.find((p) => p.id === 'test-repo-1')).toBeUndefined();
  });

  it('preserves evidence across create/list', async () => {
    const evidence = createDefaultEvidence();
    await localProspectRepository.createProspect({ ...baseProspect, scoringMode: 'evidence_derived', evidence });
    const prospects = await localProspectRepository.listProspects();
    const found = prospects.find((p) => p.id === 'test-repo-1');
    expect(found?.evidence).toEqual(evidence);
  });

  it('preserves economicAssumptions across create/list', async () => {
    const assumptions = { oilPriceUsdPerBbl: 90 };
    await localProspectRepository.createProspect({ ...baseProspect, economicAssumptions: assumptions });
    const prospects = await localProspectRepository.listProspects();
    const found = prospects.find((p) => p.id === 'test-repo-1');
    expect(found?.economicAssumptions).toEqual(assumptions);
  });
});
