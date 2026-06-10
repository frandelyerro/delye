import { describe, expect, it } from 'vitest';
import { haversineKm, isValidCoordinate, findNearest, hasLowPrecisionCoordinates, findIsolated } from '../geoUtils';

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
