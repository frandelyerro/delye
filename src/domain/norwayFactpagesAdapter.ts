// ── Types ─────────────────────────────────────────────────────────────────────

export type NorwayAdapterIssue = {
  severity: 'info' | 'warning' | 'critical';
  message: string;
  rowIndex?: number;
};

export type NorwayAdapterResult = {
  rows: Record<string, string>[];
  issues: NorwayAdapterIssue[];
};

export type NorwayFactpagesAdapterOptions = {
  discoveryRows?: Record<string, string>[];
  reserveRows?: Record<string, string>[];
  descriptionRows?: Record<string, string>[];
  fieldRows?: Record<string, string>[];
};

// ── Dataset detection ─────────────────────────────────────────────────────────

const hasHeaders = (headers: string[], required: string[]): boolean => {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  return required.every((r) => normalized.includes(r.trim().toLowerCase()));
};

export function isNorwayWellboreDataset(headers: string[]): boolean {
  return hasHeaders(headers, [
    'Wellbore name', 'Content', 'Main area',
    'NS decimal degrees', 'EW decimal degrees', 'NPDID wellbore',
  ]);
}

export function isNorwayDiscoveryDataset(headers: string[]): boolean {
  return hasHeaders(headers, [
    'Discovery name', 'Current activity status', 'HC type', 'NPDID discovery',
  ]);
}

export function isNorwayDiscoveryReservesDataset(headers: string[]): boolean {
  return hasHeaders(headers, [
    'Discovery name', 'Rec. oil eq. [mill OE]', 'NPDID discovery',
  ]);
}

export function isNorwayDiscoveryDescriptionDataset(headers: string[]): boolean {
  return hasHeaders(headers, ['Discovery name', 'Text', 'NPDID discovery']);
}

export function isNorwayFieldDataset(headers: string[]): boolean {
  return hasHeaders(headers, [
    'Field name', 'Current activity status', 'Hydrocarbon type', 'NPDID field',
  ]);
}

// ── Lookup builders ───────────────────────────────────────────────────────────

function getCol(row: Record<string, string>, name: string): string {
  // Case-insensitive column getter
  const key = Object.keys(row).find((k) => k.trim().toLowerCase() === name.trim().toLowerCase());
  return key ? (row[key] ?? '').trim() : '';
}

function parseNorwayNumber(val: string): number | null {
  if (!val.trim()) return null;
  // Accept comma or dot as decimal separator
  const normalized = val.replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(normalized);
  return isNaN(n) ? null : n;
}

export function buildDiscoveryLookup(
  rows: Record<string, string>[],
): Map<string, Record<string, string>> {
  const map = new Map<string, Record<string, string>>();
  for (const row of rows) {
    const id = getCol(row, 'NPDID discovery');
    if (id) map.set(id, row);
  }
  return map;
}

export function buildReserveLookup(
  rows: Record<string, string>[],
): Map<string, Record<string, string>> {
  // Per discovery, prefer Resource category "0+1", else largest Rec. oil eq. [mill OE]
  const candidates = new Map<string, Record<string, string>[]>();
  for (const row of rows) {
    const id = getCol(row, 'NPDID discovery');
    if (!id) continue;
    if (!candidates.has(id)) candidates.set(id, []);
    candidates.get(id)!.push(row);
  }
  const map = new Map<string, Record<string, string>>();
  for (const [id, group] of candidates) {
    const preferred = group.find((r) => getCol(r, 'Resource category').includes('0+1'));
    if (preferred) { map.set(id, preferred); continue; }
    // Pick row with largest Rec. oil eq. [mill OE]
    const sorted = group
      .map((r) => ({ row: r, oe: parseNorwayNumber(getCol(r, 'Rec. oil eq. [mill OE]')) }))
      .filter((x) => x.oe !== null)
      .sort((a, b) => b.oe! - a.oe!);
    if (sorted.length) { map.set(id, sorted[0].row); continue; }
    // Fall back to first non-empty
    const fallback = group.find((r) => getCol(r, 'Rec. oil eq. [mill OE]'));
    if (fallback) map.set(id, fallback);
  }
  return map;
}

export function buildDescriptionLookup(
  rows: Record<string, string>[],
): Map<string, Record<string, string>> {
  const map = new Map<string, Record<string, string>>();
  for (const row of rows) {
    const id = getCol(row, 'NPDID discovery');
    if (id && !map.has(id)) {
      const text = getCol(row, 'Text');
      if (text) map.set(id, row);
    }
  }
  return map;
}

export function buildFieldLookup(
  rows: Record<string, string>[],
): Map<string, Record<string, string>> {
  const map = new Map<string, Record<string, string>>();
  for (const row of rows) {
    const id = getCol(row, 'NPDID field');
    if (id) map.set(id, row);
  }
  return map;
}

// ── Outcome helpers ───────────────────────────────────────────────────────────

