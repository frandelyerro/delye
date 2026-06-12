import type { Prospect } from './prospect';
import type { SealLithology, TrapType } from './evidence';

// Seal lithologies treated as evaporite-class (excellent caprocks) by
// geoscienceEngine.assessSeal — salt, evaporite, and anhydrite.
const EVAPORITE_CLASS_LITHOLOGIES: SealLithology[] = ['salt', 'evaporite', 'anhydrite'];

export type SealTrapCrossTabRow = {
  lithology: SealLithology | 'unrecorded';
  trapType: TrapType | 'unrecorded';
  count: number;
};

export type SubsaltSealRisk = {
  prospectId: string;
  prospectName: string;
  sealLithology: SealLithology | 'unrecorded';
};

export type SealTrapRiskAnalysis = {
  crossTab: SealTrapCrossTabRow[];
  subsaltNonEvaporiteRisks: SubsaltSealRisk[];
};

/**
 * Cross-tabs prospects by seal lithology x trap type and flags subsalt traps
 * whose seal lithology is not in the evaporite class (salt/evaporite/anhydrite).
 * Per AAPG Memoir 74 and Knipe et al. (1997), subsalt traps depend on the
 * overlying salt itself for top-seal integrity; a non-evaporite seal recorded
 * for a subsalt trap suggests either a secondary/internal seal of unproven
 * quality or a data-entry inconsistency that warrants review.
 */
export const analyzeSealTrapRisk = (prospects: Prospect[]): SealTrapRiskAnalysis => {
  const counts = new Map<string, SealTrapCrossTabRow>();

  for (const p of prospects) {
    const lithology = p.evidence?.seal?.lithology ?? 'unrecorded';
    const trapType = p.evidence?.trap?.trapType ?? 'unrecorded';
    const key = `${lithology}|${trapType}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { lithology, trapType, count: 1 });
    }
  }

  const crossTab = [...counts.values()].sort((a, b) => b.count - a.count);

  return {
    crossTab,
    subsaltNonEvaporiteRisks: getSubsaltNonEvaporiteRisks(prospects),
  };
};

/**
 * Returns prospects with a subsalt trap whose seal lithology is missing or
 * outside the evaporite class (salt/evaporite/anhydrite).
 */
export const getSubsaltNonEvaporiteRisks = (prospects: Prospect[]): SubsaltSealRisk[] =>
  prospects
    .filter((p) => p.evidence?.trap?.trapType === 'subsalt')
    .map((p) => ({
      prospectId: p.id,
      prospectName: p.name,
      sealLithology: (p.evidence?.seal?.lithology ?? 'unrecorded') as SealLithology | 'unrecorded',
    }))
    .filter((r) => !EVAPORITE_CLASS_LITHOLOGIES.includes(r.sealLithology as SealLithology));
