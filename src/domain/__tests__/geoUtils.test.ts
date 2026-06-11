import { describe, expect, it } from 'vitest';
import { haversineKm, isValidCoordinate, findNearest, hasLowPrecisionCoordinates, findIsolated, basinBoundingCircle, circlePolygonCoordinates, findNearestOutcome, rankByAnalogProximity, basinClusteringStats } from '../geoUtils';

describe('haversineKm', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineKm(40, -74, 40, -74)).toBeCloseTo(0, 5);
  });

  it('returns ~111 km for 1 degree latitude difference at equator', () => {
    expect(haversineKm(0, 0, 1, 0)).toBeCloseTo(111.19, 0);
  });

  it('returns known distance between NYC and London (~5570 km)', () => {
    const dist = haversineKm(40.71, -74.01, 51.51, -0.13);
    expect(dist).toBeGreaterThan(5500);
    expect(dist).toBeLessThan(5650);
  });
});

describe('isValidCoordinate', () => {
  it('accepts normal valid coordinates', () => {
    expect(isValidCoordinate(25.5, -90.2)).toBe(true);
  });

  it('rejects (0, 0) null-island', () => {
    expect(isValidCoordinate(0, 0)).toBe(false);
  });

  it('rejects NaN', () => {
    expect(isValidCoordinate(NaN, 0)).toBe(false);
  });

  it('rejects out-of-range latitude', () => {
    expect(isValidCoordinate(95, 0)).toBe(false);
  });
});

describe('hasLowPrecisionCoordinates', () => {
  it('returns true when latitude has fewer than 4 decimal digits', () => {
    expect(hasLowPrecisionCoordinates(25.5, -90.1234)).toBe(true);
  });

  it('returns true when longitude has fewer than 4 decimal digits', () => {
    expect(hasLowPrecisionCoordinates(25.1234, -90.12)).toBe(true);
  });

  it('returns false when both have 4+ decimal digits', () => {
    expect(hasLowPrecisionCoordinates(25.12345, -90.1234)).toBe(false);
  });

  it('returns true for whole-number coordinates', () => {
    expect(hasLowPrecisionCoordinates(25, -90)).toBe(true);
  });

  it('handles very small magnitude coordinates without misreading scientific notation', () => {
    // 1e-7 would stringify as "1e-7" (no '.') if not handled, miscounting decimal digits
    expect(hasLowPrecisionCoordinates(1e-7, -90.12345)).toBe(false);
  });
});

describe('findNearest', () => {
  const items = [
    { id: 'a', latitude: 0.1, longitude: 0.1 },
    { id: 'b', latitude: 10, longitude: 10 },
    { id: 'c', latitude: 50, longitude: 50 },
  ];

  it('returns the closest item', () => {
    const result = findNearest(items, 0.2, 0.2);
    expect(result?.item.id).toBe('a');
  });

  it('returns null for empty array', () => {
    expect(findNearest([], 0, 0)).toBeNull();
  });

  it('skips null-island coordinates', () => {
    const withNullIsland = [{ id: 'null', latitude: 0, longitude: 0 }, ...items];
    const result = findNearest(withNullIsland, 0.2, 0.2);
    expect(result?.item.id).toBe('a');
  });
});

type LabeledTestItem = { id: string; latitude: number; longitude: number; outcome?: { label: string } };

describe('findNearestOutcome', () => {
  const discovery: LabeledTestItem = { id: 'disc', latitude: 1, longitude: 1, outcome: { label: 'commercial_discovery' } };
  const dryHole: LabeledTestItem = { id: 'dry', latitude: 20, longitude: 20, outcome: { label: 'dry_hole' } };
  const unknownLabel: LabeledTestItem = { id: 'unk', latitude: 1.1, longitude: 1.1, outcome: { label: 'unknown' } };
  const undrilled: LabeledTestItem = { id: 'und', latitude: 2, longitude: 2 };

  it('finds the closest outcome-labeled candidate', () => {
    const result = findNearestOutcome(undrilled, [discovery, dryHole, undrilled]);
    expect(result?.item.id).toBe('disc');
    expect(result!.distanceKm).toBeGreaterThan(0);
  });

  it('ignores unknown-label outcomes and other undrilled prospects', () => {
    const result = findNearestOutcome(undrilled, [unknownLabel, dryHole, undrilled]);
    expect(result?.item.id).toBe('dry');
  });

  it('returns null when the target has invalid coordinates', () => {
    const badTarget: LabeledTestItem = { id: 'bad', latitude: 0, longitude: 0 };
    expect(findNearestOutcome(badTarget, [discovery])).toBeNull();
  });

  it('returns null when no labeled analogs exist', () => {
    expect(findNearestOutcome(undrilled, [unknownLabel, undrilled])).toBeNull();
  });

  it('never returns the target itself even if it is labeled', () => {
    const result = findNearestOutcome(discovery, [discovery, dryHole]);
    expect(result?.item.id).toBe('dry');
  });
});

