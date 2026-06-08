import { describe, expect, it } from 'vitest';
import {
  isNorwayWellboreDataset,
  isNorwayDiscoveryDataset,
  isNorwayDiscoveryReservesDataset,
  isNorwayDiscoveryDescriptionDataset,
  isNorwayFieldDataset,
  buildDiscoveryLookup,
  buildReserveLookup,
  buildDescriptionLookup,
  buildFieldLookup,
  convertNorwayWellboreRowToImportRow,
  convertNorwayWellboreRowsToImportRows,
} from '../norwayFactpagesAdapter';
import { validateImportedDataset } from '../mlDatasetImport';

// ── Sample row factories ───────────────────────────────────────────────────────

const makeWellboreRow = (overrides: Record<string, string> = {}): Record<string, string> => ({
  'Wellbore name': '6406/2-1',
  'Well name': '6406/2',
  'Drilling operator': 'Equinor',
  'Production licence at wellhead': 'PL 088',
  'Purpose': 'EXPLORATION',
  'Status': 'P&A',
  'Content': 'GAS',
  'Type': 'EXPLORATION',
  'Field': '',
  'Discovery': 'SMØRBUKK SØR',
  'Main area': 'Norwegian Sea',
  'NS decimal degrees': '65.123',
  'EW decimal degrees': '7.456',
  'NPDID wellbore': '3008',
  'NPDID discovery': '4001',
  'NPDID field': '',
  'FactPage url': 'https://factpages.sodir.no/factpages/Default.aspx?nav1=wellbore&nav2=PageView|All&nav3=3008',
  ...overrides,
});

const makeDiscoveryRow = (overrides: Record<string, string> = {}): Record<string, string> => ({
  'Discovery name': 'SMØRBUKK SØR',
  'Operator': 'Equinor',
  'Current activity status': 'Producing',
  'HC type': 'GAS/CONDENSATE',
  'Discovery wellbore': '6406/2-1',
  'Main area': 'Norwegian Sea',
  'For more information, see field': 'ÅSGARD',
  'Discovery year': '1984',
  'NPDID discovery': '4001',
  'NPDID field': '43765',
  'NPDID wellbore': '3008',
  ...overrides,
});

const makeReserveRow = (overrides: Record<string, string> = {}): Record<string, string> => ({
  'Discovery name': 'SMØRBUKK SØR',
  'Resource category': '0+1',
  'Rec. oil [mill Sm3]': '0',
  'Rec. gas [bill Sm3]': '47.6',
  'Rec. NGL [mill tonn]': '5.2',
  'Rec. cond. [mill Sm3]': '0',
  'Rec. oil eq. [mill OE]': '310.8',
  'NPDID discovery': '4001',
  ...overrides,
});

const makeDescriptionRow = (overrides: Record<string, string> = {}): Record<string, string> => ({
  'Discovery name': 'SMØRBUKK SØR',
  'Text': 'Gas and condensate discovery in Jurassic reservoir.',
  'NPDID discovery': '4001',
  ...overrides,
});

const makeFieldRow = (overrides: Record<string, string> = {}): Record<string, string> => ({
  'Field name': 'ÅSGARD',
  'Operator name': 'Equinor',
  'Current activity status': 'Producing',
  'Discovery wellbore': '6406/2-1',
  'Main area': 'Norwegian Sea',
  'Hydrocarbon type': 'GAS/CONDENSATE',
  'NPDID field': '43765',
  'NPDID wellbore': '3008',
  ...overrides,
});

// ── Dataset detection ─────────────────────────────────────────────────────────

