import Papa from 'papaparse';
import type { Prospect } from './prospect';
import type { OutcomeLabel, TargetVariable } from './mlTypes';
import type { ProspectOutcome } from './outcomes';
import type { ScoringMode } from './evidence';
import type { MainRisk } from './prospect';
import { scoreProspect } from './scoring';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ImportedDatasetRow = Record<string, string>;

export type DatasetImportIssue = {
  rowIndex?: number;
  column?: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
};

export type DatasetReadinessResult = {
  totalRows: number;
  validRows: number;
  criticalIssues: number;
  warnings: number;
  labeledRows: number;
  syntheticRows: number;
  dryHoleCount: number;
  discoveryCount: number;
  readinessScore: number;
  canImport: boolean;
};

export type DatasetImportPreview = {
  headers: string[];
  rows: ImportedDatasetRow[];
  rowCount: number;
  issues: DatasetImportIssue[];
  readiness: DatasetReadinessResult;
};

export type DatasetColumnMapping = {
  prospectId?: string;
  prospectName?: string;
  basin?: string;
  country?: string;
  block?: string;
  playType?: string;
  latitude?: string;
  longitude?: string;
  sourceScore?: string;
  migrationScore?: string;
  reservoirScore?: string;
  sealScore?: string;
  trapScore?: string;
  timingScore?: string;
  gcosExpert?: string;
  mainRisk?: string;
  dataConfidence?: string;
  resourceEstimate?: string;
  commercialScore?: string;
  outcomeLabel?: string;
  targetVariable?: string;
  hydrocarbonPresent?: string;
  geologicalSuccess?: string;
  commercialSuccess?: string;
  resultConfidence?: string;
  dataSource?: string;
  isSynthetic?: string;
};

// ── Column lists ──────────────────────────────────────────────────────────────

export const REQUIRED_COLUMNS = [
  'prospect_id', 'prospect_name', 'basin', 'country', 'block', 'play_type',
  'latitude', 'longitude',
  'source_score', 'migration_score', 'reservoir_score', 'seal_score', 'trap_score', 'timing_score',
  'gcos_expert', 'main_risk', 'data_confidence', 'resource_estimate_mmboe', 'commercial_score',
  'scoring_mode',
  'outcome_label', 'target_variable',
  'hydrocarbon_present', 'geological_success', 'commercial_success',
  'result_confidence', 'data_source', 'is_synthetic',
] as const;

export const OPTIONAL_GEOLOGY_COLUMNS = [
  'toc_percent', 'ro_percent', 'tmax_c', 'porosity_percent', 'permeability_md',
  'seal_thickness_m', 'closure_area_km2',
] as const;

export const POST_DRILL_LEAKAGE_COLUMNS = [
  'actual_net_pay_m', 'actual_porosity_percent', 'actual_permeability_md',
  'actual_initial_rate_bopd', 'actual_reserves_mmboe',
  'actual_recoverable_resource_mmboe', 'actual_development_status',
] as const;

const VALID_MAIN_RISKS: MainRisk[] = ['source', 'migration', 'reservoir', 'seal', 'trap', 'timing'];
const VALID_OUTCOME_LABELS: OutcomeLabel[] = [
  'commercial_discovery', 'technical_discovery', 'dry_hole', 'non_commercial', 'unknown',
];
const VALID_TARGET_VARIABLES: TargetVariable[] = [
  'geological_success', 'commercial_success', 'hydrocarbon_presence',
];
const VALID_RESULT_CONFIDENCES = ['high', 'medium', 'low'] as const;
const VALID_BOOLEANS = ['true', 'false', 'unknown'] as const;

// ── CSV parsing ───────────────────────────────────────────────────────────────

export const parseCsvText = (csvText: string): {
  headers: string[];
  rows: ImportedDatasetRow[];
  issues: DatasetImportIssue[];
} => {
  const issues: DatasetImportIssue[] = [];

  if (!csvText.trim()) {
    return {
      headers: [],
      rows: [],
      issues: [{ severity: 'critical', message: 'File is empty.' }],
    };
  }

  // Detect duplicate headers from the raw first line before PapaParse renames them.
  const rawHeaderLine = csvText.trimStart().split('\n')[0] ?? '';
  const rawHeaders = rawHeaderLine.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const seenRaw = new Set<string>();
  for (const h of rawHeaders) {
    if (seenRaw.has(h)) {
      issues.push({ severity: 'warning', column: h, message: `Duplicate column header "${h}".` });
    }
    seenRaw.add(h);
  }

  const result = Papa.parse<ImportedDatasetRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const headers: string[] = result.meta.fields ?? [];

  if (!headers.length) {
    return {
      headers: [],
      rows: [],
      issues: [{ severity: 'critical', message: 'No column headers found in CSV.' }],
    };
  }

  for (const err of result.errors) {
    issues.push({
      severity: 'warning',
      message: `CSV parse warning at row ${err.row ?? 'unknown'}: ${err.message}`,
    });
  }

  return { headers, rows: result.data, issues };
};

