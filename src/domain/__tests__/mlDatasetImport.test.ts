import { describe, expect, it } from 'vitest';
import {
  parseCsvText,
  validateImportedDataset,
  convertImportedRowToProspect,
  convertImportedRowsToProspects,
  getMinimumTemplateContent,
  getRecommendedTemplateContent,
  REQUIRED_COLUMNS,
  type ImportedDatasetRow,
} from '../mlDatasetImport';

// ── Minimal valid row helper ──────────────────────────────────────────────────

const makeValidRow = (overrides: Partial<ImportedDatasetRow> = {}): ImportedDatasetRow => ({
  prospect_id: 'W-001',
  prospect_name: 'Test Well',
  basin: 'Neuquén',
  country: 'Argentina',
  block: 'A',
  play_type: 'Structural',
  latitude: '-38.5',
  longitude: '-68.2',
  source_score: '0.70',
  migration_score: '0.65',
  reservoir_score: '0.60',
  seal_score: '0.55',
  trap_score: '0.80',
  timing_score: '0.75',
  gcos_expert: '0.09',
  main_risk: 'seal',
  data_confidence: '72',
  resource_estimate_mmboe: '85',
  commercial_score: '68',
  scoring_mode: 'manual',
  outcome_label: 'dry_hole',
  target_variable: 'geological_success',
  hydrocarbon_present: 'false',
  geological_success: 'false',
  commercial_success: 'false',
  result_confidence: 'high',
  data_source: 'historical',
  is_synthetic: 'false',
  ...overrides,
});

const VALID_HEADERS = [...REQUIRED_COLUMNS];

// ── parseCsvText ──────────────────────────────────────────────────────────────

describe('parseCsvText', () => {
  it('parses simple CSV with correct headers and rows', () => {
    const csv = 'name,basin\nAlpha,Neuquén';
    const { headers, rows, issues } = parseCsvText(csv);
    expect(headers).toEqual(['name', 'basin']);
    expect(rows).toHaveLength(1);
    expect(rows[0]['name']).toBe('Alpha');
    expect(rows[0]['basin']).toBe('Neuquén');
    expect(issues.filter((i) => i.severity === 'critical')).toHaveLength(0);
  });

  it('returns critical issue for empty file', () => {
    const { issues, rows, headers } = parseCsvText('');
    expect(issues.some((i) => i.severity === 'critical')).toBe(true);
    expect(rows).toHaveLength(0);
    expect(headers).toHaveLength(0);
  });

  it('returns critical issue for whitespace-only string', () => {
    const { issues } = parseCsvText('   \n  ');
    expect(issues.some((i) => i.severity === 'critical')).toBe(true);
  });

  it('handles quoted values with embedded commas', () => {
    const csv = 'name,basin\n"Alpha, Deep","Neuquén Basin"';
    const { rows } = parseCsvText(csv);
    expect(rows[0]['name']).toBe('Alpha, Deep');
    expect(rows[0]['basin']).toBe('Neuquén Basin');
  });

  it('detects duplicate column headers and emits a warning', () => {
    const csv = 'name,name,basin\nAlpha,Alpha,Neuquén';
    const { issues } = parseCsvText(csv);
    expect(issues.some((i) => i.severity === 'warning' && /duplicate/i.test(i.message))).toBe(true);
  });

  it('trims whitespace from headers', () => {
    const csv = ' name , basin \nAlpha,Neuquén';
    const { headers } = parseCsvText(csv);
    expect(headers).toContain('name');
    expect(headers).toContain('basin');
  });

  it('skips empty rows', () => {
    const csv = 'name,basin\nAlpha,Neuquén\n\nBeta,Permian';
    const { rows } = parseCsvText(csv);
    expect(rows).toHaveLength(2);
  });
});

// ── validateImportedDataset — missing required columns ────────────────────────

describe('validateImportedDataset — missing required columns', () => {
  it('emits critical issue for each missing required column', () => {
    const { issues } = validateImportedDataset([], [makeValidRow()]);
    const criticals = issues.filter((i) => i.severity === 'critical');
    expect(criticals.length).toBeGreaterThan(0);
    expect(criticals.some((i) => /missing required column/i.test(i.message))).toBe(true);
  });

  it('reports all 28 required columns as missing when headers are empty', () => {
    const { issues } = validateImportedDataset([], []);
    expect(issues.filter((i) => i.severity === 'critical').length).toBe(REQUIRED_COLUMNS.length);
  });

  it('canImport is false when required columns are missing', () => {
    const { readiness } = validateImportedDataset(['name'], [{ name: 'Alpha' }]);
    expect(readiness.canImport).toBe(false);
  });
});

