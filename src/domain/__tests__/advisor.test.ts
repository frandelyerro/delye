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

describe('advisor trained ML baseline queries', () => {
  it('says ML must not decide drilling (advisory only)', () => {
    const response = getAdvisorResponse('Can we use ML to decide drilling?', prospects);
    expect(response.toLowerCase()).toMatch(/^no|advisory|must not|source of truth/i);
    expect(response.toLowerCase()).toMatch(/expert/i);
  });

  it('says no trained model is wired into targeting when asked if trained', () => {
    const response = getAdvisorResponse('Is the ML model trained?', prospects);
    expect(response.toLowerCase()).toMatch(/no trained|advisory|expert/i);
  });

  it('explains how many labels are needed', () => {
    const response = getAdvisorResponse('How many labels do we need?', prospects);
    expect(response.toLowerCase()).toMatch(/label|example/i);
    expect(response).toMatch(/\d+/);
  });

  it('explains how to train the model', () => {
    const response = getAdvisorResponse('How do I train the ML model?', prospects);
    expect(response.toLowerCase()).toMatch(/ml lab|train|split/i);
    expect(response.toLowerCase()).toMatch(/advisory|never overrides|expert/i);
  });

  it('describes which features drive the ML model and warns about leakage', () => {
    const response = getAdvisorResponse('What features drive the ML model?', prospects);
    expect(response.toLowerCase()).toMatch(/pre-drill|feature|leakage/i);
  });

  it('explains why ML is not ready', () => {
    const response = getAdvisorResponse('Why is ML not ready?', prospects);
    expect(response.toLowerCase()).toMatch(/ready|labeled|outcome|example/i);
  });

  it('describes accuracy as a prototype measured in ML Lab', () => {
    const response = getAdvisorResponse('How accurate is the ML model?', prospects);
    expect(response.toLowerCase()).toMatch(/prototype|accuracy|advisory/i);
  });
});

describe('advisor spatial / map queries', () => {
  it('basin distribution query returns basin-by-basin breakdown', () => {
    const response = getAdvisorResponse('Basin distribution?', prospects);
    expect(response.toLowerCase()).toMatch(/basin|distribution|avg gcos/i);
    expect(response).toContain('prospect');
  });

  it('"by basin" query returns multi-basin stats', () => {
    const response = getAdvisorResponse('Show me performance by basin', prospects);
    expect(response.toLowerCase()).toMatch(/basin/i);
    expect(response.length).toBeGreaterThan(30);
  });

  it('"best basin" query ranks basins by GCoS', () => {
    const response = getAdvisorResponse('Which is the best basin?', prospects);
    expect(response.toLowerCase()).toMatch(/best basin|avg gcos/i);
    expect(response).toContain('%');
  });

  it('"worst basin" returns weakest basin', () => {
    const response = getAdvisorResponse('What is the worst basin?', prospects);
    expect(response.toLowerCase()).toMatch(/weakest basin|worst/i);
  });

  it('"map overview" returns geographic extent and priority split', () => {
    const response = getAdvisorResponse('Map overview', prospects);
    expect(response.toLowerCase()).toMatch(/basin|gcos|priority/i);
    expect(response.toLowerCase()).toMatch(/lat|lon|geographic/i);
  });

  it('"spatial overview" returns distribution stats', () => {
    const response = getAdvisorResponse('Give me a spatial overview of the portfolio', prospects);
    expect(response.toLowerCase()).toMatch(/basin|prospect/i);
  });

  it('"cluster analysis" groups by basin', () => {
    const response = getAdvisorResponse('cluster spatial analysis', prospects);
    expect(response.toLowerCase()).toMatch(/cluster|basin/i);
    expect(response.length).toBeGreaterThan(30);
  });

  it('"frontier basin" identifies low-confidence prospects', () => {
    const response = getAdvisorResponse('Are there frontier basin opportunities?', prospects);
    expect(response.toLowerCase()).toMatch(/frontier|confidence/i);
  });
});

describe('advisor Norway FactPages queries', () => {
  it('responds to "norway factpages" with adapter description', () => {
    const response = getAdvisorResponse('How do I use Norway FactPages data?', prospects);
    expect(response.toLowerCase()).toMatch(/factpages|sokkeldirektoratet|norway/i);
  });

  it('responds to "sokkeldirektoratet" with adapter description', () => {
    const response = getAdvisorResponse('What is sokkeldirektoratet data?', prospects);
    expect(response.toLowerCase()).toMatch(/factpages|sokkeldirektoratet|adapter/i);
  });

  it('responds to "convert norway csv" with step-by-step guide', () => {
    const response = getAdvisorResponse('How do I convert a Norway CSV?', prospects);
    expect(response.toLowerCase()).toMatch(/convert|norway|adapter/i);
  });

  it('responds to "norway limitations" with score defaulting explanation', () => {
    const response = getAdvisorResponse('What are the Norway FactPages limitations?', prospects);
    expect(response.toLowerCase()).toMatch(/0\.5|default|limitation/i);
  });

  it('responds to "norwegian wells" with adapter info', () => {
    const response = getAdvisorResponse('Can I import Norwegian wells?', prospects);
    expect(response.toLowerCase()).toMatch(/norway|factpages|adapter/i);
  });
});

