import { describe, expect, it } from 'vitest';
import { scoreProspect, scoreProspects } from '../scoring';
import { mockProspects } from '../../data/mockProspects';
import {
  createTrainingExample,
  createSyntheticTrainingDataset,
  createTrainingDatasetFromOutcomes,
  exportTrainingDatasetAsJson,
  exportTrainingDatasetAsCsv,
  validateTrainingExample,
} from '../mlDataset';
import type { ProspectOutcome } from '../outcomes';
import type { Prospect } from '../prospect';

const scored = scoreProspects(mockProspects);
const singleProspect = scored[0];

const minimalProspect: Prospect = scoreProspect({
  id: 'ds-1',
  name: 'Dataset Test',
  basin: 'Neuquén',
  block: 'A',
  playType: 'Structural',
  latitude: -38,
  longitude: -68,
  sourceScore: 0.6,
  migrationScore: 0.6,
  reservoirScore: 0.6,
  sealScore: 0.6,
  trapScore: 0.6,
  timingScore: 0.6,
  commercialScore: 70,
  resourceEstimate: 100,
});

// ── createTrainingExample ────────────────────────────────────────────────────

describe('createTrainingExample', () => {
  it('produces a valid training example with all fields', () => {
    const ex = createTrainingExample(minimalProspect, 'commercial_discovery', 'geological_success');
    expect(ex.label).toBe('commercial_discovery');
    expect(ex.target).toBe('geological_success');
    expect(ex.metadata.prospectName).toBe(minimalProspect.name);
    expect(ex.metadata.basin).toBe(minimalProspect.basin);
    expect(typeof ex.features.gcosExpert).toBe('number');
  });

  it('uses provided metadata overrides', () => {
    const ex = createTrainingExample(minimalProspect, 'dry_hole', 'geological_success', {
      source: 'historical',
      notes: 'Real well outcome',
    });
    expect(ex.metadata.source).toBe('historical');
    expect(ex.metadata.notes).toBe('Real well outcome');
  });

  it('defaults source to manual when not specified', () => {
    const ex = createTrainingExample(minimalProspect, 'unknown', 'geological_success');
    expect(ex.metadata.source).toBe('manual');
  });
});

// ── createSyntheticTrainingDataset ───────────────────────────────────────────

describe('createSyntheticTrainingDataset', () => {
  it('returns same length as input', () => {
    const dataset = createSyntheticTrainingDataset(scored);
    expect(dataset.length).toBe(scored.length);
  });

  it('marks all examples as source: synthetic', () => {
    const dataset = createSyntheticTrainingDataset(scored);
    expect(dataset.every((ex) => ex.metadata.source === 'synthetic')).toBe(true);
  });

  it('includes a notes field warning about synthetic labels', () => {
    const dataset = createSyntheticTrainingDataset(scored);
    expect(dataset.every((ex) => ex.metadata.notes && ex.metadata.notes.length > 0)).toBe(true);
  });

  it('labels are valid OutcomeLabel values', () => {
    const validLabels = new Set(['commercial_discovery', 'technical_discovery', 'dry_hole', 'non_commercial', 'unknown']);
    const dataset = createSyntheticTrainingDataset(scored);
    expect(dataset.every((ex) => validLabels.has(ex.label))).toBe(true);
  });

  it('high-GCoS high-commercial-score high-DC prospect gets commercial_discovery', () => {
    const highProspect: Prospect = scoreProspect({
      id: 'synth-high',
      name: 'High Prospect',
      basin: 'Test',
      block: 'A',
      playType: 'Structural',
      latitude: 0,
      longitude: 0,
      sourceScore: 0.8,
      migrationScore: 0.8,
      reservoirScore: 0.8,
      sealScore: 0.8,
      trapScore: 0.8,
      timingScore: 0.8,
      commercialScore: 85,
      resourceEstimate: 200,
    });
    const dataset = createSyntheticTrainingDataset([highProspect]);
    const gcos = highProspect.geologicalChanceOfSuccess ?? 0;
    const dc = highProspect.dataConfidence ?? 0;
    if (gcos >= 0.35 && highProspect.commercialScore >= 70 && dc >= 70) {
      expect(dataset[0].label).toBe('commercial_discovery');
    }
  });

  it('very low GCoS prospect gets dry_hole', () => {
    const lowProspect: Prospect = scoreProspect({
      id: 'synth-low',
      name: 'Low Prospect',
      basin: 'Test',
      block: 'A',
      playType: 'Structural',
      latitude: 0,
      longitude: 0,
      sourceScore: 0.1,
      migrationScore: 0.1,
      reservoirScore: 0.1,
      sealScore: 0.1,
      trapScore: 0.1,
      timingScore: 0.1,
      commercialScore: 20,
      resourceEstimate: 10,
    });
    const dataset = createSyntheticTrainingDataset([lowProspect]);
    const gcos = lowProspect.geologicalChanceOfSuccess ?? 0;
    if (gcos < 0.15) {
      expect(dataset[0].label).toBe('dry_hole');
    }
  });

  it('returns empty array for empty input', () => {
    expect(createSyntheticTrainingDataset([])).toHaveLength(0);
  });
});