// ── validateImportedDataset — row-level critical issues ───────────────────────

describe('validateImportedDataset — row-level critical issues', () => {
  it('emits critical issue for latitude out of range', () => {
    const row = makeValidRow({ latitude: '95' });
    const { issues } = validateImportedDataset(VALID_HEADERS, [row]);
    expect(issues.some((i) => i.severity === 'critical' && i.column === 'latitude')).toBe(true);
  });

  it('emits critical issue for longitude out of range', () => {
    const row = makeValidRow({ longitude: '-200' });
    const { issues } = validateImportedDataset(VALID_HEADERS, [row]);
    expect(issues.some((i) => i.severity === 'critical' && i.column === 'longitude')).toBe(true);
  });

  it('emits critical issue for score > 1', () => {
    const row = makeValidRow({ source_score: '1.5' });
    const { issues } = validateImportedDataset(VALID_HEADERS, [row]);
    expect(issues.some((i) => i.severity === 'critical' && i.column === 'source_score')).toBe(true);
  });

  it('emits critical issue for score < 0', () => {
    const row = makeValidRow({ reservoir_score: '-0.1' });
    const { issues } = validateImportedDataset(VALID_HEADERS, [row]);
    expect(issues.some((i) => i.severity === 'critical' && i.column === 'reservoir_score')).toBe(true);
  });

  it('emits critical issue for invalid outcome_label', () => {
    const row = makeValidRow({ outcome_label: 'blowout' });
    const { issues } = validateImportedDataset(VALID_HEADERS, [row]);
    expect(issues.some((i) => i.severity === 'critical' && i.column === 'outcome_label')).toBe(true);
  });

  it('emits critical issue for invalid target_variable', () => {
    const row = makeValidRow({ target_variable: 'profit' });
    const { issues } = validateImportedDataset(VALID_HEADERS, [row]);
    expect(issues.some((i) => i.severity === 'critical' && i.column === 'target_variable')).toBe(true);
  });

  it('emits critical issue for invalid coordinates (NaN)', () => {
    const row = makeValidRow({ latitude: 'abc' });
    const { issues } = validateImportedDataset(VALID_HEADERS, [row]);
    expect(issues.some((i) => i.severity === 'critical' && i.column === 'latitude')).toBe(true);
  });
});

// ── validateImportedDataset — warnings ───────────────────────────────────────

describe('validateImportedDataset — warnings', () => {
  it('emits warning for outcome_label = unknown', () => {
    const row = makeValidRow({ outcome_label: 'unknown' });
    const { issues } = validateImportedDataset(VALID_HEADERS, [row]);
    expect(issues.some((i) => i.severity === 'warning' && i.column === 'outcome_label')).toBe(true);
  });

  it('emits warning for is_synthetic = true', () => {
    const row = makeValidRow({ is_synthetic: 'true' });
    const { issues } = validateImportedDataset(VALID_HEADERS, [row]);
    expect(issues.some((i) => i.severity === 'warning' && i.column === 'is_synthetic')).toBe(true);
  });

  it('emits warning when no dry holes in dataset', () => {
    const row = makeValidRow({ outcome_label: 'commercial_discovery' });
    const { issues } = validateImportedDataset(VALID_HEADERS, [row]);
    expect(issues.some((i) => i.severity === 'warning' && /dry hole/i.test(i.message))).toBe(true);
  });

  it('emits warning for post-drill leakage columns', () => {
    const headersWithLeakage = [...VALID_HEADERS, 'actual_net_pay_m'];
    const { issues } = validateImportedDataset(headersWithLeakage, [makeValidRow()]);
    expect(issues.some((i) => i.severity === 'warning' && /post.drill/i.test(i.message))).toBe(true);
  });
});

// ── validateImportedDataset — valid dataset ───────────────────────────────────