describe('rankByAnalogProximity', () => {
  it('ranks undrilled prospects by distance to nearest labeled analog, closest first', () => {
    const prospects: LabeledTestItem[] = [
      { id: 'disc', latitude: 0.5, longitude: 0.5, outcome: { label: 'commercial_discovery' } },
      { id: 'near', latitude: 1, longitude: 0.5 },
      { id: 'far', latitude: 10, longitude: 10 },
    ];
    const ranked = rankByAnalogProximity(prospects);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].item.id).toBe('near');
    expect(ranked[1].item.id).toBe('far');
    expect(ranked[0].nearest.id).toBe('disc');
    expect(ranked[0].distanceKm).toBeLessThan(ranked[1].distanceKm);
  });

  it('returns empty array when no labeled outcomes exist', () => {
    const prospects: LabeledTestItem[] = [
      { id: 'a', latitude: 1, longitude: 1 },
      { id: 'b', latitude: 2, longitude: 2 },
    ];
    expect(rankByAnalogProximity(prospects)).toEqual([]);
  });

  it('treats unknown-label prospects as undrilled and excludes labeled ones from the ranking', () => {
    const prospects: LabeledTestItem[] = [
      { id: 'disc', latitude: 1, longitude: 1, outcome: { label: 'dry_hole' } },
      { id: 'unk', latitude: 1.5, longitude: 1.5, outcome: { label: 'unknown' } },
    ];
    const ranked = rankByAnalogProximity(prospects);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].item.id).toBe('unk');
  });
});

describe('findIsolated', () => {
  it('returns items farther than the threshold from their nearest neighbor', () => {
    const items = [
      { id: 'a', latitude: 0, longitude: 0.01 },
      { id: 'b', latitude: 0, longitude: 0.02 },
      { id: 'c', latitude: 30, longitude: 30 },
    ];
    const result = findIsolated(items, 50);
    expect(result.map((i) => i.id)).toEqual(['c']);
  });

  it('returns empty array when all items are within threshold', () => {
    const items = [
      { id: 'a', latitude: 0, longitude: 0.01 },
      { id: 'b', latitude: 0, longitude: 0.02 },
    ];
    expect(findIsolated(items, 50)).toEqual([]);
  });

  it('returns the single item when there is only one', () => {
    const items = [{ id: 'a', latitude: 10, longitude: 10 }];
    expect(findIsolated(items, 50).map((i) => i.id)).toEqual(['a']);
  });

  it('ignores invalid/null-island coordinates', () => {
    const items = [
      { id: 'a', latitude: 0, longitude: 0 },
      { id: 'b', latitude: 10, longitude: 10 },
    ];
    // 'a' (0,0) is filtered out as null-island; 'b' has no remaining valid neighbor, so it's isolated
    expect(findIsolated(items, 50).map((i) => i.id)).toEqual(['b']);
  });
});

describe('basinBoundingCircle', () => {
  it('returns null for an empty array', () => {
    expect(basinBoundingCircle([])).toBeNull();
  });

  it('returns a zero-radius circle centered on the single item', () => {
    const result = basinBoundingCircle([{ latitude: 10, longitude: 20 }]);
    expect(result?.center).toEqual([20, 10]);
    expect(result?.radiusKm).toBeCloseTo(0, 5);
  });

  it('returns a centroid and radius enclosing all valid items', () => {
    const items = [
      { latitude: 0, longitude: 0.01 },
      { latitude: 0, longitude: -0.01 },
    ];
    const result = basinBoundingCircle(items);
    expect(result?.center[0]).toBeCloseTo(0, 5);
    expect(result?.center[1]).toBeCloseTo(0, 5);
    expect(result?.radiusKm).toBeGreaterThan(0);
  });

  it('ignores invalid/null-island coordinates', () => {
    const items = [
      { latitude: 0, longitude: 0 },
      { latitude: 10, longitude: 10 },
    ];
    const result = basinBoundingCircle(items);
    expect(result?.center).toEqual([10, 10]);
    expect(result?.radiusKm).toBeCloseTo(0, 5);
  });
});

