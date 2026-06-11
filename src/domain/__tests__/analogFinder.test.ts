import { describe, expect, it } from 'vitest';
import { Prospect } from '../prospect';
import { findAnalogs } from '../analogFinder';

const makeProspect = (overrides: Partial<Prospect> & { id: string }): Prospect => ({
  name: overrides.name ?? overrides.id,
  basin: overrides.basin ?? 'Basin A',
  block: overrides.block ?? 'B1',
  playType: overrides.playType ?? 'Conventional Clastic',
  latitude: overrides.latitude ?? 10,
  longitude: overrides.longitude ?? 10,
  sourceScore: overrides.sourceScore ?? 0.7,
  migrationScore: overrides.migrationScore ?? 0.7,
  reservoirScore: overrides.reservoirScore ?? 0.7,
  sealScore: overrides.sealScore ?? 0.7,
  trapScore: overrides.trapScore ?? 0.7,
  timingScore: overrides.timingScore ?? 0.7,
  commercialScore: overrides.commercialScore ?? 70,
  resourceEstimate: overrides.resourceEstimate ?? 100,
  ...overrides,
});

describe('findAnalogs', () => {
  it('returns the closest prospects by scoring profile, excluding the target', () => {
    const target = makeProspect({ id: 'target', sourceScore: 0.7, sealScore: 0.7 });
    const close = makeProspect({ id: 'close', sourceScore: 0.7, sealScore: 0.7 });
    const far = makeProspect({ id: 'far', sourceScore: 0.1, sealScore: 0.1, commercialScore: 5 });

    const result = findAnalogs(target, [target, close, far], 2);

    expect(result.map((p) => p.id)).toEqual(['close', 'far']);
    expect(result.find((p) => p.id === 'target')).toBeUndefined();
  });

  it('returns an empty array when there are no candidates', () => {
    const target = makeProspect({ id: 'target' });
    expect(findAnalogs(target, [target], 5)).toEqual([]);
  });

  it('respects the k limit', () => {
    const target = makeProspect({ id: 'target' });
    const candidates = [target, makeProspect({ id: 'a' }), makeProspect({ id: 'b' }), makeProspect({ id: 'c' })];
    expect(findAnalogs(target, candidates, 2)).toHaveLength(2);
  });

  it('breaks ties deterministically by candidate order', () => {
    const target = makeProspect({ id: 'target' });
    const a = makeProspect({ id: 'a' });
    const b = makeProspect({ id: 'b' });
    const result = findAnalogs(target, [target, a, b], 2);
    expect(result.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('de-duplicates candidates that share the same id', () => {
    const target = makeProspect({ id: 'target' });
    const dupe = makeProspect({ id: 'dupe', sourceScore: 0.5 });
    const dupeAgain = makeProspect({ id: 'dupe', sourceScore: 0.5 });
    const result = findAnalogs(target, [target, dupe, dupeAgain], 5);
    expect(result.map((p) => p.id)).toEqual(['dupe']);
  });

  it('samePlayType filter restricts candidates to the target play type', () => {
    const target = makeProspect({ id: 'target', playType: 'Conventional Clastic' });
    const samePlay = makeProspect({ id: 'same-play', playType: 'Conventional Clastic', sourceScore: 0.1 });
    const otherPlay = makeProspect({ id: 'other-play', playType: 'Carbonate', sourceScore: 0.7 });
    const result = findAnalogs(target, [target, samePlay, otherPlay], 5, { samePlayType: true });
    expect(result.map((p) => p.id)).toEqual(['same-play']);
  });

  it('sameBasin filter restricts candidates to the target basin', () => {
    const target = makeProspect({ id: 'target', basin: 'Basin A' });
    const sameBasin = makeProspect({ id: 'same-basin', basin: 'Basin A', sourceScore: 0.1 });
    const otherBasin = makeProspect({ id: 'other-basin', basin: 'Basin B', sourceScore: 0.7 });
    const result = findAnalogs(target, [target, sameBasin, otherBasin], 5, { sameBasin: true });
    expect(result.map((p) => p.id)).toEqual(['same-basin']);
  });

  it('byMainRisk filter restricts candidates to the target mainRisk', () => {
    const target = makeProspect({ id: 'target', mainRisk: 'seal' });
    const sameRisk = makeProspect({ id: 'same-risk', mainRisk: 'seal', sourceScore: 0.1 });
    const otherRisk = makeProspect({ id: 'other-risk', mainRisk: 'trap', sourceScore: 0.7 });
    const result = findAnalogs(target, [target, sameRisk, otherRisk], 5, { byMainRisk: true });
    expect(result.map((p) => p.id)).toEqual(['same-risk']);
  });

  it('byMainRisk filter never matches when the target has no mainRisk', () => {
    const target = makeProspect({ id: 'target', mainRisk: undefined });
    const candidate = makeProspect({ id: 'candidate', mainRisk: 'seal' });
    const result = findAnalogs(target, [target, candidate], 5, { byMainRisk: true });
    expect(result).toEqual([]);
  });

  it('combines multiple filters', () => {
    const target = makeProspect({ id: 'target', basin: 'Basin A', playType: 'Conventional Clastic' });
    const matches = makeProspect({ id: 'matches', basin: 'Basin A', playType: 'Conventional Clastic', sourceScore: 0.1 });
    const wrongBasin = makeProspect({ id: 'wrong-basin', basin: 'Basin B', playType: 'Conventional Clastic', sourceScore: 0.1 });
    const wrongPlay = makeProspect({ id: 'wrong-play', basin: 'Basin A', playType: 'Carbonate', sourceScore: 0.1 });
    const result = findAnalogs(target, [target, matches, wrongBasin, wrongPlay], 5, { sameBasin: true, samePlayType: true });
    expect(result.map((p) => p.id)).toEqual(['matches']);
  });

  it('outcomeOnly filter restricts candidates to prospects with a known outcome', () => {
    const outcome = { label: 'commercial_discovery', targetVariable: 'geological_success', resultConfidence: 'high', source: 'historical' } as const;
    const target = makeProspect({ id: 'target' });
    const drilled = makeProspect({ id: 'drilled', outcome });
    const unknownOutcome = makeProspect({ id: 'unknown-outcome', outcome: { ...outcome, label: 'unknown' } });
    const undrilled = makeProspect({ id: 'undrilled' });
    const result = findAnalogs(target, [target, drilled, unknownOutcome, undrilled], 5, { outcomeOnly: true });
    expect(result.map((p) => p.id)).toEqual(['drilled']);
  });

  it('outcomeOnly accepts dry holes and non-commercial outcomes (any known label)', () => {
    const base = { targetVariable: 'geological_success', resultConfidence: 'high', source: 'historical' } as const;
    const target = makeProspect({ id: 'target' });
    const dryHole = makeProspect({ id: 'dry-hole', outcome: { ...base, label: 'dry_hole' } });
    const nonCommercial = makeProspect({ id: 'non-commercial', outcome: { ...base, label: 'non_commercial' } });
    const result = findAnalogs(target, [target, dryHole, nonCommercial], 5, { outcomeOnly: true });
    expect(result.map((p) => p.id).sort()).toEqual(['dry-hole', 'non-commercial']);
  });

  it('outcomeOnly combines with other filters', () => {
    const outcome = { label: 'technical_discovery', targetVariable: 'geological_success', resultConfidence: 'medium', source: 'historical' } as const;
    const target = makeProspect({ id: 'target', basin: 'Basin A' });
    const drilledSameBasin = makeProspect({ id: 'drilled-same-basin', basin: 'Basin A', outcome });
    const drilledOtherBasin = makeProspect({ id: 'drilled-other-basin', basin: 'Basin B', outcome });
    const undrilledSameBasin = makeProspect({ id: 'undrilled-same-basin', basin: 'Basin A' });
    const result = findAnalogs(target, [target, drilledSameBasin, drilledOtherBasin, undrilledSameBasin], 5, { outcomeOnly: true, sameBasin: true });
    expect(result.map((p) => p.id)).toEqual(['drilled-same-basin']);
  });
});
