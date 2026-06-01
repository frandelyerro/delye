import { describe, expect, it } from 'vitest';
import { scoreProspect, scoreProspects } from '../scoring';
import { mockProspects } from '../../data/mockProspects';
import { assessMLReadiness } from '../mlReadiness';
import type { Prospect } from '../prospect';

const scored = scoreProspects(mockProspects);

const makeProspect = (id: string, overrides: Partial<Prospect> = {}): Prospect =>
  scoreProspect({
    id,
    name: `Prospect ${id}`,
    basin: 'Test',
    block: 'A',
    playType: 'Structural',
    latitude: 0,
    longitude: 0,
    sourceScore: 0.6,
    migrationScore: 0.6,
    reservoirScore: 0.6,
    sealScore: 0.6,
    trapScore: 0.6,
    timingScore: 0.6,
    commercialScore: 65,
    resourceEstimate: 100,
    ...overrides,
  });

// ── empty portfolio ──────────────────────────────────────────────────────────

describe('assessMLReadiness — empty portfolio', () => {
  it('returns not_ready', () => {
    const r = assessMLReadiness([]);
    expect(r.status).toBe('not_ready');
    expect(r.readinessScore).toBe(0);
    expect(r.totalProspects).toBe(0);
  });

  it('includes missing requirements', () => {
    const r = assessMLReadiness([]);
    expect(r.missingRequirements.length).toBeGreaterThan(0);
  });
});

// ── manual-only portfolio ────────────────────────────────────────────────────

describe('assessMLReadiness — manual-only portfolio', () => {
  const manualPortfolio = Array.from({ length: 5 }, (_, i) => makeProspect(`m${i}`));

  it('returns partial or not_ready (not ready_for_baseline)', () => {
    const r = assessMLReadiness(manualPortfolio);
    expect(['not_ready', 'partial']).toContain(r.status);
  });

  it('evidenceDerivedCount is 0', () => {
    const r = assessMLReadiness(manualPortfolio);
    expect(r.evidenceDerivedCount).toBe(0);
  });

  it('labeledExamples is 0', () => {
    const r = assessMLReadiness(manualPortfolio);
    expect(r.labeledExamples).toBe(0);
  });
});

// ── ready_for_baseline threshold ─────────────────────────────────────────────

describe('assessMLReadiness — ready_for_baseline', () => {
  const evidenceDerivedProspects = Array.from({ length: 10 }, (_, i) =>
    makeProspect(`ev${i}`, { scoringMode: 'evidence_derived' })
  );

  it('returns ready_for_baseline with >= 10 prospects and >= 5 evidence-derived', () => {
    const r = assessMLReadiness(evidenceDerivedProspects);
    expect(r.status).toBe('ready_for_baseline');
    expect(r.readinessScore).toBeGreaterThan(0);
  });

  it('total and evidence-derived counts are correct', () => {
    const r = assessMLReadiness(evidenceDerivedProspects);
    expect(r.totalProspects).toBe(10);
    expect(r.evidenceDerivedCount).toBe(10);
  });
});

// ── not ready_for_training (no labeled examples) ─────────────────────────────

describe('assessMLReadiness — not ready_for_training', () => {
  it('never returns ready_for_training without labeled examples', () => {
    const largePortfolio = Array.from({ length: 50 }, (_, i) =>
      makeProspect(`lp${i}`, { scoringMode: 'evidence_derived' })
    );
    const r = assessMLReadiness(largePortfolio);
    expect(r.status).not.toBe('ready_for_training');
    expect(r.labeledExamples).toBe(0);
  });
});

// ── readinessScore bounds ────────────────────────────────────────────────────

describe('assessMLReadiness — readinessScore', () => {
  it('is always in [0, 100]', () => {
    const cases = [[], scored, Array.from({ length: 3 }, (_, i) => makeProspect(`x${i}`))];
    for (const portfolio of cases) {
      const r = assessMLReadiness(portfolio);
      expect(r.readinessScore).toBeGreaterThanOrEqual(0);
      expect(r.readinessScore).toBeLessThanOrEqual(100);
    }
  });
});

// ── recommendations present ──────────────────────────────────────────────────

describe('assessMLReadiness — recommendations', () => {
  it('always includes at least one recommendation', () => {
    const r = assessMLReadiness(scored);
    expect(r.recommendations.length).toBeGreaterThan(0);
  });
});

// ── real outcome counting ────────────────────────────────────────────────────

describe('assessMLReadiness — real outcome counting', () => {
  it('counts known outcomes from prospect.outcome field', () => {
    const withOutcome = makeProspect('o1', {
      outcome: {
        label: 'commercial_discovery',
        targetVariable: 'geological_success',
        resultConfidence: 'high',
        source: 'historical',
      },
    });
    const withUnknown = makeProspect('o2', {
      outcome: {
        label: 'unknown',
        targetVariable: 'geological_success',
        resultConfidence: 'low',
        source: 'manual',
      },
    });
    const withNone = makeProspect('o3');

    const r = assessMLReadiness([withOutcome, withUnknown, withNone]);
    expect(r.labeledExamples).toBe(1);
  });

  it('knownSuccessFailureCount counts discoveries and dry holes only', () => {
    const discovery = makeProspect('sf1', {
      outcome: { label: 'commercial_discovery', targetVariable: 'geological_success', resultConfidence: 'high', source: 'historical' },
    });
    const dryHole = makeProspect('sf2', {
      outcome: { label: 'dry_hole', targetVariable: 'geological_success', resultConfidence: 'high', source: 'historical' },
    });
    const nonCommercial = makeProspect('sf3', {
      outcome: { label: 'non_commercial', targetVariable: 'geological_success', resultConfidence: 'medium', source: 'historical' },
    });

    const r = assessMLReadiness([discovery, dryHole, nonCommercial]);
    expect(r.knownSuccessFailureCount).toBe(2);
    expect(r.labeledExamples).toBe(3);
  });

  it('returns knownSuccessFailureCount = 0 for portfolio with no outcomes', () => {
    const r = assessMLReadiness(scored);
    expect(r.knownSuccessFailureCount).toBe(0);
  });
});
