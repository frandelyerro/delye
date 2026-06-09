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
});
