import { describe, expect, it } from 'vitest';
import { Prospect } from '../prospect';
import { analyzeSealTrapRisk, getSubsaltNonEvaporiteRisks } from '../sealAnalysis';

const makeProspect = (overrides: Partial<Prospect> & { id: string }): Prospect => ({
  name: overrides.name ?? overrides.id,
  basin: overrides.basin ?? 'Basin A',
  block: overrides.block ?? 'B1',
  playType: overrides.playType ?? 'Conventional Clastic',
  latitude: overrides.latitude ?? 10,
  longitude: overrides.longitude ?? 10,
  sourceScore: overrides.sourceScore ?? 0.7,
  migrationScore: overrides.migrationScore ?? 0.7,
  reservoirScore: overrides.reservoirScore ?? 0.7,
  sealScore: overrides.sealScore ?? 0.7,
  trapScore: overrides.trapScore ?? 0.7,
  timingScore: overrides.timingScore ?? 0.7,
  commercialScore: overrides.commercialScore ?? 70,
  resourceEstimate: overrides.resourceEstimate ?? 100,
  ...overrides,
});

describe('analyzeSealTrapRisk', () => {
  it('cross-tabs prospects by seal lithology and trap type', () => {
    const a = makeProspect({ id: 'a', evidence: { seal: { presence: 'proven', lithology: 'salt' }, trap: { closureMapped: true, trapType: 'subsalt' } } });
    const b = makeProspect({ id: 'b', evidence: { seal: { presence: 'proven', lithology: 'salt' }, trap: { closureMapped: true, trapType: 'subsalt' } } });
    const c = makeProspect({ id: 'c', evidence: { seal: { presence: 'proven', lithology: 'shale' }, trap: { closureMapped: true, trapType: 'structural' } } });

    const { crossTab } = analyzeSealTrapRisk([a, b, c]);

    const saltSubsalt = crossTab.find((row) => row.lithology === 'salt' && row.trapType === 'subsalt');
    expect(saltSubsalt?.count).toBe(2);
    const shaleStructural = crossTab.find((row) => row.lithology === 'shale' && row.trapType === 'structural');
    expect(shaleStructural?.count).toBe(1);
  });

  it('groups prospects with no evidence as unrecorded', () => {
    const p = makeProspect({ id: 'p' });
    const { crossTab } = analyzeSealTrapRisk([p]);
    expect(crossTab).toEqual([{ lithology: 'unrecorded', trapType: 'unrecorded', count: 1 }]);
  });
});

describe('getSubsaltNonEvaporiteRisks', () => {
  it('flags subsalt traps with a non-evaporite seal lithology', () => {
    const risky = makeProspect({ id: 'risky', name: 'Risky', evidence: { seal: { presence: 'proven', lithology: 'shale' }, trap: { closureMapped: true, trapType: 'subsalt' } } });
    const safe = makeProspect({ id: 'safe', name: 'Safe', evidence: { seal: { presence: 'proven', lithology: 'salt' }, trap: { closureMapped: true, trapType: 'subsalt' } } });
    const notSubsalt = makeProspect({ id: 'other', name: 'Other', evidence: { seal: { presence: 'proven', lithology: 'shale' }, trap: { closureMapped: true, trapType: 'structural' } } });

    const risks = getSubsaltNonEvaporiteRisks([risky, safe, notSubsalt]);

    expect(risks).toEqual([{ prospectId: 'risky', prospectName: 'Risky', sealLithology: 'shale' }]);
  });

  it('flags subsalt traps with an unrecorded seal lithology', () => {
    const p = makeProspect({ id: 'p', name: 'P', evidence: { trap: { closureMapped: true, trapType: 'subsalt' } } });
    const risks = getSubsaltNonEvaporiteRisks([p]);
    expect(risks).toEqual([{ prospectId: 'p', prospectName: 'P', sealLithology: 'unrecorded' }]);
  });

  it('treats anhydrite as a safe evaporite-class seal', () => {
    const p = makeProspect({ id: 'p', name: 'P', evidence: { seal: { presence: 'proven', lithology: 'anhydrite' }, trap: { closureMapped: true, trapType: 'subsalt' } } });
    expect(getSubsaltNonEvaporiteRisks([p])).toEqual([]);
  });
});