// ── Validation helpers ────────────────────────────────────────────────────────

const parseNum = (val: string | undefined): number | null => {
  if (val === undefined || val.trim() === '') return null;
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : null;
};

const computeReadiness = (
  rows: ImportedDatasetRow[],
  issues: DatasetImportIssue[]
): DatasetReadinessResult => {
  const hasGlobalCritical = issues.some((i) => i.severity === 'critical' && i.rowIndex === undefined);
  const criticalPerRow = new Set(
    issues.filter((i) => i.severity === 'critical' && i.rowIndex !== undefined).map((i) => i.rowIndex!)
  );

  const totalRows = rows.length;
  const validRows = hasGlobalCritical ? 0 : rows.filter((_, i) => !criticalPerRow.has(i)).length;
  const criticalIssues = issues.filter((i) => i.severity === 'critical').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;

  const labeledRows = rows.filter((r) => {
    const l = r['outcome_label']?.trim().toLowerCase();
    return l && l !== 'unknown' && VALID_OUTCOME_LABELS.includes(l as OutcomeLabel);
  }).length;

  const syntheticRows = rows.filter(
    (r) => r['is_synthetic']?.trim().toLowerCase() === 'true'
  ).length;

  const dryHoleCount = rows.filter(
    (r) => r['outcome_label']?.trim().toLowerCase() === 'dry_hole'
  ).length;

  const discoveryCount = rows.filter((r) => {
    const l = r['outcome_label']?.trim().toLowerCase();
    return l === 'commercial_discovery' || l === 'technical_discovery';
  }).length;

  const readinessScore =
    totalRows === 0
      ? 0
      : Math.min(
          100,
          Math.round(
            (validRows / Math.max(totalRows, 1)) * 40 +
              Math.min(labeledRows / 100, 1) * 30 +
              (dryHoleCount > 0 ? 15 : 0) +
              (discoveryCount > 0 ? 15 : 0)
          )
        );

  return {
    totalRows,
    validRows,
    criticalIssues,
    warnings,
    labeledRows,
    syntheticRows,
    dryHoleCount,
    discoveryCount,
    readinessScore,
    canImport: validRows > 0,
  };
};

// ── Dataset validation ────────────────────────────────────────────────────────