const HYDROCARBON_CONTENTS = new Set([
  'OIL', 'GAS', 'OIL/GAS', 'GAS/CONDENSATE', 'CONDENSATE',
  'OIL/GAS/CONDENSATE', 'OIL/CONDENSATE', 'GAS/OIL',
]);

const SHOW_CONTENTS = new Set([
  'OIL SHOWS', 'GAS SHOWS', 'OIL/GAS SHOWS', 'SHOWS', 'TRACES',
]);

type OutcomeFields = {
  outcome_label: string;
  hydrocarbon_present: string;
  geological_success: string;
  commercial_success: string;
  result_confidence: string;
};

function makeOutcome(
  label: string,
  hc: string,
  geo: string,
  comm: string,
  conf: string,
): OutcomeFields {
  return {
    outcome_label: label,
    hydrocarbon_present: hc,
    geological_success: geo,
    commercial_success: comm,
    result_confidence: conf,
  };
}

function deriveBaseOutcome(content: string, hasField: boolean, hasDiscovery: boolean): OutcomeFields {
  const c = content.trim().toUpperCase().replace(/\s+/g, ' ');

  if (c === 'DRY') return makeOutcome('dry_hole', 'false', 'false', 'false', 'high');

  if (HYDROCARBON_CONTENTS.has(c)) {
    if (hasField) return makeOutcome('commercial_discovery', 'true', 'true', 'true', 'high');
    if (hasDiscovery) return makeOutcome('technical_discovery', 'true', 'true', 'false', 'high');
    // Hydrocarbon but neither field nor discovery linked
    return makeOutcome('technical_discovery', 'true', 'true', 'false', 'medium');
  }

  if (SHOW_CONTENTS.has(c)) return makeOutcome('non_commercial', 'true', 'true', 'false', 'medium');

  return makeOutcome('unknown', 'unknown', 'unknown', 'unknown', 'low');
}

function applyDiscoveryEnrichment(
  base: OutcomeFields,
  discoveryRow: Record<string, string>,
): OutcomeFields {
  // Never override dry_hole
  if (base.outcome_label === 'dry_hole') return base;

  const status = getCol(discoveryRow, 'Current activity status').toLowerCase();
  const seeField = getCol(discoveryRow, 'For more information, see field');
  const npdidField = getCol(discoveryRow, 'NPDID field');

  const isCommercial =
    status.includes('producing') ||
    status.includes('shut down') ||
    status.includes('pdo approved') ||
    status.includes('included in field') ||
    status.includes('approved for development') ||
    seeField !== '' ||
    npdidField !== '';

  if (isCommercial) return makeOutcome('commercial_discovery', 'true', 'true', 'true', 'high');

  const isUnlikely = status.includes('production is unlikely');
  if (isUnlikely) return makeOutcome('non_commercial', 'true', 'false', 'false', 'medium');

  const isClarification =
    status.includes('clarification') || status.includes('evaluation');
  if (isClarification && base.hydrocarbon_present === 'true') {
    return makeOutcome('technical_discovery', 'true', 'true', 'false', 'medium');
  }

  return base;
}

function applyFieldEnrichment(
  base: OutcomeFields,
  _fieldRow: Record<string, string>,
): OutcomeFields {
  // Never override dry_hole
  if (base.outcome_label === 'dry_hole') return base;
  // Field presence confirms commercial
  return makeOutcome('commercial_discovery', 'true', 'true', 'true', 'high');
}

function commercialScore(
  outcomeLabel: string,
  resourceOE: number | null,
): string {
  const hasResource = resourceOE !== null && resourceOE > 0;
  switch (outcomeLabel) {
    case 'commercial_discovery': return hasResource ? '85' : '80';
    case 'technical_discovery':  return hasResource ? '65' : '60';
    case 'non_commercial':       return '45';
    case 'dry_hole':             return '25';
    default:                     return '50';
  }
}

// ── Row converter ─────────────────────────────────────────────────────────────