describe('dataset detection', () => {
  const wellboreHeaders = [
    'Wellbore name', 'Well name', 'Drilling operator', 'Production licence at wellhead',
    'Purpose', 'Status', 'Content', 'Type', 'Field', 'Discovery', 'Main area',
    'NS decimal degrees', 'EW decimal degrees', 'NPDID wellbore', 'NPDID discovery',
    'NPDID field', 'FactPage url',
  ];

  it('detects Norway wellbore dataset headers', () => {
    expect(isNorwayWellboreDataset(wellboreHeaders)).toBe(true);
  });

  it('rejects unrelated headers', () => {
    expect(isNorwayWellboreDataset(['name', 'basin', 'latitude'])).toBe(false);
  });

  it('detects discovery dataset headers', () => {
    const headers = ['Discovery name', 'Operator', 'Current activity status', 'HC type', 'NPDID discovery'];
    expect(isNorwayDiscoveryDataset(headers)).toBe(true);
  });

  it('detects discovery reserves dataset headers', () => {
    const headers = ['Discovery name', 'Resource category', 'Rec. oil eq. [mill OE]', 'NPDID discovery'];
    expect(isNorwayDiscoveryReservesDataset(headers)).toBe(true);
  });

  it('detects discovery description dataset headers', () => {
    const headers = ['Discovery name', 'Text', 'NPDID discovery'];
    expect(isNorwayDiscoveryDescriptionDataset(headers)).toBe(true);
  });

  it('detects field dataset headers', () => {
    const headers = ['Field name', 'Operator name', 'Current activity status', 'Hydrocarbon type', 'NPDID field'];
    expect(isNorwayFieldDataset(headers)).toBe(true);
  });

  it('does not confuse wellbore dataset with discovery dataset', () => {
    const discoveryHeaders = ['Discovery name', 'Current activity status', 'HC type', 'NPDID discovery'];
    expect(isNorwayWellboreDataset(discoveryHeaders)).toBe(false);
  });
});

// ── Lookup builders ───────────────────────────────────────────────────────────

describe('buildDiscoveryLookup', () => {
  it('maps NPDID discovery as key', () => {
    const rows = [makeDiscoveryRow()];
    const map = buildDiscoveryLookup(rows);
    expect(map.has('4001')).toBe(true);
  });

  it('skips rows with blank NPDID discovery', () => {
    const rows = [makeDiscoveryRow({ 'NPDID discovery': '' })];
    const map = buildDiscoveryLookup(rows);
    expect(map.size).toBe(0);
  });
});

describe('buildReserveLookup', () => {
  it('maps NPDID discovery as key', () => {
    const rows = [makeReserveRow()];
    const map = buildReserveLookup(rows);
    expect(map.has('4001')).toBe(true);
  });

  it('prefers Resource category "0+1"', () => {
    const rows = [
      makeReserveRow({ 'Resource category': '3', 'Rec. oil eq. [mill OE]': '50' }),
      makeReserveRow({ 'Resource category': '0+1', 'Rec. oil eq. [mill OE]': '310.8' }),
    ];
    const map = buildReserveLookup(rows);
    const row = map.get('4001')!;
    expect(row['Resource category']).toBe('0+1');
  });

  it('falls back to largest Rec. oil eq. [mill OE] when no 0+1 category', () => {
    const rows = [
      makeReserveRow({ 'Resource category': '3', 'Rec. oil eq. [mill OE]': '50' }),
      makeReserveRow({ 'Resource category': '2', 'Rec. oil eq. [mill OE]': '200' }),
    ];
    const map = buildReserveLookup(rows);
    const row = map.get('4001')!;
    expect(row['Rec. oil eq. [mill OE]']).toBe('200');
  });

  it('handles comma decimal separator', () => {
    const rows = [makeReserveRow({ 'Rec. oil eq. [mill OE]': '310,8', 'Resource category': 'X' })];
    const map = buildReserveLookup(rows);
    expect(map.has('4001')).toBe(true);
  });
});

describe('buildDescriptionLookup', () => {
  it('maps NPDID discovery as key', () => {
    const rows = [makeDescriptionRow()];
    const map = buildDescriptionLookup(rows);
    expect(map.has('4001')).toBe(true);
  });

  it('skips rows with blank NPDID discovery', () => {
    const rows = [makeDescriptionRow({ 'NPDID discovery': '' })];
    const map = buildDescriptionLookup(rows);
    expect(map.size).toBe(0);
  });

  it('skips rows with blank Text', () => {
    const rows = [makeDescriptionRow({ Text: '' })];
    const map = buildDescriptionLookup(rows);
    expect(map.size).toBe(0);
  });
});

describe('buildFieldLookup', () => {
  it('maps NPDID field as key', () => {
    const rows = [makeFieldRow()];
    const map = buildFieldLookup(rows);
    expect(map.has('43765')).toBe(true);
  });

  it('skips rows with blank NPDID field', () => {
    const rows = [makeFieldRow({ 'NPDID field': '' })];
    const map = buildFieldLookup(rows);
    expect(map.size).toBe(0);
  });
});

// ── Wellbore field mapping ────────────────────────────────────────────────────