export const validateImportedDataset = (
  headers: string[],
  rows: ImportedDatasetRow[]
): DatasetImportPreview => {
  const issues: DatasetImportIssue[] = [];

  // Global: missing required columns
  const missingCols = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  for (const col of missingCols) {
    issues.push({
      severity: 'critical',
      column: col,
      message: `Missing required column: "${col}".`,
    });
  }

  // Global: post-drill leakage
  const leakageCols = POST_DRILL_LEAKAGE_COLUMNS.filter((c) => headers.includes(c));
  if (leakageCols.length > 0) {
    issues.push({
      severity: 'warning',
      message: `Post-drill leakage columns detected: ${leakageCols.join(', ')}. These fields are only available after drilling and must NOT be used as predictive ML inputs. Remove them before training.`,
    });
  }

  // Skip row-level validation if critical schema issues exist
  if (missingCols.length === 0) {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const ri = i + 1;

      // Coordinates
      const lat = parseNum(r['latitude']);
      if (lat === null || lat < -90 || lat > 90) {
        issues.push({ rowIndex: i, column: 'latitude', severity: 'critical', message: `Row ${ri}: latitude "${r['latitude']}" must be in [-90, 90].` });
      }
      const lon = parseNum(r['longitude']);
      if (lon === null || lon < -180 || lon > 180) {
        issues.push({ rowIndex: i, column: 'longitude', severity: 'critical', message: `Row ${ri}: longitude "${r['longitude']}" must be in [-180, 180].` });
      }

      // Score columns [0, 1]
      for (const col of ['source_score', 'migration_score', 'reservoir_score', 'seal_score', 'trap_score', 'timing_score', 'gcos_expert'] as const) {
        const n = parseNum(r[col]);
        if (n === null || n < 0 || n > 1) {
          issues.push({ rowIndex: i, column: col, severity: 'critical', message: `Row ${ri}: ${col} "${r[col]}" must be in [0, 1].` });
        }
      }

      // data_confidence [0, 100]
      const dc = parseNum(r['data_confidence']);
      if (dc === null || dc < 0 || dc > 100) {
        issues.push({ rowIndex: i, column: 'data_confidence', severity: 'critical', message: `Row ${ri}: data_confidence "${r['data_confidence']}" must be in [0, 100].` });
      }

      // commercial_score [0, 100]
      const cs = parseNum(r['commercial_score']);
      if (cs === null || cs < 0 || cs > 100) {
        issues.push({ rowIndex: i, column: 'commercial_score', severity: 'critical', message: `Row ${ri}: commercial_score "${r['commercial_score']}" must be in [0, 100].` });
      }

      // resource >= 0
      const res = parseNum(r['resource_estimate_mmboe']);
      if (res === null || res < 0) {
        issues.push({ rowIndex: i, column: 'resource_estimate_mmboe', severity: 'critical', message: `Row ${ri}: resource_estimate_mmboe "${r['resource_estimate_mmboe']}" must be >= 0.` });
      }

      // main_risk
      const mainRisk = r['main_risk']?.trim().toLowerCase();
      if (!VALID_MAIN_RISKS.includes(mainRisk as MainRisk)) {
        issues.push({ rowIndex: i, column: 'main_risk', severity: 'critical', message: `Row ${ri}: main_risk "${r['main_risk']}" must be one of: ${VALID_MAIN_RISKS.join(', ')}.` });
      }

      // outcome_label
      const outcomeLabel = r['outcome_label']?.trim().toLowerCase();
      if (!VALID_OUTCOME_LABELS.includes(outcomeLabel as OutcomeLabel)) {
        issues.push({ rowIndex: i, column: 'outcome_label', severity: 'critical', message: `Row ${ri}: outcome_label "${r['outcome_label']}" must be one of: ${VALID_OUTCOME_LABELS.join(', ')}.` });
      } else if (outcomeLabel === 'unknown') {
        issues.push({ rowIndex: i, column: 'outcome_label', severity: 'warning', message: `Row ${ri}: outcome_label is "unknown" — excluded from real labeled training set.` });
      }

      // target_variable
      const targetVar = r['target_variable']?.trim().toLowerCase();
      if (!VALID_TARGET_VARIABLES.includes(targetVar as TargetVariable)) {
        issues.push({ rowIndex: i, column: 'target_variable', severity: 'critical', message: `Row ${ri}: target_variable "${r['target_variable']}" must be one of: ${VALID_TARGET_VARIABLES.join(', ')}.` });
      }

      // result_confidence
      const rc = r['result_confidence']?.trim().toLowerCase();
      if (rc && !VALID_RESULT_CONFIDENCES.includes(rc as typeof VALID_RESULT_CONFIDENCES[number])) {
        issues.push({ rowIndex: i, column: 'result_confidence', severity: 'warning', message: `Row ${ri}: result_confidence "${r['result_confidence']}" should be high, medium, or low.` });
      }

      // boolean columns
      for (const col of ['hydrocarbon_present', 'geological_success', 'commercial_success']) {
        const val = r[col]?.trim().toLowerCase();
        if (val && !VALID_BOOLEANS.includes(val as typeof VALID_BOOLEANS[number])) {
          issues.push({ rowIndex: i, column: col, severity: 'warning', message: `Row ${ri}: ${col} "${r[col]}" should be true, false, or unknown.` });
        }
      }

      // is_synthetic
      if (r['is_synthetic']?.trim().toLowerCase() === 'true') {
        issues.push({ rowIndex: i, column: 'is_synthetic', severity: 'warning', message: `Row ${ri}: is_synthetic = true — synthetic rows are excluded from real training examples.` });
      }
    }

    // Dataset-level warnings
    const dryHoles = rows.filter((r) => r['outcome_label']?.trim().toLowerCase() === 'dry_hole').length;
    const discoveries = rows.filter((r) => {
      const l = r['outcome_label']?.trim().toLowerCase();
      return l === 'commercial_discovery' || l === 'technical_discovery';
    }).length;

    if (rows.length > 0 && dryHoles === 0) {
      issues.push({
        severity: 'warning',
        message: 'No dry holes found in dataset. A balanced training set requires both discoveries and dry holes to avoid class imbalance.',
      });
    }
    if (rows.length > 0 && discoveries > 0 && dryHoles === 0) {
      issues.push({
        severity: 'warning',
        message: 'Dataset contains only discovery labels with no dry holes — ML model will be biased towards optimism.',
      });
    }
  }

  const readiness = computeReadiness(rows, issues);
  return { headers, rows: rows.slice(0, 10), rowCount: rows.length, issues, readiness };
};

// ── Row → Prospect mapping ────────────────────────────────────────────────────

