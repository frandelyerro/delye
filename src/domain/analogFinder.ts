import type { Prospect } from './prospect';
import { isKnownOutcome } from './outcomes';

const SCORE_FIELDS: Array<keyof Pick<Prospect,
  'sourceScore' | 'migrationScore' | 'reservoirScore' | 'sealScore' | 'trapScore' | 'timingScore'
>> = ['sourceScore', 'migrationScore', 'reservoirScore', 'sealScore', 'trapScore', 'timingScore'];

const featureVector = (p: Prospect): number[] => [
  ...SCORE_FIELDS.map((field) => p[field]),
  p.commercialScore / 100,
];

const euclideanDistance = (a: number[], b: number[]): number =>
  Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));

export type AnalogFilters = {
  /** Restrict candidates to the same play type as the target. */
  samePlayType?: boolean;
  /** Restrict candidates to the same basin as the target. */
  sameBasin?: boolean;
  /** Restrict candidates to those sharing the target's primary risk component. */
  byMainRisk?: boolean;
  /**
   * Restrict candidates to prospects with a known historical outcome
   * (drilled analogs: discovery / dry hole / non-commercial). These are the
   * highest-confidence analogs for calibrating expectations on undrilled
   * prospects (Rose & Associates lookback methodology).
   */
  outcomeOnly?: boolean;
};

/**
 * Finds the k prospects most similar to the target across the six geological
 * scoring dimensions plus commercial score, used to surface analog prospects
 * for de-risking. Excludes the target itself.
 *
 * Optional `filters` narrow the candidate pool before similarity ranking
 * (e.g. `{ samePlayType: true }` restricts analogs to the same play type).
 * `byMainRisk` only restricts candidates when the target has a `mainRisk` set;
 * a candidate without `mainRisk` never matches under `byMainRisk`.
 */
export const findAnalogs = (
  target: Prospect,
  candidates: Prospect[],
  k = 5,
  filters?: AnalogFilters,
): Prospect[] => {
  const targetVector = featureVector(target);
  const seenIds = new Set<string>();
  return candidates
    .filter((p) => {
      if (p.id === target.id || seenIds.has(p.id)) return false;
      if (filters?.samePlayType && p.playType !== target.playType) return false;
      if (filters?.sameBasin && p.basin !== target.basin) return false;
      if (filters?.byMainRisk && (!target.mainRisk || p.mainRisk !== target.mainRisk)) return false;
      if (filters?.outcomeOnly && (!p.outcome || !isKnownOutcome(p.outcome))) return false;
      seenIds.add(p.id);
      return true;
    })
    .map((p) => ({ prospect: p, distance: euclideanDistance(targetVector, featureVector(p)) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, k)
    .map((entry) => entry.prospect);
};