describe('convertNorwayWellboreRowToImportRow — field mapping', () => {
  it('maps NPDID wellbore to prospect_id', () => {
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow());
    expect(row.prospect_id).toBe('3008');
  });

  it('maps Wellbore name to prospect_name', () => {
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow());
    expect(row.prospect_name).toBe('6406/2-1');
  });

  it('falls back to Well name when Wellbore name is blank', () => {
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow({ 'Wellbore name': '' }));
    expect(row.prospect_name).toBe('6406/2');
  });

  it('generates fallback prospect_name when both names are blank', () => {
    const row = convertNorwayWellboreRowToImportRow(
      makeWellboreRow({ 'Wellbore name': '', 'Well name': '' })
    );
    expect(row.prospect_name).toMatch(/Norway wellbore 3008/);
  });

  it('generates fallback prospect_id from Wellbore name when NPDID is blank', () => {
    const row = convertNorwayWellboreRowToImportRow(
      makeWellboreRow({ 'NPDID wellbore': '' })
    );
    expect(row.prospect_id).toMatch(/^norway-/);
  });

  it('maps Main area to basin', () => {
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow());
    expect(row.basin).toBe('Norwegian Sea');
  });

  it('defaults basin to Norwegian Continental Shelf when Main area is blank', () => {
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow({ 'Main area': '' }));
    expect(row.basin).toBe('Norwegian Continental Shelf');
  });

  it('maps Production licence at wellhead to block', () => {
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow());
    expect(row.block).toBe('PL 088');
  });

  it('maps NS decimal degrees to latitude', () => {
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow());
    expect(row.latitude).toBe('65.123');
  });

  it('maps EW decimal degrees to longitude', () => {
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow());
    expect(row.longitude).toBe('7.456');
  });

  it('country defaults to Norway', () => {
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow());
    expect(row.country).toBe('Norway');
  });

  it('data_source defaults to Sokkeldirektoratet FactPages', () => {
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow());
    expect(row.data_source).toBe('Sokkeldirektoratet FactPages');
  });

  it('scoring_mode defaults to manual', () => {
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow());
    expect(row.scoring_mode).toBe('manual');
  });

  it('target_variable defaults to hydrocarbon_presence', () => {
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow());
    expect(row.target_variable).toBe('hydrocarbon_presence');
  });

  it('is_synthetic defaults to false', () => {
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow());
    expect(row.is_synthetic).toBe('false');
  });

  it('default component scores are all 0.5', () => {
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow());
    for (const col of ['source_score', 'migration_score', 'reservoir_score', 'seal_score', 'trap_score', 'timing_score']) {
      expect(row[col]).toBe('0.5');
    }
  });

  it('gcos_expert defaults to 0.015625', () => {
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow());
    expect(row.gcos_expert).toBe('0.015625');
  });

  it('data_confidence defaults to 50', () => {
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow());
    expect(row.data_confidence).toBe('50');
  });
});

// ── Outcome mapping ───────────────────────────────────────────────────────────

