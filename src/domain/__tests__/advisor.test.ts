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

describe('advisor ML queries', () => {
  it('responds to "is the ml model trained" with no-model message', () => {
    const response = getAdvisorResponse('Is the ML model trained?', prospects);
    expect(response.toLowerCase()).toMatch(/no trained|not connected|not yet/i);
  });

  it('responds to "is ml trained" with no-model message', () => {
    const response = getAdvisorResponse('is ml trained?', prospects);
    expect(response.toLowerCase()).toMatch(/no trained|not connected|not yet/i);
  });

  it('responds to "can we train ml" with readiness info', () => {
    const response = getAdvisorResponse('Can we train ML now?', prospects);
    expect(response.length).toBeGreaterThan(0);
    expect(response.toLowerCase()).toMatch(/train|readiness|ready|labeled/i);
  });

  it('responds to "data for ml" with requirements list', () => {
    const response = getAdvisorResponse('What data do we need for ML?', prospects);
    expect(response).toMatch(/labeled|historical|outcome/i);
  });

  it('responds to "export training dataset"', () => {
    const response = getAdvisorResponse('How do I export the training dataset?', prospects);
    expect(response.toLowerCase()).toMatch(/export|ml lab|synthetic/i);
  });

  it('responds to "how does ml compare" with comparison info', () => {
    const response = getAdvisorResponse('How does ML compare to expert GCoS?', prospects);
    expect(response.length).toBeGreaterThan(0);
    expect(response.toLowerCase()).toMatch(/baseline|deterministic|no trained/i);
  });

  it('responds to "ml vs expert" with comparison', () => {
    const response = getAdvisorResponse('ml vs expert gcos', prospects);
    expect(response.length).toBeGreaterThan(0);
  });

  it('responds to "which prospects are ml-ready"', () => {
    const response = getAdvisorResponse('Which prospects are ML-ready?', prospects);
    expect(response.toLowerCase()).toMatch(/readiness|evidence|confidence/i);
  });
});

describe('advisor outcome queries', () => {
  it('responds to "prospects with outcomes" with no-outcomes message when none', () => {
    const response = getAdvisorResponse('Which prospects have outcomes?', prospects);
    expect(response.toLowerCase()).toMatch(/no prospects|no trained|no outcome|add well/i);
  });

  it('responds to "how many labeled examples" with count info', () => {
    const response = getAdvisorResponse('How many labeled examples do we have?', prospects);
    expect(response.toLowerCase()).toMatch(/labeled|examples|outcomes/i);
  });

  it('responds to "dry holes" query', () => {
    const response = getAdvisorResponse('Which prospects are dry holes?', prospects);
    expect(response.toLowerCase()).toMatch(/dry hole|no prospects|no trained/i);
  });

  it('responds to "commercial discoveries" query', () => {
    const response = getAdvisorResponse('Which prospects are commercial discoveries?', prospects);
    expect(response.toLowerCase()).toMatch(/discovery|commercial|no discovery|no trained/i);
  });

  it('responds to outcome query with no trained model message', () => {
    const response = getAdvisorResponse('List all prospects with outcomes', prospects);
    expect(response.toLowerCase()).toMatch(/no trained|no outcome|add well/i);
  });
});

describe('advisor ML dataset import queries', () => {
  it('responds to "how do i import" with CSV format guidance', () => {
    const response = getAdvisorResponse('How do I import a dataset?', prospects);
    expect(response.toLowerCase()).toMatch(/csv|ml lab|import/i);
  });

  it('responds to "import dataset" query with CSV format guidance', () => {
    const response = getAdvisorResponse('How do I import a dataset into ML Lab?', prospects);
    expect(response.toLowerCase()).toMatch(/csv|ml lab|import/i);
  });

  it('responds to "dataset validation failed" with issue explanation', () => {
    const response = getAdvisorResponse('My dataset validation failed, why?', prospects);
    expect(response.toLowerCase()).toMatch(/critical|warning|column/i);
  });

  it('responds to "required columns" with column list', () => {
    const response = getAdvisorResponse('What are the required columns for the dataset?', prospects);
    expect(response).toMatch(/prospect_id|basin|outcome_label/i);
  });

  it('responds to "columns required" query', () => {
    const response = getAdvisorResponse('What columns are required to import?', prospects);
    expect(response.toLowerCase()).toMatch(/column|required|import/i);
  });

  it('responds to "can i train" with training readiness info', () => {
    const response = getAdvisorResponse('Can I train the model with my dataset?', prospects);
    expect(response.toLowerCase()).toMatch(/train|label|historical|dry hole/i);
  });

  it('responds to "post-drill leakage" with leakage column warning', () => {
    const response = getAdvisorResponse('What is post-drill leakage in ML?', prospects);
    expect(response.toLowerCase()).toMatch(/post.drill|leakage|actual_/i);
  });

  it('responds to "leakage column" with warning', () => {
    const response = getAdvisorResponse('What is a leakage column?', prospects);
    expect(response.toLowerCase()).toMatch(/leakage|post.drill|actual_/i);
  });
});

describe('advisor column mapping queries', () => {
  it('responds to "how do i map dataset columns"', () => {
    const response = getAdvisorResponse('How do I map dataset columns?', prospects);
    expect(response.toLowerCase()).toMatch(/map|column|mapping|ml lab/i);
  });

  it('responds to "my dataset has different column names"', () => {
    const response = getAdvisorResponse('My dataset has different column names', prospects);
    expect(response.toLowerCase()).toMatch(/column|preset|alias|different/i);
  });

  it('responds to "column mapping" query', () => {
    const response = getAdvisorResponse('Tell me about column mapping', prospects);
    expect(response.toLowerCase()).toMatch(/map|column|mapping/i);
  });

  it('responds to "what does dry hole map to"', () => {
    const response = getAdvisorResponse('What does dry hole map to?', prospects);
    expect(response.toLowerCase()).toMatch(/dry_hole|dry hole|normali/i);
  });

  it('responds to "can missing scores be defaulted"', () => {
    const response = getAdvisorResponse('Can missing scores be defaulted?', prospects);
    expect(response.toLowerCase()).toMatch(/default|score|0\.5|geoscience/i);
  });

  it('responds to "what are the preset mappings"', () => {
    const response = getAdvisorResponse('What are the preset mappings?', prospects);
    expect(response.toLowerCase()).toMatch(/preset|generic|nsta|nopims|npd|nlog/i);
  });

  it('responds to "regulator preset" query', () => {
    const response = getAdvisorResponse('Which regulator preset should I use?', prospects);
    expect(response.toLowerCase()).toMatch(/preset|nsta|nopims|npd|nlog/i);
  });
});

