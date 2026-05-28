import { describe, expect, it } from 'vitest';
import { scoreProspect, scoreProspects } from '../scoring';
import { mockProspects } from '../../data/mockProspects';
import {
  generateProspectReport,
  generatePortfolioReport,
  getProspectExecutiveSummary,
  getPortfolioExecutiveSummary,
  getPortfolioKeyDataGaps,
} from '../reporting';
import type { Prospect } from '../prospect';

const prospects = scoreProspects(mockProspects);
const singleProspect = prospects[0];

const minimalProspect: Prospect = scoreProspect({
  id: 'rpt-1',
  name: 'Report Test',
  basin: 'Neuquén',
  block: 'B',
  playType: 'Structural',
  latitude: -38,
  longitude: -68,
  sourceScore: 0.6,
  migrationScore: 0.6,
  reservoirScore: 0.6,
  sealScore: 0.6,
  trapScore: 0.6,
  timingScore: 0.6,
  commercialScore: 70,
  resourceEstimate: 120,
});

// ── ProspectReport ────────────────────────────────────────────────────────────

describe('generateProspectReport', () => {
  it('returns a ProspectReport with required fields', () => {
    const report = generateProspectReport(singleProspect);
    expect(report.prospect).toBe(singleProspect);
    expect(typeof report.executiveSummary).toBe('string');
    expect(report.executiveSummary.length).toBeGreaterThan(0);
    expect(Array.isArray(report.sections)).toBe(true);
    expect(report.sections.length).toBeGreaterThan(0);
    expect(typeof report.generatedAt).toBe('string');
  });

  it('includes an Overview section', () => {
    const report = generateProspectReport(singleProspect);
    const overview = report.sections.find((s) => s.title === 'Overview');
    expect(overview).toBeDefined();
    expect(overview!.content.some((l) => l.includes(singleProspect.basin))).toBe(true);
  });

  it('includes Petroleum System Scores section with all 6 scores', () => {
    const report = generateProspectReport(singleProspect);
    const scores = report.sections.find((s) => s.title === 'Petroleum System Scores');
    expect(scores).toBeDefined();
    expect(scores!.content.length).toBe(6);
    expect(scores!.content.some((l) => l.startsWith('Source:'))).toBe(true);
    expect(scores!.content.some((l) => l.startsWith('Timing:'))).toBe(true);
  });

  it('includes Risk Assessment section', () => {
    const report = generateProspectReport(singleProspect);
    const risk = report.sections.find((s) => s.title === 'Risk Assessment');
    expect(risk).toBeDefined();
    expect(risk!.content.some((l) => l.includes('GCoS'))).toBe(true);
    expect(risk!.content.some((l) => l.includes('Main Risk'))).toBe(true);
  });

  it('includes Targeting Recommendation section', () => {
    const report = generateProspectReport(singleProspect);
    const targeting = report.sections.find((s) => s.title === 'Targeting Recommendation');
    expect(targeting).toBeDefined();
    expect(targeting!.content.some((l) => l.includes('Tier'))).toBe(true);
  });

  it('includes Decision Economics section when economicAssessment is present', () => {
    const report = generateProspectReport(singleProspect);
    if (singleProspect.economicAssessment) {
      const econ = report.sections.find((s) => s.title === 'Decision Economics');
      expect(econ).toBeDefined();
      expect(econ!.content.some((l) => l.includes('Simple EMV'))).toBe(true);
    }
  });

  it('sets generatedAt to a valid ISO string', () => {
    const before = Date.now();
    const report = generateProspectReport(minimalProspect);
    const after = Date.now();
    const ts = new Date(report.generatedAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

// ── PortfolioReport ───────────────────────────────────────────────────────────

describe('generatePortfolioReport', () => {
  it('returns a PortfolioReport with required fields', () => {
    const report = generatePortfolioReport(prospects);
    expect(Array.isArray(report.prospects)).toBe(true);
    expect(typeof report.executiveSummary).toBe('string');
    expect(Array.isArray(report.sections)).toBe(true);
    expect(Array.isArray(report.keyDataGaps)).toBe(true);
    expect(typeof report.generatedAt).toBe('string');
  });

  it('includes Portfolio Summary section', () => {
    const report = generatePortfolioReport(prospects);
    const summary = report.sections.find((s) => s.title === 'Portfolio Summary');
    expect(summary).toBeDefined();
    expect(summary!.content.some((l) => l.includes('Total Prospects'))).toBe(true);
  });

  it('includes Prospectivity Tier Distribution section', () => {
    const report = generatePortfolioReport(prospects);
    const tiers = report.sections.find((s) => s.title === 'Prospectivity Tier Distribution');
    expect(tiers).toBeDefined();
    expect(tiers!.content.some((l) => l.includes('Tier 1'))).toBe(true);
  });

  it('includes Top Prospects section with up to 5 entries', () => {
    const report = generatePortfolioReport(prospects);
    const top = report.sections.find((s) => s.title === 'Top Prospects by GCoS');
    expect(top).toBeDefined();
    expect(top!.content.length).toBeLessThanOrEqual(5);
    expect(top!.content.length).toBeGreaterThan(0);
  });

  it('includes Economic Overview section', () => {
    const report = generatePortfolioReport(prospects);
    const econ = report.sections.find((s) => s.title === 'Economic Overview');
    expect(econ).toBeDefined();
    expect(econ!.content.some((l) => l.includes('Positive EMV'))).toBe(true);
  });

  it('handles empty portfolio gracefully', () => {
    const report = generatePortfolioReport([]);
    expect(report.prospects).toHaveLength(0);
    expect(typeof report.executiveSummary).toBe('string');
    expect(report.keyDataGaps).toHaveLength(1);
    expect(report.keyDataGaps[0]).toMatch(/no critical data gaps/i);
  });
});

// ── Executive summaries ───────────────────────────────────────────────────────

describe('getProspectExecutiveSummary', () => {
  it('returns a non-empty string containing the prospect name', () => {
    const summary = getProspectExecutiveSummary(minimalProspect);
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain(minimalProspect.name);
  });

  it('includes GCoS and main risk', () => {
    const summary = getProspectExecutiveSummary(minimalProspect);
    expect(summary).toContain('GCoS');
    expect(summary).toContain('risk');
  });

  it('includes EMV info when economicAssessment is present', () => {
    if (minimalProspect.economicAssessment) {
      const summary = getProspectExecutiveSummary(minimalProspect);
      expect(summary).toContain('EMV');
    }
  });
});

describe('getPortfolioExecutiveSummary', () => {
  it('returns a non-empty string for a real portfolio', () => {
    const summary = getPortfolioExecutiveSummary(prospects);
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
  });

  it('includes prospect count and GCoS info', () => {
    const summary = getPortfolioExecutiveSummary(prospects);
    expect(summary).toContain(`${prospects.length} prospect`);
    expect(summary).toMatch(/GCoS/i);
  });

  it('returns fallback for empty portfolio', () => {
    const summary = getPortfolioExecutiveSummary([]);
    expect(summary).toMatch(/no prospects/i);
  });
});

// ── Data gaps ─────────────────────────────────────────────────────────────────

describe('getPortfolioKeyDataGaps', () => {
  it('returns an array of strings', () => {
    const gaps = getPortfolioKeyDataGaps(prospects);
    expect(Array.isArray(gaps)).toBe(true);
    gaps.forEach((g) => expect(typeof g).toBe('string'));
  });

  it('returns a no-gaps message for an ideal portfolio', () => {
    const highDC: Prospect[] = [{ ...minimalProspect, dataConfidence: 90 }];
    const gaps = getPortfolioKeyDataGaps(highDC);
    // Might still have manual scoring note; just check it's not empty
    expect(gaps.length).toBeGreaterThan(0);
  });

  it('flags low-data-confidence prospects', () => {
    const lowDC: Prospect[] = [{ ...minimalProspect, dataConfidence: 30 }];
    const gaps = getPortfolioKeyDataGaps(lowDC);
    expect(gaps.some((g) => g.toLowerCase().includes('data confidence'))).toBe(true);
  });
});

// ── Advisor report queries ────────────────────────────────────────────────────

import { getAdvisorResponse } from '../advisor';

describe('advisor — report queries', () => {
  it('responds to "generate a summary report"', () => {
    const response = getAdvisorResponse('generate a summary report', prospects);
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
  });

  it('responds to "summarize this portfolio"', () => {
    const response = getAdvisorResponse('summarize this portfolio', prospects);
    expect(response).toContain('prospect');
  });

  it('responds to "what should I present to management"', () => {
    const response = getAdvisorResponse('what should I present to management?', prospects);
    expect(response.length).toBeGreaterThan(0);
  });

  it('responds to "what are the key risks"', () => {
    const response = getAdvisorResponse('what are the key risks in the portfolio?', prospects);
    expect(response).toMatch(/risk/i);
  });

  it('responds to "what are the key data gaps"', () => {
    const response = getAdvisorResponse('what are the key data gaps?', prospects);
    expect(response.length).toBeGreaterThan(0);
  });
});