describe('convertNorwayWellboreRowToImportRow — outcome mapping', () => {
  it('DRY maps to dry_hole', () => {
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow({ Content: 'DRY', 'Discovery': '', 'Field': '', 'NPDID discovery': '', 'NPDID field': '' }));
    expect(row.outcome_label).toBe('dry_hole');
    expect(row.hydrocarbon_present).toBe('false');
    expect(row.geological_success).toBe('false');
    expect(row.commercial_success).toBe('false');
    expect(row.result_confidence).toBe('high');
  });

  it('OIL with Field name maps to commercial_discovery', () => {
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow({ Content: 'OIL', Field: 'EKOFISK', 'NPDID field': '' }));
    expect(row.outcome_label).toBe('commercial_discovery');
    expect(row.commercial_success).toBe('true');
  });

  it('GAS with NPDID field maps to commercial_discovery', () => {
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow({ Content: 'GAS', Field: '', 'NPDID field': '43765' }));
    expect(row.outcome_label).toBe('commercial_discovery');
  });

  it('OIL/GAS with Discovery but no Field maps to technical_discovery', () => {
    const row = convertNorwayWellboreRowToImportRow(
      makeWellboreRow({ Content: 'OIL/GAS', Field: '', 'NPDID field': '', Discovery: 'SOME DISC', 'NPDID discovery': '9999' })
    );
    expect(row.outcome_label).toBe('technical_discovery');
    expect(row.hydrocarbon_present).toBe('true');
    expect(row.commercial_success).toBe('false');
  });

  it('GAS with no Field and no Discovery maps to technical_discovery (medium confidence)', () => {
    const row = convertNorwayWellboreRowToImportRow(
      makeWellboreRow({ Content: 'GAS', Field: '', 'NPDID field': '', Discovery: '', 'NPDID discovery': '' })
    );
    expect(row.outcome_label).toBe('technical_discovery');
    expect(row.result_confidence).toBe('medium');
  });

  it('OIL SHOWS maps to non_commercial', () => {
    const row = convertNorwayWellboreRowToImportRow(
      makeWellboreRow({ Content: 'OIL SHOWS', Field: '', 'NPDID field': '', Discovery: '', 'NPDID discovery': '' })
    );
    expect(row.outcome_label).toBe('non_commercial');
    expect(row.hydrocarbon_present).toBe('true');
    expect(row.commercial_success).toBe('false');
  });

  it('GAS SHOWS maps to non_commercial', () => {
    const row = convertNorwayWellboreRowToImportRow(
      makeWellboreRow({ Content: 'GAS SHOWS', Field: '', 'NPDID field': '', Discovery: '', 'NPDID discovery': '' })
    );
    expect(row.outcome_label).toBe('non_commercial');
  });

  it('blank/unknown content maps to unknown', () => {
    const row = convertNorwayWellboreRowToImportRow(
      makeWellboreRow({ Content: '', Field: '', 'NPDID field': '', Discovery: '', 'NPDID discovery': '' })
    );
    expect(row.outcome_label).toBe('unknown');
  });

  it('DRY is not overridden by discovery enrichment', () => {
    const discoveryRow = makeDiscoveryRow({ 'Current activity status': 'Producing' });
    const discoveryMap = new Map([['4001', discoveryRow]]);
    const row = convertNorwayWellboreRowToImportRow(
      makeWellboreRow({ Content: 'DRY' }),
      discoveryMap,
    );
    expect(row.outcome_label).toBe('dry_hole');
  });

  it('DRY is not overridden by field enrichment', () => {
    const fieldMap = new Map([['43765', makeFieldRow()]]);
    const row = convertNorwayWellboreRowToImportRow(
      makeWellboreRow({ Content: 'DRY', 'NPDID field': '43765', Field: 'ÅSGARD' }),
      undefined, undefined, undefined, fieldMap,
    );
    expect(row.outcome_label).toBe('dry_hole');
  });

  it('GAS/CONDENSATE is recognized as hydrocarbon-bearing', () => {
    const row = convertNorwayWellboreRowToImportRow(
      makeWellboreRow({ Content: 'GAS/CONDENSATE', Field: 'ÅSGARD', 'NPDID field': '' })
    );
    expect(row.outcome_label).toBe('commercial_discovery');
  });
});

// ── Discovery enrichment ──────────────────────────────────────────────────────

describe('discovery enrichment', () => {
  it('Producing status maps to commercial_discovery', () => {
    const discMap = new Map([['4001', makeDiscoveryRow({ 'Current activity status': 'Producing', 'For more information, see field': 'ÅSGARD', 'NPDID field': '43765' })]]);
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow({ Content: 'GAS', Field: '', 'NPDID field': '' }), discMap);
    expect(row.outcome_label).toBe('commercial_discovery');
  });

  it('Shut down status maps to commercial_discovery', () => {
    const discMap = new Map([['4001', makeDiscoveryRow({ 'Current activity status': 'Shut down', 'For more information, see field': '', 'NPDID field': '' })]]);
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow({ Content: 'GAS', Field: '', 'NPDID field': '' }), discMap);
    expect(row.outcome_label).toBe('commercial_discovery');
  });

  it('"For more information, see field" non-blank maps to commercial_discovery', () => {
    const discMap = new Map([['4001', makeDiscoveryRow({ 'For more information, see field': 'ÅSGARD', 'Current activity status': 'Production has ceased', 'NPDID field': '' })]]);
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow({ Content: 'OIL', Field: '', 'NPDID field': '' }), discMap);
    expect(row.outcome_label).toBe('commercial_discovery');
  });

  it('"Production is unlikely" maps to non_commercial (not dry)', () => {
    const discMap = new Map([['4001', makeDiscoveryRow({ 'Current activity status': 'Production is unlikely', 'For more information, see field': '', 'NPDID field': '' })]]);
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow({ Content: 'GAS', Field: '', 'NPDID field': '' }), discMap);
    expect(row.outcome_label).toBe('non_commercial');
  });

  it('"Evaluation" with hydrocarbons remains technical_discovery', () => {
    const discMap = new Map([['4001', makeDiscoveryRow({ 'Current activity status': 'Evaluation', 'For more information, see field': '', 'NPDID field': '' })]]);
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow({ Content: 'GAS', Field: '', 'NPDID field': '', Discovery: 'DISC', 'NPDID discovery': '4001' }), discMap);
    expect(row.outcome_label).toBe('technical_discovery');
  });
});

