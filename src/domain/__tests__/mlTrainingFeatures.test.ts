import { describe, expect, it } from 'vitest';
import type { Prospect } from '../prospect';
import type { ProspectOutcome, OutcomeLabel } from '../outcomes';
import { getDefaultMLTrainingConfig } from '../mlTrainingService';
import {
  buildTrainingRows,
  extractTrainingFeatures,
  getTrainingLabel,
  looksDefaultedFeatures,
} from '../mlTrainingFeatures';

const makeProspect = (overrides: Partial<Prospect> = {}): Prospect => ({
  id: 'p1',
  name: 'P1',
  basin: 'Neuquen',
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
  commercialScore: 70,
  resourceEstimate: 100,
  ...overrides,
});

const makeOutcome = (
  label: OutcomeLabel,
  source: ProspectOutcome['source'] = 'historical',
): ProspectOutcome => ({
  label,
  targetVariable: 'geological_success',
  resultConfidence: 'high',
  source,
});

describe('getTrainingLabel', () => {
  it('maps hydrocarbon_presence labels correctly', () => {
    const m = (label: OutcomeLabel) => getTrainingLabel(makeProspect({ outcome: makeOutcome(label) }), 'hydrocarbon_presence');
    expect(m('commercial_discovery')).toBe(1);
    expect(m('technical_discovery')).toBe(1);
    expect(m('non_commercial')).toBe(1);
    expect(m('dry_hole')).toBe(0);
    expect(m('unknown')).toBeNull();
  });

  it('maps geological_success labels correctly', () => {
    const m = (label: OutcomeLabel) => getTrainingLabel(makeProspect({ outcome: makeOutcome(label) }), 'geological_success');
    expect(m('commercial_discovery')).toBe(1);
    expect(m('technical_discovery')).toBe(1);
    expect(m('non_commercial')).toBe(1);
    expect(m('dry_hole')).toBe(0);
    expect(m('unknown')).toBeNull();
  });

  it('maps commercial_success labels correctly', () => {
    const m = (label: OutcomeLabel) => getTrainingLabel(makeProspect({ outcome: makeOutcome(label) }), 'commercial_success');
    expect(m('commercial_discovery')).toBe(1);
    expect(m('technical_discovery')).toBe(0);
    expect(m('non_commercial')).toBe(0);
    expect(m('dry_hole')).toBe(0);
    expect(m('unknown')).toBeNull();
  });

  it('returns null when there is no outcome', () => {
    expect(getTrainingLabel(makeProspect(), 'geological_success')).toBeNull();
  });
});

describe('buildTrainingRows exclusion rules', () => {
  const config = getDefaultMLTrainingConfig();

  it('excludes prospects without outcomes', () => {
    const { rows, excluded } = buildTrainingRows([makeProspect()], config);
    expect(rows).toHaveLength(0);
    expect(excluded[0].reason).toMatch(/no recorded/i);
  });

  it('excludes unknown outcomes', () => {
    const { rows, excluded } = buildTrainingRows(
      [makeProspect({ outcome: makeOutcome('unknown') })],
      config,
    );
    expect(rows).toHaveLength(0);
    expect(excluded[0].reason).toMatch(/unknown/i);
  });

  it('excludes synthetic outcomes when excludeSynthetic is true', () => {
    const p = makeProspect({ outcome: makeOutcome('commercial_discovery', 'synthetic') });
    const { rows, excluded } = buildTrainingRows([p], config);
    expect(rows).toHaveLength(0);
    expect(excluded[0].reason).toMatch(/synthetic/i);
  });

  it('includes synthetic outcomes when excludeSynthetic is false', () => {
    const p = makeProspect({ outcome: makeOutcome('commercial_discovery', 'synthetic') });
    const { rows } = buildTrainingRows([p], { ...config, excludeSynthetic: false });
    expect(rows).toHaveLength(1);
    expect(rows[0].isSynthetic).toBe(true);
  });

  it('excludes rows with invalid coordinates', () => {
    const p = makeProspect({ latitude: 999, outcome: makeOutcome('dry_hole') });
    const { rows, excluded } = buildTrainingRows([p], config);
    expect(rows).toHaveLength(0);
    expect(excluded[0].reason).toMatch(/coordinate/i);
  });

  it('assigns the configured target to each row', () => {
    const p = makeProspect({ outcome: makeOutcome('commercial_discovery') });
    const { rows } = buildTrainingRows([p], { ...config, target: 'commercial_success' });
    expect(rows[0].target).toBe('commercial_success');
    expect(rows[0].label).toBe(1);
  });
});

describe('extractTrainingFeatures leakage prevention', () => {
  it('safe_pre_drill excludes resource/economic/post-drill/outcome fields', () => {
    const p = makeProspect({ outcome: makeOutcome('commercial_discovery') });
    const f = extractTrainingFeatures(p, 'safe_pre_drill');
    const forbidden = [
      'gcosExpert',
      'resourceEstimate',
      'commercialScore',
      'riskedResource',
      'simpleEMV',
      'prospectivityTierNumeric',
      'outcome',
      'outcome_label',
      'hydrocarbon_present',
      'geological_success',
      'commercial_success',
      'priority',
    ];
    for (const key of forbidden) {
      expect(f).not.toHaveProperty(key);
    }
    // sanity: it does include the allowed pre-drill features
    expect(f).toHaveProperty('sourceScore');
    expect(f).toHaveProperty('mainRisk_reservoir');
    expect(f).toHaveProperty('basin_hash');
    expect(f).toHaveProperty('evidenceCompleteness');
  });

  it('expert_calibration includes the expert-system GCoS', () => {
    const p = makeProspect();
    const f = extractTrainingFeatures(p, 'expert_calibration');
    expect(f).toHaveProperty('gcosExpert');
    expect(f.gcosExpert).toBeGreaterThan(0);
  });

  it('produces a one-hot main-risk encoding (exactly one flag set)', () => {
    const f = extractTrainingFeatures(makeProspect(), 'safe_pre_drill');
    const flags = [
      f.mainRisk_source,
      f.mainRisk_migration,
      f.mainRisk_reservoir,
      f.mainRisk_seal,
      f.mainRisk_trap,
      f.mainRisk_timing,
    ];
    expect(flags.filter((v) => v === 1)).toHaveLength(1);
  });
});

describe('defaulted feature detection', () => {
  it('looksDefaultedFeatures flags all-0.5 component scores', () => {
    expect(looksDefaultedFeatures(extractTrainingFeatures(makeProspect({
      sourceScore: 0.5, migrationScore: 0.5, reservoirScore: 0.5,
      sealScore: 0.5, trapScore: 0.5, timingScore: 0.5,
    }), 'safe_pre_drill'))).toBe(true);
    expect(looksDefaultedFeatures(extractTrainingFeatures(makeProspect(), 'safe_pre_drill'))).toBe(false);
  });

  it('emits a defaulted-features warning when appropriate', () => {
    const defaulted = Array.from({ length: 6 }, (_, i) =>
      makeProspect({
        id: `d${i}`,
        sourceScore: 0.5, migrationScore: 0.5, reservoirScore: 0.5,
        sealScore: 0.5, trapScore: 0.5, timingScore: 0.5,
        outcome: makeOutcome(i % 2 === 0 ? 'commercial_discovery' : 'dry_hole'),
      }),
    );
    const { warnings } = buildTrainingRows(defaulted, getDefaultMLTrainingConfig());
    expect(warnings.some((w) => /defaulted/i.test(w))).toBe(true);
  });
});
