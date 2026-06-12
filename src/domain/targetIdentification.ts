import type { Prospect } from './prospect';
import { haversineKm, isValidCoordinate, basinBoundingCircle, circlePolygonCoordinates } from './geoUtils';
import { isGeologicalSuccess, isKnownOutcome } from './outcomes';
import { finiteGcos } from './portfolioIntelligence';

// Prospects within this distance of an existing cluster member join that
// cluster (single-linkage greedy clustering). 150 km approximates a shared
// petroleum-system fairway / infrastructure radius.
const CLUSTER_LINK_KM = 150;

// Grid cell edge in degrees for the target heat grid (~5.5 km at the equator).
const GRID_CELL_DEG = 0.05;

export type IdentifiedTarget = {
  id: string;
  name: string;
  prospects: Prospect[];
  center: [number, number]; // [lon, lat]
  radiusKm: number;
  outlineRing: [number, number][];
  prospectCount: number;
  areaKm2: number;
  avgGcos: number;
  drilledCount: number;
  successCount: number;
  /** Geological success rate over drilled (known-outcome) prospects; null when none drilled. */
  successRate: number | null;
  /** Ranking score: avgGcos weighted by sqrt(count) so bigger clusters of equal quality rank higher. */
  rankScore: number;
  /** Most common basin among the target's prospects (mini-summary). */
  topBasin: string;
  /** Most common play type among the target's prospects (mini-summary). */
  topPlayType: string;
};

export type TargetGridCell = {
  /** Outer ring of the cell polygon, [lon, lat]. */
  ring: [number, number][];
  centerLon: number;
  centerLat: number;
  avgGcos: number;
  prospectCount: number;
  prospectNames: string[];
};

/**
 * Greedy single-linkage spatial clustering: each prospect joins the first
 * cluster containing a member within CLUSTER_LINK_KM, else starts a new one.
 * Deterministic for a given prospect order (callers get prospects in store
 * order, which is stable).
 */
const clusterByProximity = (prospects: Prospect[]): Prospect[][] => {
  const clusters: Prospect[][] = [];
  for (const p of prospects) {
    const home = clusters.find((cluster) =>
      cluster.some((m) => haversineKm(m.latitude, m.longitude, p.latitude, p.longitude) <= CLUSTER_LINK_KM),
    );
    if (home) {
      home.push(p);
    } else {
      clusters.push([p]);
    }
  }
  return clusters;
};

/** Returns the most frequent value in a list (first-seen wins on ties). */
const mostCommon = (values: string[]): string => {
  const counts = new Map<string, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best = values[0] ?? '';
  let bestCount = 0;
  for (const [v, count] of counts) {
    if (count > bestCount) {
      best = v;
      bestCount = count;
    }
  }
  return best;
};

/**
 * Identifies the top exploration targets in the portfolio by spatially
 * clustering valid-coordinate prospects and ranking clusters by average GCoS
 * weighted by cluster size. Advisory visualization only — does not feed
 * scoring, targeting gates, or economics.
 */
export const identifyTargets = (prospects: Prospect[], maxTargets = 3): IdentifiedTarget[] => {
  const valid = prospects.filter((p) => isValidCoordinate(p.latitude, p.longitude));
  if (valid.length === 0) return [];

  const ranked = clusterByProximity(valid)
    .map((cluster) => {
      const circle = basinBoundingCircle(cluster)!;
      const avgGcos = cluster.reduce((s, p) => s + finiteGcos(p), 0) / cluster.length;
      const drilled = cluster.filter((p) => p.outcome && isKnownOutcome(p.outcome));
      const successes = drilled.filter((p) => isGeologicalSuccess(p.outcome!));
      // Minimum 10 km display radius so single-prospect targets remain visible.
      const radiusKm = Math.max(circle.radiusKm, 10);
      return {
        prospects: cluster,
        center: circle.center,
        radiusKm,
        outlineRing: circlePolygonCoordinates(circle.center, radiusKm),
        prospectCount: cluster.length,
        areaKm2: Math.PI * radiusKm * radiusKm,
        avgGcos,
        drilledCount: drilled.length,
        successCount: successes.length,
        successRate: drilled.length > 0 ? successes.length / drilled.length : null,
        rankScore: avgGcos * Math.sqrt(cluster.length),
        topBasin: mostCommon(cluster.map((p) => p.basin)),
        topPlayType: mostCommon(cluster.map((p) => p.playType)),
      };
    })
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, maxTargets);

  return ranked.map((t, i) => ({ ...t, id: `target-${i + 1}`, name: `Target ${i + 1}` }));
};

/**
 * Builds the heat-grid cells for a target: prospects are bucketed into
 * GRID_CELL_DEG x GRID_CELL_DEG cells and each occupied cell carries the
 * average GCoS of its prospects (the "prediction grade" of that cell).
 */
export const buildTargetGridCells = (target: IdentifiedTarget): TargetGridCell[] => {
  const buckets = new Map<string, Prospect[]>();
  for (const p of target.prospects) {
    const col = Math.floor(p.longitude / GRID_CELL_DEG);
    const row = Math.floor(p.latitude / GRID_CELL_DEG);
    const key = `${col}|${row}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(p);
    } else {
      buckets.set(key, [p]);
    }
  }

  const cells: TargetGridCell[] = [];
  for (const [key, members] of buckets) {
    const [col, row] = key.split('|').map(Number);
    const west = col * GRID_CELL_DEG;
    const south = row * GRID_CELL_DEG;
    const east = west + GRID_CELL_DEG;
    const north = south + GRID_CELL_DEG;
    cells.push({
      ring: [[west, south], [east, south], [east, north], [west, north], [west, south]],
      centerLon: west + GRID_CELL_DEG / 2,
      centerLat: south + GRID_CELL_DEG / 2,
      avgGcos: members.reduce((s, p) => s + finiteGcos(p), 0) / members.length,
      prospectCount: members.length,
      prospectNames: members.map((p) => p.name),
    });
  }
  return cells.sort((a, b) => b.avgGcos - a.avgGcos);
};
