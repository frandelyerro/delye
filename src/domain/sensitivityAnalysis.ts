import type { Prospect } from './prospect';
import { componentMap, componentNames, componentLabels } from './explainability';

const DELTA = 0.1;

export type SensitivityFactor = {
  factor: string;
  label: string;
  currentValue: number;
  upsideDelta: number;
  downsideDelta: number;
  absMaxDelta: number;
};

export type SensitivityResult = {
  baselineGCoS: number;
  factors: SensitivityFactor[];
};

/**
 * For each of the 6 geological components, computes the change in GCoS
 * when that component is shifted ±DELTA (0.1) while all others are held fixed.
 * Sorted descending by absolute maximum impact.
 */
export function computeSensitivityDeltas(prospect: Prospect): SensitivityResult {
  const safeScore = (val: unknown) => {
    const n = Number(val);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5;
  };

  const baseline = componentNames.reduce((acc, key) => acc * safeScore(prospect[componentMap[key]]), 1);

  const factors: SensitivityFactor[] = componentNames.map((key) => {
    const field = componentMap[key];
    const current = safeScore(prospect[field]);
    const others = componentNames
      .filter((k) => k !== key)
      .reduce((acc, k) => acc * safeScore(prospect[componentMap[k]]), 1);

    const upsideGCoS = Math.min(current + DELTA, 1) * others;
    const downsideGCoS = Math.max(current - DELTA, 0) * others;

    const upsideDelta = upsideGCoS - baseline;
    const downsideDelta = downsideGCoS - baseline;

    return {
      factor: key,
      label: componentLabels[key],
      currentValue: current,
      upsideDelta,
      downsideDelta,
      absMaxDelta: Math.max(Math.abs(upsideDelta), Math.abs(downsideDelta)),
    };
  });

  factors.sort((a, b) => b.absMaxDelta - a.absMaxDelta);

  return { baselineGCoS: baseline, factors };
}
