const TO_RAD = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;

/** Haversine great-circle distance between two WGS-84 coordinates, in km. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * TO_RAD;
  const dLon = (lon2 - lon1) * TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * TO_RAD) * Math.cos(lat2 * TO_RAD) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Returns true if lat/lon are valid WGS-84 coordinates and not the null-island (0, 0). */
export function isValidCoordinate(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    !(lat === 0 && lon === 0)
  );
}

/** Returns the number of digits after the decimal point in a number's string form. */
function decimalDigits(n: number): number {
  if (!Number.isFinite(n)) return 0;
  // Avoid scientific notation (e.g. "1e-7") for very small numbers, which would
  // otherwise be miscounted as having no decimal places.
  const s = Math.abs(n) < 1 && n !== 0 ? n.toFixed(10).replace(/0+$/, '') : String(n);
  const i = s.indexOf('.');
  return i === -1 ? 0 : s.length - i - 1;
}

/** Returns true if either coordinate has fewer than 4 decimal digits (~11m precision). */
export function hasLowPrecisionCoordinates(lat: number, lon: number): boolean {
  return decimalDigits(lat) < 4 || decimalDigits(lon) < 4;
}

/** Returns the nearest prospect (by haversine distance) to the given coordinates. */
export function findNearest<T extends { latitude: number; longitude: number }>(
  candidates: T[],
  lat: number,
  lon: number,
): { item: T; distanceKm: number } | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    if (!isValidCoordinate(c.latitude, c.longitude)) continue;
    const d = haversineKm(lat, lon, c.latitude, c.longitude);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best ? { item: best, distanceKm: bestDist } : null;
}

/**
 * Returns items whose nearest neighbor is farther than `thresholdKm` away (or that have
 * no neighbor at all). Isolated prospects typically carry higher standalone
 * infrastructure/tie-back costs.
 */
export function findIsolated<T extends { latitude: number; longitude: number }>(
  items: T[],
  thresholdKm = 50,
): T[] {
  const valid = items.filter((c) => isValidCoordinate(c.latitude, c.longitude));
  return valid.filter((item) => {
    const others = valid.filter((c) => c !== item);
    const nearest = findNearest(others, item.latitude, item.longitude);
    return !nearest || nearest.distanceKm > thresholdKm;
  });
}

/** Computes the centroid and the radius of the smallest circle (centered on the
 * centroid) enclosing all valid items. Returns null if there are no valid items. */
export function basinBoundingCircle<T extends { latitude: number; longitude: number }>(
  items: T[],
): { center: [number, number]; radiusKm: number } | null {
  const valid = items.filter((c) => isValidCoordinate(c.latitude, c.longitude));
  if (valid.length === 0) return null;
  const centerLat = valid.reduce((s, c) => s + c.latitude, 0) / valid.length;
  const centerLon = valid.reduce((s, c) => s + c.longitude, 0) / valid.length;
  const radiusKm = Math.max(...valid.map((c) => haversineKm(centerLat, centerLon, c.latitude, c.longitude)));
  return { center: [centerLon, centerLat], radiusKm };
}

/**
 * Returns the [lon, lat] ring coordinates of a circle of the given radius (km)
 * centered on `center` ([lon, lat]), suitable for a GeoJSON Polygon's outer ring.
 */
export function circlePolygonCoordinates(
  center: [number, number],
  radiusKm: number,
  steps = 64,
): [number, number][] {
  const distRatio = radiusKm / EARTH_RADIUS_KM;
  const centerLatRad = center[1] * TO_RAD;
  const centerLonRad = center[0] * TO_RAD;
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * 2 * Math.PI;
    const lat = Math.asin(
      Math.sin(centerLatRad) * Math.cos(distRatio) +
        Math.cos(centerLatRad) * Math.sin(distRatio) * Math.cos(bearing),
    );
    const lon =
      centerLonRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(distRatio) * Math.cos(centerLatRad),
        Math.cos(distRatio) - Math.sin(centerLatRad) * Math.sin(lat),
      );
    coords.push([lon / TO_RAD, lat / TO_RAD]);
  }
  return coords;
}
