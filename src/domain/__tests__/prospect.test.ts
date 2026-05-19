import { describe, expect, it } from 'vitest';
import { validateProspect } from '../prospect';

const validProspect = {
  id: '1', name: 'A', basin: 'B', block: 'C', playType: 'D',
  latitude: 10, longitude: 10,
  sourceScore: 0.8, migrationScore: 0.7, reservoirScore: 0.6, sealScore: 0.5, trapScore: 0.9, timingScore: 0.8,
  commercialScore: 70, resourceEstimate: 10
};

describe('validateProspect', () => {
  it('rejects scores out of range', () => {
    const errors = validateProspect({ ...validProspect, sourceScore: 1.2 });
    expect(errors).toContain('sourceScore must be between 0 and 1');
  });

  it('rejects required empty strings', () => {
    const errors = validateProspect({ ...validProspect, name: '   ', basin: '' });
    expect(errors).toContain('name is required');
    expect(errors).toContain('basin is required');
  });
});
