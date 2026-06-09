import type { Prospect } from './prospect';

const SCORE_FIELDS: Array<keyof Pick<Prospect,
  'sourceScore' | 'migrationScore' | 'reservoirScore' | 'sealScore' | 'trapScore' | 'timingScore'
>> = ['sourceScore', 'migrationScore', 'reservoirScore', 'sealScore', 'trapScore', 'timingScore'];

const featureVector = (p: Prospect): number[] => [
  ...SCORE_FIELDS.map((field) => p[field]),
  p.commercialScore / 100,
];

const euclideanDistance = (a: number[], b: number[]): number =>
  Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));

/**
 * Finds the k prospects most similar to the target across the six geological
 * scoring dimensions plus commercial score, used to surface analog prospects
 * for de-risking. Excludes the target itself.
 */
export const findAnalogs = (target: Prospect, candidates: Prospect[], k = 5): Prospect[] => {
  const targetVector = featureVector(target);
  return candidates
    .filter((p) => p.id !== target.id)
    .map((p) => ({ prospect: p, distance: euclideanDistance(targetVector, featureVector(p)) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, k)
    .map((entry) => entry.prospect);
};
