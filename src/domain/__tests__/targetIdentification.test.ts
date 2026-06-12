import { describe, expect, it } from 'vitest';
import { Prospect } from '../prospect';
import type { ProspectOutcome } from '../outcomes';
import { buildTargetGridCells, identifyTargets } from '../targetIdentification';

const makeOutcome = (label: ProspectOutcome['label']): ProspectOutcome => ({
  label,
  targetVariable: 'geological_success',
  resultConfidence: 'high',
  source: 'historical',
});

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
  geologicalChanceOfSuccess: overrides.geologicalChanceOfSuccess ?? 0.3,
  ...overrides,
});

describe('identifyTargets', () => {
  it('returns an empty array for an empty portfolio', () => {
    expect(identifyTargets([])).toEqual([]);
  });

  it('excludes prospects without valid coordinates', () => {
    const invalid = makeProspect({ id: 'a', latitude: 0, longitude: 0 });
    expect(identifyTargets([invalid])).toEqual([]);
  });

  it('clusters nearby prospects into one target and distant ones into another', () => {
    const a1 = makeProspect({ id: 'a1', latitude: 10, longitude: 10 });
    const a2 = makeProspect({ id: 'a2', latitude: 10.2, longitude: 10.2 });
    const far = makeProspect({ id: 'far', latitude: 40, longitude: 40 });

    const targets = identifyTargets([a1, a2, far]);

    expect(targets).toHaveLength(2);
    const counts = targets.map((t) => t.prospectCount).sort();
    expect(counts).toEqual([1, 2]);
  });

  it('ranks higher-GCoS, larger clusters first and names them Target 1..N', () => {
    const strong1 = makeProspect({ id: 's1', latitude: 10, longitude: 10, geologicalChanceOfSuccess: 0.6 });
    const strong2 = makeProspect({ id: 's2', latitude: 10.1, longitude: 10.1, geologicalChanceOfSuccess: 0.6 });
    const weak = makeProspect({ id: 'w', latitude: 40, longitude: 40, geologicalChanceOfSuccess: 0.1 });

    const targets = identifyTargets([weak, strong1, strong2]);

    expect(targets[0].name).toBe('Target 1');
    expect(targets[0].prospectCount).toBe(2);
    expect(targets[0].avgGcos).toBeCloseTo(0.6, 5);
    expect(targets[1].name).toBe('Target 2');
  });

  it('respects maxTargets', () => {
    const ps = [10, 20, 30, 40].map((lat, i) =>
      makeProspect({ id: `p${i}`, latitude: lat, longitude: lat }),
    );
    expect(identifyTargets(ps, 2)).toHaveLength(2);
  });

  it('computes success rate over drilled prospects only', () => {
    const success = makeProspect({ id: 's', latitude: 10, longitude: 10, outcome: makeOutcome('commercial_discovery') });
    const dry = makeProspect({ id: 'd', latitude: 10.1, longitude: 10.1, outcome: makeOutcome('dry_hole') });
    const undrilled = makeProspect({ id: 'u', latitude: 10.2, longitude: 10.2 });

    const [target] = identifyTargets([success, dry, undrilled]);

    expect(target.drilledCount).toBe(2);
    expect(target.successCount).toBe(1);
    expect(target.successRate).toBeCloseTo(0.5, 5);
  });

  it('returns null success rate when no prospect in the target is drilled', () => {
    const [target] = identifyTargets([makeProspect({ id: 'u', latitude: 10, longitude: 10 })]);
    expect(target.successRate).toBeNull();
  });

  it('enforces a minimum 10 km display radius for single-prospect targets', () => {
    const [target] = identifyTargets([makeProspect({ id: 'solo', latitude: 10, longitude: 10 })]);
    expect(target.radiusKm).toBe(10);
    expect(target.outlineRing.length).toBeGreaterThan(10);
    expect(target.areaKm2).toBeCloseTo(Math.PI * 100, 3);
  });

  it('produces the same clusters regardless of input order', () => {
    // Chain: each consecutive pair ~133 km apart (1.2° latitude), ends ~400 km apart.
    const chain = [0, 1.2, 2.4, 3.6].map((lat, i) =>
      makeProspect({ id: `c${i}`, latitude: 10 + lat, longitude: 10 }),
    );
    const shuffled = [chain[2], chain[0], chain[3], chain[1]];

    const forward = identifyTargets(chain);
    const reordered = identifyTargets(shuffled);

    expect(forward).toHaveLength(1);
    expect(reordered).toHaveLength(1);
    expect(forward[0].prospects.map((p) => p.id).sort()).toEqual(
      reordered[0].prospects.map((p) => p.id).sort(),
    );
  });

  it('merges clusters bridged by a later prospect (true single-linkage)', () => {
    // A and C share a latitude ~262 km apart (clustered separately even after
    // the lat/lon presort); B sits north between them within 150 km of both,
    // so processing B must merge the two clusters into one target.
    const a = makeProspect({ id: 'a', latitude: 10, longitude: 10 });
    const c = makeProspect({ id: 'c', latitude: 10, longitude: 12.4 });
    const b = makeProspect({ id: 'b', latitude: 10.5, longitude: 11.2 });

    const targets = identifyTargets([a, c, b]);

    expect(targets).toHaveLength(1);
    expect(targets[0].prospectCount).toBe(3);
  });

  it('reports the most common basin and play type as a mini-summary', () => {
    const a = makeProspect({ id: 'a', latitude: 10, longitude: 10, basin: 'Vaca Muerta', playType: 'Shale' });
    const b = makeProspect({ id: 'b', latitude: 10.1, longitude: 10.1, basin: 'Vaca Muerta', playType: 'Conventional Clastic' });
    const c = makeProspect({ id: 'c', latitude: 10.2, longitude: 10.2, basin: 'Neuquen', playType: 'Conventional Clastic' });

    const [target] = identifyTargets([a, b, c]);

    expect(target.topBasin).toBe('Vaca Muerta');
    expect(target.topPlayType).toBe('Conventional Clastic');
  });
});

