import { describe, expect, it } from 'vitest';
import { parseCsvProspects, parseJsonProspects } from '../csvParser';

describe('csv/json parser validations', () => {
  it('parses valid CSV', () => {
    const csv = `name,basin,block,playType,latitude,longitude,sourceScore,migrationScore,reservoirScore,sealScore,trapScore,timingScore,commercialScore,resourceEstimate\n` +
      `Prospect X,Neuquén Basin,NQ-1,Shale,-38.1,-68.2,0.8,0.7,0.6,0.5,0.9,0.8,72,50`;
    const parsed = parseCsvProspects(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('Prospect X');
  });

  it('rejects CSV with missing columns', () => {
    const csv = `name,basin,block,playType,latitude,longitude\nProspect X,Neuquén Basin,NQ-1,Shale,-38.1,-68.2`;
    expect(() => parseCsvProspects(csv)).toThrow(/Missing required column/i);
  });

  it('accepts JSON numeric strings and normalizes to numbers', () => {
    const json = JSON.stringify([
      {
        id: 'j1', name: 'Prospect J', basin: 'Basin J', block: 'BJ-1', playType: 'Play J', latitude: '-20.5', longitude: '30.2',
        sourceScore: '0.8', migrationScore: '0.7', reservoirScore: '0.6', sealScore: '0.5', trapScore: '0.9', timingScore: '0.8',
        commercialScore: '77', resourceEstimate: '44'
      }
    ]);
    const parsed = parseJsonProspects(json);
    expect(typeof parsed[0].sourceScore).toBe('number');
    expect(parsed[0].sourceScore).toBe(0.8);
    expect(parsed[0].commercialScore).toBe(77);
  });

  it('rejects JSON that is not an array', () => {
    expect(() => parseJsonProspects('{"id":"x"}')).toThrow(/array/i);
  });
});
