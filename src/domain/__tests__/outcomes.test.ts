import { describe, expect, it } from 'vitest';
import type { ProspectOutcome } from '../outcomes';
import {
  isKnownOutcome,
  isGeologicalSuccess,
  isCommercialSuccess,
  getOutcomeLabelText,
  getOutcomeSummary,
} from '../outcomes';

const makeOutcome = (overrides: Partial<ProspectOutcome> = {}): ProspectOutcome => ({
  label: 'commercial_discovery',
  targetVariable: 'geological_success',
  resultConfidence: 'high',
  source: 'historical',
  ...overrides,
});

// ── isKnownOutcome ───────────────────────────────────────────────────────────

describe('isKnownOutcome', () => {
  it('returns true for commercial_discovery', () => {
    expect(isKnownOutcome(makeOutcome({ label: 'commercial_discovery' }))).toBe(true);
  });

  it('returns true for technical_discovery', () => {
    expect(isKnownOutcome(makeOutcome({ label: 'technical_discovery' }))).toBe(true);
  });

  it('returns true for dry_hole', () => {
    expect(isKnownOutcome(makeOutcome({ label: 'dry_hole' }))).toBe(true);
  });

  it('returns true for non_commercial', () => {
    expect(isKnownOutcome(makeOutcome({ label: 'non_commercial' }))).toBe(true);
  });

  it('returns false for unknown', () => {
    expect(isKnownOutcome(makeOutcome({ label: 'unknown' }))).toBe(false);
  });
});

// ── isGeologicalSuccess ──────────────────────────────────────────────────────

describe('isGeologicalSuccess', () => {
  it('returns true for commercial_discovery', () => {
    expect(isGeologicalSuccess(makeOutcome({ label: 'commercial_discovery' }))).toBe(true);
  });

  it('returns true for technical_discovery', () => {
    expect(isGeologicalSuccess(makeOutcome({ label: 'technical_discovery' }))).toBe(true);
  });

  it('returns false for dry_hole', () => {
    expect(isGeologicalSuccess(makeOutcome({ label: 'dry_hole' }))).toBe(false);
  });

  it('returns false for non_commercial', () => {
    expect(isGeologicalSuccess(makeOutcome({ label: 'non_commercial' }))).toBe(false);
  });

  it('returns false for unknown', () => {
    expect(isGeologicalSuccess(makeOutcome({ label: 'unknown' }))).toBe(false);
  });
});

// ── isCommercialSuccess ──────────────────────────────────────────────────────

describe('isCommercialSuccess', () => {
  it('returns true only for commercial_discovery', () => {
    expect(isCommercialSuccess(makeOutcome({ label: 'commercial_discovery' }))).toBe(true);
    expect(isCommercialSuccess(makeOutcome({ label: 'technical_discovery' }))).toBe(false);
    expect(isCommercialSuccess(makeOutcome({ label: 'dry_hole' }))).toBe(false);
    expect(isCommercialSuccess(makeOutcome({ label: 'non_commercial' }))).toBe(false);
    expect(isCommercialSuccess(makeOutcome({ label: 'unknown' }))).toBe(false);
  });
});

// ── getOutcomeLabelText ──────────────────────────────────────────────────────

describe('getOutcomeLabelText', () => {
  it('returns human-readable label for each outcome', () => {
    expect(getOutcomeLabelText('commercial_discovery')).toBe('Commercial Discovery');
    expect(getOutcomeLabelText('technical_discovery')).toBe('Technical Discovery');
    expect(getOutcomeLabelText('dry_hole')).toBe('Dry Hole');
    expect(getOutcomeLabelText('non_commercial')).toBe('Non-Commercial');
    expect(getOutcomeLabelText('unknown')).toBe('Unknown');
  });
});

// ── getOutcomeSummary ────────────────────────────────────────────────────────

describe('getOutcomeSummary', () => {
  it('returns label text only when no optional fields set', () => {
    const summary = getOutcomeSummary(makeOutcome({ label: 'dry_hole' }));
    expect(summary).toBe('Dry Hole');
  });

  it('includes wellName when set', () => {
    const summary = getOutcomeSummary(makeOutcome({ wellName: 'Well-1A' }));
    expect(summary).toContain('Well: Well-1A');
  });

  it('includes drillYear when set', () => {
    const summary = getOutcomeSummary(makeOutcome({ drillYear: 2020 }));
    expect(summary).toContain('Year: 2020');
  });

  it('includes operator when set', () => {
    const summary = getOutcomeSummary(makeOutcome({ operator: 'ExploCorp' }));
    expect(summary).toContain('Operator: ExploCorp');
  });

  it('includes all optional fields when all set', () => {
    const summary = getOutcomeSummary(makeOutcome({
      label: 'commercial_discovery',
      wellName: 'Alpha-1',
      drillYear: 2018,
      operator: 'PetroCo',
    }));
    expect(summary).toContain('Commercial Discovery');
    expect(summary).toContain('Well: Alpha-1');
    expect(summary).toContain('Year: 2018');
    expect(summary).toContain('Operator: PetroCo');
  });
});