export const convertImportedRowToProspect = (row: ImportedDatasetRow): Prospect => {
  const id = row['prospect_id']?.trim() || `imp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const scoringMode: ScoringMode =
    row['scoring_mode']?.trim() === 'evidence_derived' ? 'evidence_derived' : 'manual';

  const rawLabel = row['outcome_label']?.trim().toLowerCase();
  const rawTarget = row['target_variable']?.trim().toLowerCase();
  const rawRc = row['result_confidence']?.trim().toLowerCase();
  const rawSource = row['data_source']?.trim().toLowerCase();
  const isSynthetic = row['is_synthetic']?.trim().toLowerCase() === 'true';

  const outcomeLabel =
    rawLabel && VALID_OUTCOME_LABELS.includes(rawLabel as OutcomeLabel)
      ? (rawLabel as OutcomeLabel)
      : undefined;

  const outcome: ProspectOutcome | undefined = outcomeLabel
    ? {
        label: outcomeLabel,
        targetVariable: VALID_TARGET_VARIABLES.includes(rawTarget as TargetVariable)
          ? (rawTarget as TargetVariable)
          : 'geological_success',
        resultConfidence: VALID_RESULT_CONFIDENCES.includes(rawRc as typeof VALID_RESULT_CONFIDENCES[number])
          ? (rawRc as ProspectOutcome['resultConfidence'])
          : 'medium',
        source: isSynthetic
          ? 'synthetic'
          : rawSource === 'manual'
          ? 'manual'
          : 'historical',
      }
    : undefined;

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const base: Prospect = {
    id,
    name: row['prospect_name']?.trim() || id,
    basin: row['basin']?.trim() || 'Unknown',
    block: row['block']?.trim() || '',
    playType: row['play_type']?.trim() || 'Unknown',
    latitude: parseNum(row['latitude']) ?? 0,
    longitude: parseNum(row['longitude']) ?? 0,
    sourceScore: clamp(parseNum(row['source_score']) ?? 0.5, 0, 1),
    migrationScore: clamp(parseNum(row['migration_score']) ?? 0.5, 0, 1),
    reservoirScore: clamp(parseNum(row['reservoir_score']) ?? 0.5, 0, 1),
    sealScore: clamp(parseNum(row['seal_score']) ?? 0.5, 0, 1),
    trapScore: clamp(parseNum(row['trap_score']) ?? 0.5, 0, 1),
    timingScore: clamp(parseNum(row['timing_score']) ?? 0.5, 0, 1),
    commercialScore: clamp(parseNum(row['commercial_score']) ?? 50, 0, 100),
    resourceEstimate: Math.max(0, parseNum(row['resource_estimate_mmboe']) ?? 0),
    scoringMode,
    ...(outcome ? { outcome } : {}),
  };

  return scoreProspect(base);
};

export const convertImportedRowsToProspects = (
  rows: ImportedDatasetRow[]
): { prospects: Prospect[]; issues: DatasetImportIssue[] } => {
  const prospects: Prospect[] = [];
  const issues: DatasetImportIssue[] = [];

  for (let i = 0; i < rows.length; i++) {
    try {
      prospects.push(convertImportedRowToProspect(rows[i]));
    } catch (e) {
      issues.push({
        rowIndex: i,
        severity: 'critical',
        message: `Row ${i + 1}: conversion failed — ${(e as Error).message}`,
      });
    }
  }

  return { prospects, issues };
};

// ── Template generation ───────────────────────────────────────────────────────

const EXAMPLE_ROW: ImportedDatasetRow = {
  prospect_id: 'WELL-001',
  prospect_name: 'Example Well 1',
  basin: 'Neuquén',
  country: 'Argentina',
  block: 'Block A',
  play_type: 'Structural',
  latitude: '-38.5',
  longitude: '-68.2',
  source_score: '0.70',
  migration_score: '0.65',
  reservoir_score: '0.60',
  seal_score: '0.55',
  trap_score: '0.80',
  timing_score: '0.75',
  gcos_expert: '0.10',
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
  toc_percent: '2.5',
  ro_percent: '0.8',
  tmax_c: '435',
  porosity_percent: '18',
  permeability_md: '12',
  seal_thickness_m: '45',
  closure_area_km2: '8',
};

const csvFromHeaders = (headers: readonly string[]): string => {
  const headerRow = headers.join(',');
  const dataRow = headers.map((h) => EXAMPLE_ROW[h] ?? '').join(',');
  return `${headerRow}\n${dataRow}\n`;
};

export const getMinimumTemplateContent = (): string =>
  csvFromHeaders(REQUIRED_COLUMNS);

export const getRecommendedTemplateContent = (): string =>
  csvFromHeaders([...REQUIRED_COLUMNS, ...OPTIONAL_GEOLOGY_COLUMNS]);