function normalizeId(name: string): string {
  return 'norway-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export function convertNorwayWellboreRowToImportRow(
  row: Record<string, string>,
  discoveryById?: Map<string, Record<string, string>>,
  reserveByDiscoveryId?: Map<string, Record<string, string>>,
  _descriptionByDiscoveryId?: Map<string, Record<string, string>>,
  fieldById?: Map<string, Record<string, string>>,
): Record<string, string> {
  const wName = getCol(row, 'Wellbore name') || getCol(row, 'Well name');
  const npdidWellbore = getCol(row, 'NPDID wellbore');
  const npdidDiscovery = getCol(row, 'NPDID discovery');
  const npdidField = getCol(row, 'NPDID field');
  const mainArea = getCol(row, 'Main area');
  const content = getCol(row, 'Content');
  const fieldName = getCol(row, 'Field');
  const discoveryName = getCol(row, 'Discovery');

  // IDs
  const prospectId = npdidWellbore || (wName ? normalizeId(wName) : '');
  const prospectName = wName || (npdidWellbore ? `Norway wellbore ${npdidWellbore}` : '');

  // Enrichment lookups
  const discoveryRow = (npdidDiscovery && discoveryById) ? discoveryById.get(npdidDiscovery) : undefined;
  // Field lookup: prefer NPDID field from wellbore row, then from discovery row
  const fieldId = npdidField || (discoveryRow ? getCol(discoveryRow, 'NPDID field') : '');
  const fieldRow = (fieldId && fieldById) ? fieldById.get(fieldId) : undefined;
  const reserveRow = (npdidDiscovery && reserveByDiscoveryId) ? reserveByDiscoveryId.get(npdidDiscovery) : undefined;

  // Outcome derivation
  const hasField = fieldName !== '' || fieldRow !== undefined || fieldId !== '';
  const hasDiscovery = discoveryName !== '' || discoveryRow !== undefined || npdidDiscovery !== '';

  let outcome = deriveBaseOutcome(content, hasField, hasDiscovery);

  // Discovery enrichment (must not override dry_hole)
  if (discoveryRow) outcome = applyDiscoveryEnrichment(outcome, discoveryRow);

  // Field enrichment (must not override dry_hole)
  if (fieldRow) outcome = applyFieldEnrichment(outcome, fieldRow);

  // Resource
  let resourceOE: number | null = null;
  if (reserveRow) {
    resourceOE = parseNorwayNumber(getCol(reserveRow, 'Rec. oil eq. [mill OE]'));
  }
  const resourceEstimate = resourceOE !== null ? String(resourceOE) : '0';

  return {
    prospect_id: prospectId,
    prospect_name: prospectName,
    basin: mainArea || 'Norwegian Continental Shelf',
    country: 'Norway',
    block: getCol(row, 'Production licence at wellhead'),
    play_type: getCol(row, 'Purpose') || 'Offshore exploration',
    latitude: getCol(row, 'NS decimal degrees'),
    longitude: getCol(row, 'EW decimal degrees'),
    source_score: '0.5',
    migration_score: '0.5',
    reservoir_score: '0.5',
    seal_score: '0.5',
    trap_score: '0.5',
    timing_score: '0.5',
    gcos_expert: '0.015625',
    main_risk: 'source',
    data_confidence: '50',
    resource_estimate_mmboe: resourceEstimate,
    commercial_score: commercialScore(outcome.outcome_label, resourceOE),
    scoring_mode: 'manual',
    ...outcome,
    target_variable: 'hydrocarbon_presence',
    result_confidence: outcome.result_confidence,
    data_source: 'Sokkeldirektoratet FactPages',
    is_synthetic: 'false',
  };
}

export function convertNorwayWellboreRowsToImportRows(
  wellboreRows: Record<string, string>[],
  options: NorwayFactpagesAdapterOptions = {},
): NorwayAdapterResult {
  const issues: NorwayAdapterIssue[] = [];

  // Build lookups from optional files
  const discoveryById = options.discoveryRows ? buildDiscoveryLookup(options.discoveryRows) : undefined;
  const reserveByDiscoveryId = options.reserveRows ? buildReserveLookup(options.reserveRows) : undefined;
  const descriptionByDiscoveryId = options.descriptionRows ? buildDescriptionLookup(options.descriptionRows) : undefined;
  const fieldById = options.fieldRows ? buildFieldLookup(options.fieldRows) : undefined;

  // Batch-level warnings
  issues.push({
    severity: 'warning',
    message:
      'Geoscience component scores were defaulted because the Norway FactPages wellbore export does not include pre-drill source/reservoir/seal/trap/timing risking.',
  });

  if (descriptionByDiscoveryId && descriptionByDiscoveryId.size > 0) {
    issues.push({
      severity: 'info',
      message:
        'Discovery descriptions were detected but not used for scoring in v1.',
    });
  }

  const rows: Record<string, string>[] = [];

  for (let i = 0; i < wellboreRows.length; i++) {
    const raw = wellboreRows[i];
    const npdidWellbore = getCol(raw, 'NPDID wellbore');
    const wName = getCol(raw, 'Wellbore name') || getCol(raw, 'Well name');
    const mainArea = getCol(raw, 'Main area');

    if (!npdidWellbore && !wName) {
      issues.push({
        severity: 'warning',
        rowIndex: i,
        message: `Row ${i + 1}: both NPDID wellbore and Wellbore name are blank — a fallback ID will be generated and may not be unique.`,
      });
    }

    if (!mainArea) {
      issues.push({
        severity: 'info',
        rowIndex: i,
        message: `Row ${i + 1}: Main area is blank — basin defaulted to "Norwegian Continental Shelf".`,
      });
    }

    const mapped = convertNorwayWellboreRowToImportRow(
      raw,
      discoveryById,
      reserveByDiscoveryId,
      descriptionByDiscoveryId,
      fieldById,
    );
    rows.push(mapped);
  }

  return { rows, issues };
}
