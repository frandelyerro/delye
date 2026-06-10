import type { Prospect } from '../domain/prospect';

// `?? 0` does not catch an explicit NaN value, since NaN is a `number`. Use this
// before any arithmetic that feeds charts, map layers, or aggregate statistics.
export function safeNumber(value: number | undefined | null, fallback = 0): number {
  return Number.isFinite(value) ? (value as number) : fallback;
}

export function safeGcos(p: Prospect): number {
  return Math.max(0, safeNumber(p.geologicalChanceOfSuccess));
}