describe('buildTargetGridCells', () => {
  it('buckets co-located prospects into one cell with their average GCoS', () => {
    const a = makeProspect({ id: 'a', latitude: 10.01, longitude: 10.01, geologicalChanceOfSuccess: 0.2 });
    const b = makeProspect({ id: 'b', latitude: 10.02, longitude: 10.02, geologicalChanceOfSuccess: 0.4 });
    const [target] = identifyTargets([a, b]);

    const cells = buildTargetGridCells(target);

    expect(cells).toHaveLength(1);
    expect(cells[0].avgGcos).toBeCloseTo(0.3, 5);
    expect(cells[0].prospectCount).toBe(2);
    expect(cells[0].prospectNames.sort()).toEqual(['a', 'b']);
  });

  it('produces separate cells for prospects in different grid cells, sorted by avgGcos desc', () => {
    const low = makeProspect({ id: 'low', latitude: 10.01, longitude: 10.01, geologicalChanceOfSuccess: 0.1 });
    const high = makeProspect({ id: 'high', latitude: 10.2, longitude: 10.2, geologicalChanceOfSuccess: 0.5 });
    const [target] = identifyTargets([low, high]);

    const cells = buildTargetGridCells(target);

    expect(cells).toHaveLength(2);
    expect(cells[0].avgGcos).toBeGreaterThan(cells[1].avgGcos);
  });

  it('emits closed polygon rings (first point equals last)', () => {
    const [target] = identifyTargets([makeProspect({ id: 'p', latitude: 10, longitude: 10 })]);
    const [cell] = buildTargetGridCells(target);
    expect(cell.ring[0]).toEqual(cell.ring[cell.ring.length - 1]);
    expect(cell.ring).toHaveLength(5);
  });
});
