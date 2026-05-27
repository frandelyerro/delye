import { describe, expect, it } from 'vitest';
import { scoreProspects } from '../scoring';
import { mockProspects } from '../../data/mockProspects';
import { getAdvisorResponse } from '../advisor';

const prospects = scoreProspects(mockProspects);

describe('advisor explainability responses', () => {
  it('explains why a named prospect has its score', () => {
    const response = getAdvisorResponse('Why is Wolfcamp East ranked high?', prospects);
    expect(response).toContain('Wolfcamp East');
    expect(response).toContain('GCoS calculation');
    expect(response).toContain('Data Confidence');
  });

  it('returns low-confidence prospects when asked — East Siberia Lead flagged after penalty', () => {
    const response = getAdvisorResponse('Which prospects have low data confidence?', prospects);
    expect(response).toContain('East Siberia Lead');
    expect(response).toMatch(/\(\d+\/100\)/);
  });

  it('summarizes weakest component across the portfolio', () => {
    const response = getAdvisorResponse('What is the weakest component in the portfolio?', prospects);
    expect(response).toContain('weakest component');
  });
});

describe('advisor targeting queries', () => {
  it('responds to drill candidates query', () => {
    const response = getAdvisorResponse('Which prospects are drill candidates?', prospects);
    expect(response.length).toBeGreaterThan(0);
    // Should either list candidates or explain none exist
    expect(response).toMatch(/drill candidate|No drill candidate/i);
  });

  it('responds to where should we drill first', () => {
    const response = getAdvisorResponse('Where should we drill first?', prospects);
    expect(response.length).toBeGreaterThan(0);
  });

  it('responds to de-risk before drill query', () => {
    const response = getAdvisorResponse('Which prospects should we de-risk before drilling?', prospects);
    expect(response).toMatch(/de-risk|No prospects/i);
  });

  it('responds to tier 1 targets query', () => {
    const response = getAdvisorResponse('What are the Tier 1 targets?', prospects);
    expect(response).toMatch(/Tier 1|No Tier 1/i);
  });

  it('responds to high GCoS low data confidence query', () => {
    const response = getAdvisorResponse('Which prospects have high GCoS but low data confidence?', prospects);
    expect(response.length).toBeGreaterThan(0);
  });

  it('responds to main portfolio risk query', () => {
    const response = getAdvisorResponse('What is the main portfolio risk?', prospects);
    expect(response).toContain('portfolio risk');
  });

  it('responds to what should we do next query', () => {
    const response = getAdvisorResponse('What should we do next as an exploration team?', prospects);
    expect(response.length).toBeGreaterThan(0);
  });

  it('responds to farm-in candidates query', () => {
    const response = getAdvisorResponse('Which prospects are farm-in candidates?', prospects);
    expect(response).toMatch(/farm-in|No prospects/i);
  });

  it('manual prospect query returns manual scoring notice', () => {
    const response = getAdvisorResponse('evidence supports Wolfcamp East', prospects);
    expect(response).toContain('manual scoring');
  });
});

