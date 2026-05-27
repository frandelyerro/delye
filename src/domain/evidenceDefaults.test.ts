import { describe, expect, it } from 'vitest';
import { createDefaultEvidence } from './evidenceDefaults';
import { assessPetroleumSystem } from './geoscienceEngine';

describe('createDefaultEvidence', () => {
  it('returns an object with all six components', () => {
    const ev = createDefaultEvidence();
    expect(ev.source).toBeDefined();
    expect(ev.migration).toBeDefined();
    expect(ev.reservoir).toBeDefined();
    expect(ev.seal).toBeDefined();
    expect(ev.trap).toBeDefined();
    expect(ev.timing).toBeDefined();
  });

  it('defaults source presence to unknown', () => {
    expect(createDefaultEvidence().source!.presence).toBe('unknown');
  });

  it('defaults migration pathway to unknown', () => {
    expect(createDefaultEvidence().migration!.pathway).toBe('unknown');
  });

  it('defaults reservoir presence to unknown', () => {
    expect(createDefaultEvidence().reservoir!.presence).toBe('unknown');
  });

  it('defaults seal presence to unknown', () => {
    expect(createDefaultEvidence().seal!.presence).toBe('unknown');
  });

  it('defaults trap closure as not mapped', () => {
    expect(createDefaultEvidence().trap!.closureMapped).toBe(false);
  });

  it('defaults trap type to unknown', () => {
    expect(createDefaultEvidence().trap!.trapType).toBe('unknown');
  });

  it('defaults trap seismic confidence to unknown', () => {
    expect(createDefaultEvidence().trap!.seismicConfidence).toBe('unknown');
  });

  it('defaults timing trapFormedBeforeMigration to uncertain', () => {
    expect(createDefaultEvidence().timing!.trapFormedBeforeMigration).toBe('uncertain');
  });

  it('defaults timing charge timing to unknown', () => {
    expect(createDefaultEvidence().timing!.chargeTiming).toBe('unknown');
  });

  it('defaults timing burial history confidence to unknown', () => {
    expect(createDefaultEvidence().timing!.burialHistoryConfidence).toBe('unknown');
  });

  it('leaves optional numeric fields undefined', () => {
    const ev = createDefaultEvidence();
    expect(ev.source!.tocPercent).toBeUndefined();
    expect(ev.source!.roPercent).toBeUndefined();
    expect(ev.source!.tmaxC).toBeUndefined();
    expect(ev.source!.sourceThicknessM).toBeUndefined();
    expect(ev.source!.distanceToKitchenKm).toBeUndefined();
    expect(ev.reservoir!.porosityPercent).toBeUndefined();
    expect(ev.reservoir!.permeabilityMd).toBeUndefined();
    expect(ev.reservoir!.netPayM).toBeUndefined();
    expect(ev.reservoir!.vshaleFraction).toBeUndefined();
    expect(ev.seal!.thicknessM).toBeUndefined();
    expect(ev.trap!.closureAreaKm2).toBeUndefined();
    expect(ev.trap!.closureHeightM).toBeUndefined();
    expect(ev.migration!.distanceFromKitchenKm).toBeUndefined();
  });

  it('each call returns a new independent object', () => {
    const a = createDefaultEvidence();
    const b = createDefaultEvidence();
    a.source!.presence = 'proven';
    expect(b.source!.presence).toBe('unknown');
  });

  it('evidence integrates with assessPetroleumSystem without throwing', () => {
    const ev = createDefaultEvidence();
    expect(() => assessPetroleumSystem(ev, 'unknown')).not.toThrow();
  });

  it('all-unknown default evidence produces valid (but low) component scores', () => {
    const ev = createDefaultEvidence();
    const assessment = assessPetroleumSystem(ev, 'unknown');
    const scores = Object.values(assessment.derivedScores) as number[];
    scores.forEach(s => {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    });
  });
});