describe('circlePolygonCoordinates', () => {
  it('returns a closed ring (first and last points equal)', () => {
    const ring = circlePolygonCoordinates([0, 0], 50);
    expect(ring[0][0]).toBeCloseTo(ring[ring.length - 1][0], 6);
    expect(ring[0][1]).toBeCloseTo(ring[ring.length - 1][1], 6);
  });

  it('returns steps + 1 points', () => {
    expect(circlePolygonCoordinates([0, 0], 50, 16)).toHaveLength(17);
  });

  it('every point is approximately radiusKm from the center', () => {
    const center: [number, number] = [10, 20];
    const radiusKm = 100;
    const ring = circlePolygonCoordinates(center, radiusKm, 32);
    for (const [lon, lat] of ring) {
      expect(haversineKm(center[1], center[0], lat, lon)).toBeCloseTo(radiusKm, 0);
    }
  });

  it('collapses to the center point for zero radius', () => {
    const ring = circlePolygonCoordinates([5, 5], 0, 8);
    for (const [lon, lat] of ring) {
      expect(lon).toBeCloseTo(5, 5);
      expect(lat).toBeCloseTo(5, 5);
    }
  });
});

type BasinTestItem = { id: string; basin: string; latitude: number; longitude: number };

describe('basinClusteringStats', () => {
  it('returns empty array when no basin has >=2 valid-coordinate items', () => {
    const items: BasinTestItem[] = [
      { id: 'a', basin: 'Basin A', latitude: 10, longitude: 10 },
      { id: 'b', basin: 'Basin B', latitude: 20, longitude: 20 },
    ];
    expect(basinClusteringStats(items)).toEqual([]);
  });

  it('computes avg/min/max nearest-neighbor distance for a basin with multiple items', () => {
    const items: BasinTestItem[] = [
      { id: 'a', basin: 'Basin A', latitude: 0, longitude: 1 },
      { id: 'b', basin: 'Basin A', latitude: 0, longitude: 2 },
      { id: 'c', basin: 'Basin A', latitude: 0, longitude: 3 },
    ];
    const stats = basinClusteringStats(items);
    expect(stats).toHaveLength(1);
    expect(stats[0].basin).toBe('Basin A');
    expect(stats[0].count).toBe(3);
    expect(stats[0].minNearestNeighborKm).toBeGreaterThan(0);
    expect(stats[0].maxNearestNeighborKm).toBeGreaterThanOrEqual(stats[0].minNearestNeighborKm);
    expect(stats[0].avgNearestNeighborKm).toBeGreaterThan(0);
  });

  it('flags a basin as dense when avg nearest-neighbor distance is below 100 km', () => {
    const items: BasinTestItem[] = [
      { id: 'a', basin: 'Basin Dense', latitude: 1, longitude: 1 },
      { id: 'b', basin: 'Basin Dense', latitude: 1.05, longitude: 1.05 },
    ];
    const stats = basinClusteringStats(items);
    expect(stats[0].isDense).toBe(true);
  });

  it('flags a basin as scattered when avg nearest-neighbor distance is >= 100 km', () => {
    const items: BasinTestItem[] = [
      { id: 'a', basin: 'Basin Scattered', latitude: 1, longitude: 1 },
      { id: 'b', basin: 'Basin Scattered', latitude: 6, longitude: 6 },
    ];
    const stats = basinClusteringStats(items);
    expect(stats[0].isDense).toBe(false);
  });

  it('ignores items with invalid coordinates', () => {
    const items: BasinTestItem[] = [
      { id: 'a', basin: 'Basin A', latitude: 2, longitude: 2 },
      { id: 'b', basin: 'Basin A', latitude: 1, longitude: 1 },
      { id: 'c', basin: 'Basin A', latitude: NaN, longitude: NaN },
    ];
    const stats = basinClusteringStats(items);
    expect(stats[0].count).toBe(2);
  });

  it('sorts basins by avg nearest-neighbor distance ascending (densest first)', () => {
    const items: BasinTestItem[] = [
      { id: 'a1', basin: 'Scattered', latitude: 1, longitude: 1 },
      { id: 'a2', basin: 'Scattered', latitude: 6, longitude: 6 },
      { id: 'b1', basin: 'Dense', latitude: 10, longitude: 10 },
      { id: 'b2', basin: 'Dense', latitude: 10.01, longitude: 10.01 },
    ];
    const stats = basinClusteringStats(items);
    expect(stats.map((s) => s.basin)).toEqual(['Dense', 'Scattered']);
  });
});