// ── Field enrichment ──────────────────────────────────────────────────────────

describe('field enrichment', () => {
  it('wellbore with matching NPDID field maps to commercial_discovery', () => {
    const fieldMap = new Map([['43765', makeFieldRow()]]);
    const row = convertNorwayWellboreRowToImportRow(
      makeWellboreRow({ Content: 'GAS', Field: '', 'NPDID field': '43765' }),
      undefined, undefined, undefined, fieldMap,
    );
    expect(row.outcome_label).toBe('commercial_discovery');
  });

  it('DRY well with matching NPDID field remains dry_hole', () => {
    const fieldMap = new Map([['43765', makeFieldRow()]]);
    const row = convertNorwayWellboreRowToImportRow(
      makeWellboreRow({ Content: 'DRY', 'NPDID field': '43765' }),
      undefined, undefined, undefined, fieldMap,
    );
    expect(row.outcome_label).toBe('dry_hole');
  });
});

// ── Resource enrichment ───────────────────────────────────────────────────────

describe('resource enrichment', () => {
  it('Rec. oil eq. [mill OE] maps to resource_estimate_mmboe', () => {
    const resMap = new Map([['4001', makeReserveRow({ 'Rec. oil eq. [mill OE]': '310.8' })]]);
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow(), undefined, resMap);
    expect(row.resource_estimate_mmboe).toBe('310.8');
  });

  it('commercial_discovery with resources gets commercial_score 85', () => {
    const discMap = new Map([['4001', makeDiscoveryRow()]]);
    const resMap = new Map([['4001', makeReserveRow({ 'Rec. oil eq. [mill OE]': '310.8' })]]);
    const row = convertNorwayWellboreRowToImportRow(
      makeWellboreRow({ Content: 'GAS', Field: '', 'NPDID field': '' }),
      discMap, resMap,
    );
    expect(row.outcome_label).toBe('commercial_discovery');
    expect(row.commercial_score).toBe('85');
  });

  it('technical_discovery with resources gets commercial_score 65', () => {
    const resMap = new Map([['4001', makeReserveRow({ 'Rec. oil eq. [mill OE]': '50' })]]);
    const row = convertNorwayWellboreRowToImportRow(
      makeWellboreRow({ Content: 'GAS', Field: '', 'NPDID field': '', Discovery: 'DISC', 'NPDID discovery': '4001' }),
      undefined, resMap,
    );
    expect(row.outcome_label).toBe('technical_discovery');
    expect(row.commercial_score).toBe('65');
  });

  it('commercial_discovery with no resources gets commercial_score 80', () => {
    const discMap = new Map([['4001', makeDiscoveryRow()]]);
    const row = convertNorwayWellboreRowToImportRow(
      makeWellboreRow({ Content: 'GAS', Field: '', 'NPDID field': '' }),
      discMap,
    );
    expect(row.commercial_score).toBe('80');
  });

  it('dry_hole gets commercial_score 25', () => {
    const row = convertNorwayWellboreRowToImportRow(
      makeWellboreRow({ Content: 'DRY', Field: '', 'NPDID field': '', Discovery: '', 'NPDID discovery': '' })
    );
    expect(row.commercial_score).toBe('25');
  });

  it('unknown outcome gets commercial_score 50', () => {
    const row = convertNorwayWellboreRowToImportRow(
      makeWellboreRow({ Content: '', Field: '', 'NPDID field': '', Discovery: '', 'NPDID discovery': '' })
    );
    expect(row.commercial_score).toBe('50');
  });

  it('resource_estimate_mmboe defaults to 0 when no reserve row', () => {
    const row = convertNorwayWellboreRowToImportRow(makeWellboreRow());
    expect(row.resource_estimate_mmboe).toBe('0');
  });
});

// ── Discovery descriptions ────────────────────────────────────────────────────

