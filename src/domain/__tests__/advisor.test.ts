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

  it('returns prospects with low data confidence when asked', () => {
    const response = getAdvisorResponse('Which prospects have low data confidence?', prospects);
    expect(response).toBe('No prospects currently have low data confidence.');
  });

  it('summarizes weakest component across the portfolio', () => {
    const response = getAdvisorResponse('What is the weakest component in the portfolio?', prospects);
    expect(response).toContain('weakest component');
  });
});
