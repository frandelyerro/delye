import type { ProspectEvidence } from './evidence';

export const createDefaultEvidence = (): ProspectEvidence => ({
  source: {
    presence: 'unknown',
    sources: ['assumption'],
  },
  migration: {
    pathway: 'unknown',
    sources: ['assumption'],
  },
  reservoir: {
    presence: 'unknown',
    sources: ['assumption'],
  },
  seal: {
    presence: 'unknown',
    sources: ['assumption'],
  },
  trap: {
    closureMapped: false,
    trapType: 'unknown',
    seismicConfidence: 'unknown',
    sources: ['assumption'],
  },
  timing: {
    trapFormedBeforeMigration: 'uncertain',
    chargeTiming: 'unknown',
    burialHistoryConfidence: 'unknown',
    sources: ['assumption'],
  },
});