describe('discovery descriptions', () => {
  it('description info issue is emitted when descriptions are provided', () => {
    const { issues } = convertNorwayWellboreRowsToImportRows(
      [makeWellboreRow()],
      { descriptionRows: [makeDescriptionRow()] },
    );
    expect(issues.some((i) => i.severity === 'info' && /description/i.test(i.message))).toBe(true);
  });

  it('descriptions do not alter geoscience scores', () => {
    const { rows } = convertNorwayWellboreRowsToImportRows(
      [makeWellboreRow()],
      { descriptionRows: [makeDescriptionRow()] },
    );
    expect(rows[0].source_score).toBe('0.5');
    expect(rows[0].reservoir_score).toBe('0.5');
  });
});

// ── Batch conversion ──────────────────────────────────────────────────────────

describe('convertNorwayWellboreRowsToImportRows — batch', () => {
  it('emits batch warning about defaulted geoscience scores', () => {
    const { issues } = convertNorwayWellboreRowsToImportRows([makeWellboreRow()]);
    expect(issues.some((i) => i.severity === 'warning' && /defaulted/i.test(i.message))).toBe(true);
  });

  it('emits info issue for blank Main area rows', () => {
    const { issues } = convertNorwayWellboreRowsToImportRows([makeWellboreRow({ 'Main area': '' })]);
    expect(issues.some((i) => i.severity === 'info' && /main area/i.test(i.message))).toBe(true);
  });

  it('emits warning for rows with no ID and no name', () => {
    const { issues } = convertNorwayWellboreRowsToImportRows(
      [makeWellboreRow({ 'NPDID wellbore': '', 'Wellbore name': '', 'Well name': '' })]
    );
    expect(issues.some((i) => i.severity === 'warning' && /blank/i.test(i.message))).toBe(true);
  });

  it('converts multiple rows', () => {
    const rows = [
      makeWellboreRow({ 'NPDID wellbore': '3008', 'Wellbore name': 'A-1' }),
      makeWellboreRow({ 'NPDID wellbore': '3009', 'Wellbore name': 'A-2', Content: 'DRY', Field: '', 'NPDID field': '', Discovery: '', 'NPDID discovery': '' }),
    ];
    const { rows: result } = convertNorwayWellboreRowsToImportRows(rows);
    expect(result).toHaveLength(2);
    expect(result[0].outcome_label).toBe('technical_discovery'); // GAS + discovery, no field
    expect(result[1].outcome_label).toBe('dry_hole');
  });
});

// ── Validation integration ────────────────────────────────────────────────────

describe('validation integration', () => {
  const ALL_HEADERS = [
    'prospect_id', 'prospect_name', 'basin', 'country', 'block', 'play_type',
    'latitude', 'longitude', 'source_score', 'migration_score', 'reservoir_score',
    'seal_score', 'trap_score', 'timing_score', 'gcos_expert', 'main_risk',
    'data_confidence', 'resource_estimate_mmboe', 'commercial_score', 'scoring_mode',
    'outcome_label', 'target_variable', 'hydrocarbon_present', 'geological_success',
    'commercial_success', 'result_confidence', 'data_source', 'is_synthetic',
  ];

  it('converted DRY row passes existing validateImportedDataset()', () => {
    const wellRow = makeWellboreRow({ Content: 'DRY', Field: '', 'NPDID field': '', Discovery: '', 'NPDID discovery': '' });
    const { rows } = convertNorwayWellboreRowsToImportRows([wellRow]);
    const { issues } = validateImportedDataset(ALL_HEADERS, rows);
    const criticals = issues.filter((i) => i.severity === 'critical');
    expect(criticals).toHaveLength(0);
  });

  it('converted commercial discovery row passes existing validateImportedDataset()', () => {
    const discMap = new Map([['4001', makeDiscoveryRow()]]);
    const wellRow = makeWellboreRow({ Content: 'GAS', Field: '', 'NPDID field': '' });
    const { rows } = convertNorwayWellboreRowsToImportRows([wellRow], { discoveryRows: [makeDiscoveryRow()] });
    const { issues } = validateImportedDataset(ALL_HEADERS, rows);
    const criticals = issues.filter((i) => i.severity === 'critical');
    expect(criticals).toHaveLength(0);
  });

  it('all default component scores are present and valid', () => {
    const { rows } = convertNorwayWellboreRowsToImportRows([makeWellboreRow()]);
    for (const col of ['source_score', 'migration_score', 'reservoir_score', 'seal_score', 'trap_score', 'timing_score']) {
      const v = parseFloat(rows[0][col]);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('gcos_expert default is a valid score in [0,1]', () => {
    const { rows } = convertNorwayWellboreRowsToImportRows([makeWellboreRow()]);
    const v = parseFloat(rows[0].gcos_expert);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  });
});