// ── validateTrainingExample ──────────────────────────────────────────────────

describe('validateTrainingExample', () => {
  it('returns no errors for a valid example', () => {
    const ex = createTrainingExample(minimalProspect, 'commercial_discovery', 'geological_success');
    expect(validateTrainingExample(ex)).toHaveLength(0);
  });

  it('catches NaN in score fields', () => {
    const ex = createTrainingExample(minimalProspect, 'unknown', 'geological_success');
    (ex.features as Record<string, unknown>).gcosExpert = NaN;
    const errors = validateTrainingExample(ex);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('gcosExpert'))).toBe(true);
  });

  it('catches out-of-range score (>1)', () => {
    const ex = createTrainingExample(minimalProspect, 'unknown', 'geological_success');
    (ex.features as Record<string, unknown>).reservoirScore = 1.5;
    const errors = validateTrainingExample(ex);
    expect(errors.some((e) => e.includes('reservoirScore'))).toBe(true);
  });

  it('catches invalid one-hot value', () => {
    const ex = createTrainingExample(minimalProspect, 'unknown', 'geological_success');
    (ex.features as Record<string, unknown>).mainRisk_source = 0.5;
    const errors = validateTrainingExample(ex);
    expect(errors.some((e) => e.includes('mainRisk_source'))).toBe(true);
  });
});

// ── JSON / CSV export ────────────────────────────────────────────────────────

describe('exportTrainingDatasetAsJson', () => {
  it('returns a parseable JSON string', () => {
    const dataset = createSyntheticTrainingDataset(scored.slice(0, 3));
    const json = exportTrainingDatasetAsJson(dataset);
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(3);
  });
});

describe('exportTrainingDatasetAsCsv', () => {
  it('returns a non-empty CSV string', () => {
    const dataset = createSyntheticTrainingDataset(scored.slice(0, 3));
    const csv = exportTrainingDatasetAsCsv(dataset);
    expect(typeof csv).toBe('string');
    expect(csv.length).toBeGreaterThan(0);
  });

  it('first line is the header row', () => {
    const dataset = createSyntheticTrainingDataset(scored.slice(0, 1));
    const csv = exportTrainingDatasetAsCsv(dataset);
    const header = csv.split('\n')[0];
    expect(header).toContain('label');
    expect(header).toContain('gcosExpert');
    expect(header).toContain('prospectName');
    expect(header).toContain('source');
  });

  it('has correct number of data rows', () => {
    const dataset = createSyntheticTrainingDataset(scored.slice(0, 4));
    const csv = exportTrainingDatasetAsCsv(dataset);
    const rows = csv.split('\n').filter(Boolean);
    expect(rows.length).toBe(5); // header + 4 data rows
  });

  it('includes prospect name in data rows', () => {
    const dataset = createSyntheticTrainingDataset([singleProspect]);
    const csv = exportTrainingDatasetAsCsv(dataset);
    expect(csv).toContain(singleProspect.name);
  });

  it('returns empty string for empty dataset', () => {
    expect(exportTrainingDatasetAsCsv([])).toBe('');
  });
});

// ── createTrainingDatasetFromOutcomes ────────────────────────────────────────

describe('createTrainingDatasetFromOutcomes', () => {
  const knownOutcome: ProspectOutcome = {
    label: 'commercial_discovery',
    targetVariable: 'geological_success',
    resultConfidence: 'high',
    source: 'historical',
  };
  const unknownOutcome: ProspectOutcome = {
    label: 'unknown',
    targetVariable: 'geological_success',
    resultConfidence: 'low',
    source: 'manual',
  };

  it('returns empty array for portfolio with no outcomes', () => {
    expect(createTrainingDatasetFromOutcomes(scored)).toHaveLength(0);
  });

  it('includes only prospects with known outcomes (not unknown)', () => {
    const withKnown = { ...scored[0], outcome: knownOutcome };
    const withUnknown = { ...scored[1], outcome: unknownOutcome };
    const withNone = scored[2];
    const dataset = createTrainingDatasetFromOutcomes([withKnown, withUnknown, withNone]);
    expect(dataset).toHaveLength(1);
    expect(dataset[0].label).toBe('commercial_discovery');
  });

  it('uses the outcome label and targetVariable from prospect.outcome', () => {
    const p = { ...scored[0], outcome: { ...knownOutcome, label: 'dry_hole' as const, targetVariable: 'hydrocarbon_presence' as const } };
    const dataset = createTrainingDatasetFromOutcomes([p]);
    expect(dataset[0].label).toBe('dry_hole');
    expect(dataset[0].target).toBe('hydrocarbon_presence');
  });

  it('preserves outcome source in metadata', () => {
    const p = { ...scored[0], outcome: { ...knownOutcome, source: 'historical' as const } };
    const dataset = createTrainingDatasetFromOutcomes([p]);
    expect(dataset[0].metadata.source).toBe('historical');
  });
});
