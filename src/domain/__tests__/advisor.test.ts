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
    // East Siberia Lead uses all-unknown evidence → overallConfidence 'unknown' → -50 penalty applied,
    // correctly placing it below the 50/100 threshold (was incorrectly 95/100 before the fix).
    expect(response).toContain('East Siberia Lead');
    expect(response).toMatch(/\(\d+\/100\)/);
  });

  it('summarizes weakest component across the portfolio', () => {
    const response = getAdvisorResponse('What is the weakest component in the portfolio?', prospects);
    expect(response).toContain('weakest component');
  });
});
