import { describe, expect, it } from 'vitest';
import { assessSource, assessSeal } from '../geoscienceEngine';
import type { SourceEvidence, SealEvidence } from '../evidence';

describe('assessSource — sourceRockType TOC branching', () => {
  it('penalizes low TOC for marine/default source rock', () => {
    const evidence: SourceEvidence = { presence: 'probable', tocPercent: 0.3 };
    const result = assessSource(evidence);
    expect(result.negativeEvidence.some((n) => n.includes('Very low TOC'))).toBe(true);
  });

  it('does not penalize low TOC for coaly/terrestrial source rock', () => {
    const evidence: SourceEvidence = { presence: 'probable', tocPercent: 0.3, sourceRockType: 'coaly' };
    const result = assessSource(evidence);
    expect(result.negativeEvidence.some((n) => n.includes('Very low TOC'))).toBe(false);
    expect(result.positiveEvidence.some((p) => p.includes('coaly/terrestrial'))).toBe(true);
  });

  it('rewards moderate TOC for coaly source rock at a lower threshold than marine', () => {
    const coaly: SourceEvidence = { presence: 'probable', tocPercent: 1, sourceRockType: 'coaly' };
    const marine: SourceEvidence = { presence: 'probable', tocPercent: 1 };
    const coalyResult = assessSource(coaly);
    const marineResult = assessSource(marine);
    expect(coalyResult.score).toBeGreaterThan(marineResult.score);
  });
});

describe('assessSeal — thickness vs lithology interaction', () => {
  it('credits a thin evaporite seal as adequate', () => {
    const evidence: SealEvidence = { presence: 'probable', lithology: 'evaporite', thicknessM: 10 };
    const result = assessSeal(evidence);
    expect(result.positiveEvidence.some((p) => p.includes('Adequate seal thickness 10m for evaporite'))).toBe(true);
  });

  it('does not credit a thin shale seal as adequate', () => {
    const evidence: SealEvidence = { presence: 'probable', lithology: 'shale', thicknessM: 10 };
    const result = assessSeal(evidence);
    expect(result.positiveEvidence.some((p) => p.includes('Adequate seal thickness'))).toBe(false);
    expect(result.positiveEvidence.some((p) => p.includes('below 30m benchmark'))).toBe(true);
  });

  it('still credits a thick shale seal as adequate', () => {
    const evidence: SealEvidence = { presence: 'probable', lithology: 'shale', thicknessM: 35 };
    const result = assessSeal(evidence);
    expect(result.positiveEvidence.some((p) => p.includes('Adequate seal thickness 35m'))).toBe(true);
  });
});