describe('validateImportedDataset — valid dataset', () => {
  it('emits no critical issues for a valid row', () => {
    const { issues } = validateImportedDataset(VALID_HEADERS, [makeValidRow()]);
    const criticals = issues.filter((i) => i.severity === 'critical');
    expect(criticals).toHaveLength(0);
  });

  it('sets canImport = true when all rows are valid', () => {
    const { readiness } = validateImportedDataset(VALID_HEADERS, [makeValidRow()]);
    expect(readiness.canImport).toBe(true);
    expect(readiness.validRows).toBe(1);
  });

  it('returns preview rows capped at 10', () => {
    const rows = Array.from({ length: 20 }, (_, i) => makeValidRow({ prospect_id: `W-${i}` }));
    const { rows: previewRows, rowCount } = validateImportedDataset(VALID_HEADERS, rows);
    expect(previewRows.length).toBe(10);
    expect(rowCount).toBe(20);
  });

  it('counts labeled rows correctly', () => {
    const rows = [
      makeValidRow({ outcome_label: 'dry_hole' }),
      makeValidRow({ outcome_label: 'commercial_discovery', prospect_id: 'W-002' }),
      makeValidRow({ outcome_label: 'unknown', prospect_id: 'W-003' }),
    ];
    const { readiness } = validateImportedDataset(VALID_HEADERS, rows);
    expect(readiness.labeledRows).toBe(2);
    expect(readiness.dryHoleCount).toBe(1);
    expect(readiness.discoveryCount).toBe(1);
  });
});

// ── convertImportedRowToProspect ─────────────────────────────────────────────

describe('convertImportedRowToProspect', () => {
  it('maps required fields to Prospect', () => {
    const p = convertImportedRowToProspect(makeValidRow());
    expect(p.id).toBe('W-001');
    expect(p.name).toBe('Test Well');
    expect(p.basin).toBe('Neuquén');
    expect(p.playType).toBe('Structural');
    expect(p.latitude).toBeCloseTo(-38.5);
    expect(p.longitude).toBeCloseTo(-68.2);
    expect(p.sourceScore).toBeCloseTo(0.70);
    expect(p.commercialScore).toBe(68);
    expect(p.resourceEstimate).toBe(85);
  });

  it('maps outcome_label and target_variable to prospect.outcome', () => {
    const p = convertImportedRowToProspect(makeValidRow());
    expect(p.outcome).toBeDefined();
    expect(p.outcome!.label).toBe('dry_hole');
    expect(p.outcome!.targetVariable).toBe('geological_success');
    expect(p.outcome!.source).toBe('historical');
  });

  it('sets outcome.source = synthetic when is_synthetic = true', () => {
    const p = convertImportedRowToProspect(makeValidRow({ is_synthetic: 'true' }));
    expect(p.outcome?.source).toBe('synthetic');
  });

  it('regenerates derived fields (GCoS, priority) after mapping', () => {
    const p = convertImportedRowToProspect(makeValidRow());
    expect(typeof p.geologicalChanceOfSuccess).toBe('number');
    expect(p.geologicalChanceOfSuccess).toBeGreaterThan(0);
    expect(p.priority).toBeDefined();
  });

  it('clamps score columns to [0, 1] instead of throwing', () => {
    const p = convertImportedRowToProspect(makeValidRow({ source_score: '1.5' }));
    expect(p.sourceScore).toBe(1);
  });

  it('uses evidence_derived scoringMode when scoring_mode = evidence_derived', () => {
    const p = convertImportedRowToProspect(makeValidRow({ scoring_mode: 'evidence_derived' }));
    expect(p.scoringMode).toBe('evidence_derived');
  });

  it('falls back to manual scoringMode for unknown values', () => {
    const p = convertImportedRowToProspect(makeValidRow({ scoring_mode: 'weird' }));
    expect(p.scoringMode).toBe('manual');
  });
});

// ── convertImportedRowsToProspects ───────────────────────────────────────────

describe('convertImportedRowsToProspects', () => {
  it('converts all valid rows', () => {
    const rows = [
      makeValidRow({ prospect_id: 'A1' }),
      makeValidRow({ prospect_id: 'A2' }),
    ];
    const { prospects, issues } = convertImportedRowsToProspects(rows);
    expect(prospects).toHaveLength(2);
    expect(issues.filter((i) => i.severity === 'critical')).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    const { prospects } = convertImportedRowsToProspects([]);
    expect(prospects).toHaveLength(0);
  });
});

// ── Templates ─────────────────────────────────────────────────────────────────

describe('templates', () => {
  it('minimum template contains all required columns in header', () => {
    const content = getMinimumTemplateContent();
    const headerLine = content.split('\n')[0];
    for (const col of REQUIRED_COLUMNS) {
      expect(headerLine).toContain(col);
    }
  });

  it('recommended template contains required + optional geology columns', () => {
    const content = getRecommendedTemplateContent();
    const headerLine = content.split('\n')[0];
    expect(headerLine).toContain('toc_percent');
    expect(headerLine).toContain('porosity_percent');
  });

  it('templates include an example data row', () => {
    const lines = getMinimumTemplateContent().split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });
});
