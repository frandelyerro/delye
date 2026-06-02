// ── Types ─────────────────────────────────────────────────────────────────────

export type TargetImportColumn =
  | 'prospect_id' | 'prospect_name' | 'basin' | 'country' | 'play_type'
  | 'latitude' | 'longitude'
  | 'source_score' | 'migration_score' | 'reservoir_score' | 'seal_score' | 'trap_score' | 'timing_score'
  | 'gcos_expert' | 'main_risk' | 'data_confidence' | 'resource_estimate_mmboe' | 'commercial_score'
  | 'scoring_mode' | 'outcome_label' | 'target_variable'
  | 'hydrocarbon_present' | 'geological_success' | 'commercial_success'
  | 'result_confidence' | 'data_source' | 'is_synthetic';

export type ColumnMapping = Partial<Record<TargetImportColumn, string>>;

export type ColumnMappingSuggestion = {
  targetColumn: TargetImportColumn;
  sourceColumn: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
};

export type MappedDatasetResult = {
  headers: string[];
  rows: Record<string, string>[];
  mapping: ColumnMapping;
  issues: {
    severity: 'info' | 'warning' | 'critical';
    message: string;
    targetColumn?: TargetImportColumn;
    sourceColumn?: string;
  }[];
};

export type PresetMappingId = 'generic_well' | 'nsta_like' | 'nopims_like' | 'npd_like' | 'nlog_like';

export type PresetMapping = {
  id: PresetMappingId;
  name: string;
  description: string;
  disclaimer: string;
  mapping: ColumnMapping;
};

// ── Column alias table ────────────────────────────────────────────────────────

// Each entry: first alias = same as target (exact match → high), rest → medium/low in order
const COLUMN_ALIASES: Partial<Record<TargetImportColumn, string[]>> = {
  prospect_id:   ['prospect_id', 'prospectid', 'id', 'well_id', 'wellbore_id', 'borehole_id'],
  prospect_name: ['prospect_name', 'well_name', 'wellbore_name', 'borehole_name', 'name'],
  basin:         ['basin', 'basin_name', 'geological_basin'],
  country:       ['country', 'nation'],
  play_type:     ['play_type', 'play', 'petroleum_play', 'reservoir_play'],
  latitude:      ['latitude', 'lat', 'y', 'surface_latitude'],
  longitude:     ['longitude', 'lon', 'lng', 'x', 'surface_longitude'],
  outcome_label: ['outcome_label', 'result', 'well_result', 'exploration_result', 'final_status', 'discovery_status', 'hole_status'],
  data_source:   ['data_source', 'source', 'dataset_source', 'origin'],
  is_synthetic:  ['is_synthetic', 'synthetic', 'synthetic_flag'],
};

// Columns not in COLUMN_ALIASES: exact normalized name match only
const NOT_DEFAULTABLE: ReadonlySet<TargetImportColumn> = new Set([
  'prospect_id', 'prospect_name', 'basin', 'country', 'play_type',
  'latitude', 'longitude', 'outcome_label',
]);

const SCORE_COLUMNS: ReadonlySet<TargetImportColumn> = new Set([
  'source_score', 'migration_score', 'reservoir_score', 'seal_score', 'trap_score', 'timing_score',
]);

const PRESET_DISCLAIMER =
  'Best-effort only. Verify column names against the actual regulator dataset before importing.';

// ── Utilities ─────────────────────────────────────────────────────────────────

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .trim()
    .replace(/[\s\-/]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getRequiredTargetColumns(): TargetImportColumn[] {
  return [
    'prospect_id', 'prospect_name', 'basin', 'country', 'play_type',
    'latitude', 'longitude',
    'source_score', 'migration_score', 'reservoir_score', 'seal_score', 'trap_score', 'timing_score',
    'gcos_expert', 'main_risk', 'data_confidence', 'resource_estimate_mmboe', 'commercial_score',
    'scoring_mode', 'outcome_label', 'target_variable',
    'hydrocarbon_present', 'geological_success', 'commercial_success',
    'result_confidence', 'data_source', 'is_synthetic',
  ];
}

export function suggestColumnMappings(headers: string[]): ColumnMappingSuggestion[] {
  const normalizedHeaders = headers.map((h) => ({ original: h, normalized: normalizeHeader(h) }));
  const suggestions: ColumnMappingSuggestion[] = [];
  const allTargets = getRequiredTargetColumns();
  const usedSources = new Set<string>();

  for (const target of allTargets) {
    const aliases = COLUMN_ALIASES[target] ?? [target];

    for (let i = 0; i < aliases.length; i++) {
      const alias = aliases[i];
      const match = normalizedHeaders.find((h) => h.normalized === alias && !usedSources.has(h.original));
      if (match) {
        const confidence: 'high' | 'medium' | 'low' =
          i === 0 ? 'high' : i === 1 ? 'medium' : 'low';
        suggestions.push({
          targetColumn: target,
          sourceColumn: match.original,
          confidence,
          reason: i === 0
            ? `Exact name match: "${match.original}"`
            : `Alias match: "${match.original}" → "${target}"`,
        });
        usedSources.add(match.original);
        break;
      }
    }
  }

  return suggestions;
}

export function validateColumnMapping(mapping: ColumnMapping): {
  missingRequiredTargets: TargetImportColumn[];
  duplicateSourceColumns: string[];
  warnings: string[];
} {
  const required = getRequiredTargetColumns();
  const missingRequiredTargets = required.filter((t) => !mapping[t]);
  const sourceCounts = new Map<string, number>();
  for (const src of Object.values(mapping)) {
    if (src) sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1);
  }
  const duplicateSourceColumns = [...sourceCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([src]) => src);

  const warnings: string[] = [];
  const hasAnyScore = [...SCORE_COLUMNS].some((col) => mapping[col]);
  if (!hasAnyScore) {
    warnings.push('No component scores mapped — they will be defaulted to 0.5, which is weak and development-only.');
  }
  if (!mapping.outcome_label) {
    warnings.push('outcome_label is not mapped — outcome normalization will not apply and rows may import as unknown.');
  }

  return { missingRequiredTargets, duplicateSourceColumns, warnings };
}

export function normalizeExternalValue(targetColumn: TargetImportColumn, value: string): string {
  const v = value.trim().toLowerCase();

  if (targetColumn === 'outcome_label') {
    if (['dry', 'dry hole', 'dry_hole', 'plugged and abandoned', 'p&a dry', 'abandoned dry'].includes(v)) return 'dry_hole';
    if (['commercial discovery', 'producing discovery', 'field discovery', 'discovery commercial', 'producer', 'producing'].includes(v)) return 'commercial_discovery';
    if (['discovery', 'hydrocarbon discovery', 'oil discovery', 'gas discovery', 'discovery non-producing', 'discovery undeveloped'].includes(v)) return 'technical_discovery';
    if (['non commercial', 'non-commercial', 'subcommercial', 'uneconomic discovery', 'non-commercial discovery'].includes(v)) return 'non_commercial';
    // unknown / blank / anything unrecognized
    return 'unknown';
  }

  if (targetColumn === 'hydrocarbon_present' || targetColumn === 'geological_success' || targetColumn === 'commercial_success') {
    if (['yes', 'y', 'true', '1'].includes(v)) return 'true';
    if (['no', 'n', 'false', '0'].includes(v)) return 'false';
    return 'unknown';
  }

  if (targetColumn === 'is_synthetic') {
    if (['yes', 'y', 'true', '1', 'synthetic'].includes(v)) return 'true';
    return 'false';
  }

  if (targetColumn === 'scoring_mode') {
    if (['evidence', 'evidence-derived', 'evidence_derived', 'derived'].includes(v)) return 'evidence_derived';
    return 'manual';
  }

  if (targetColumn === 'result_confidence') {
    if (['high', 'confirmed', 'final'].includes(v)) return 'high';
    if (['medium', 'probable', 'interpreted'].includes(v)) return 'medium';
    return 'low';
  }

  return value;
}

// Derive boolean columns from outcome_label
function deriveBooleans(outcomeLabel: string): Record<string, string> {
  switch (outcomeLabel) {
    case 'commercial_discovery':
      return { hydrocarbon_present: 'true', geological_success: 'true', commercial_success: 'true' };
    case 'technical_discovery':
      return { hydrocarbon_present: 'true', geological_success: 'true', commercial_success: 'false' };
    case 'dry_hole':
      return { hydrocarbon_present: 'false', geological_success: 'false', commercial_success: 'false' };
    case 'non_commercial':
      return { hydrocarbon_present: 'true', geological_success: 'false', commercial_success: 'false' };
    default:
      return { hydrocarbon_present: 'unknown', geological_success: 'unknown', commercial_success: 'unknown' };
  }
}

export function applyColumnMapping(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
): MappedDatasetResult {
  const issues: MappedDatasetResult['issues'] = [];

  // Determine which score columns are mapped
  const hasAnyScore = [...SCORE_COLUMNS].some((col) => mapping[col]);

  // Defaults for non-critical columns
  const defaults: Partial<Record<TargetImportColumn, string>> = {
    scoring_mode: 'manual',
    target_variable: 'geological_success',
    result_confidence: 'medium',
    data_source: 'manual_entry',
    is_synthetic: 'false',
    commercial_score: '50',
    resource_estimate_mmboe: '0',
  };

  if (!hasAnyScore) {
    // Default all 6 component scores + gcos_expert
    const scoreDefaults: TargetImportColumn[] = [
      'source_score', 'migration_score', 'reservoir_score',
      'seal_score', 'trap_score', 'timing_score', 'gcos_expert',
    ];
    for (const col of scoreDefaults) defaults[col] = col === 'gcos_expert' ? '0.35' : '0.5';
    defaults.main_risk = 'source';
    issues.push({
      severity: 'warning',
      message: 'Component scores were defaulted because source dataset did not include geoscience risking. Results are development-only until real scores are provided.',
    });
    issues.push({
      severity: 'info',
      message: 'main_risk defaulted to "source" because component scores were all defaulted.',
    });
  }

  // Emit info for each applied default
  const allTargets = getRequiredTargetColumns();
  for (const target of allTargets) {
    if (!mapping[target] && defaults[target] !== undefined && !NOT_DEFAULTABLE.has(target)) {
      if (!SCORE_COLUMNS.has(target) && target !== 'gcos_expert' && target !== 'main_risk') {
        issues.push({
          severity: 'info',
          message: `"${target}" not mapped — defaulted to "${defaults[target]}".`,
          targetColumn: target,
        });
      }
    }
  }

  // Build the mapped rows
  const mappedRows = rows.map((row) => {
    const out: Record<string, string> = {};

    // Map explicitly mapped columns (normalize values)
    for (const [target, sourceCol] of Object.entries(mapping) as [TargetImportColumn, string][]) {
      if (sourceCol && sourceCol in row) {
        out[target] = normalizeExternalValue(target, row[sourceCol] ?? '');
      }
    }

    // Apply defaults for unmapped columns
    for (const target of allTargets) {
      if (!(target in out)) {
        if (defaults[target] !== undefined) {
          out[target] = defaults[target]!;
        }
      }
    }

    // Derive boolean columns from outcome_label if not already set
    if ('outcome_label' in out) {
      const booleans = deriveBooleans(out.outcome_label);
      for (const [key, val] of Object.entries(booleans)) {
        if (!(key in out)) out[key] = val;
      }
    }

    // data_confidence: use a smarter default based on how many required fields are mapped
    if (!mapping.data_confidence) {
      const mappedCount = allTargets.filter((t) => mapping[t]).length;
      out.data_confidence = mappedCount >= 5 ? '50' : '30';
    }

    // block: required by validateImportedDataset but not in TargetImportColumn — default empty string
    if (!('block' in out)) out.block = '';

    return out;
  });

  // Collect the output headers (all target columns)
  const headers = allTargets;

  return { headers, rows: mappedRows, mapping, issues };
}

// ── Preset mappings ───────────────────────────────────────────────────────────

export const PRESET_MAPPINGS: PresetMapping[] = [
  {
    id: 'generic_well',
    name: 'Generic Well Dataset',
    description: 'Common column names found in generic petroleum well registries.',
    disclaimer: PRESET_DISCLAIMER,
    mapping: {
      prospect_id: 'well_id',
      prospect_name: 'well_name',
      basin: 'basin_name',
      country: 'country',
      latitude: 'latitude',
      longitude: 'longitude',
      outcome_label: 'result',
      data_source: 'data_source',
      is_synthetic: 'is_synthetic',
    },
  },
  {
    id: 'nsta_like',
    name: 'NSTA-like (North Sea)',
    description: 'Best-effort mapping for North Sea-style well datasets (UK NSTA).',
    disclaimer: PRESET_DISCLAIMER,
    mapping: {
      prospect_id: 'wellbore_name',
      prospect_name: 'well_name',
      basin: 'basin_name',
      country: 'country',
      latitude: 'surface_latitude',
      longitude: 'surface_longitude',
      outcome_label: 'well_result',
    },
  },
  {
    id: 'nopims_like',
    name: 'NOPIMS-like (Australia)',
    description: 'Best-effort mapping for Australian NOPIMS-style well datasets.',
    disclaimer: PRESET_DISCLAIMER,
    mapping: {
      prospect_id: 'wellbore_id',
      prospect_name: 'well_name',
      basin: 'basin_name',
      country: 'country',
      latitude: 'lat',
      longitude: 'lon',
      outcome_label: 'exploration_result',
    },
  },
  {
    id: 'npd_like',
    name: 'NPD-like (Norway)',
    description: 'Best-effort mapping for Norwegian Petroleum Directorate (Sokkeldirektoratet) datasets.',
    disclaimer: PRESET_DISCLAIMER,
    mapping: {
      prospect_id: 'wlbwellborename',
      prospect_name: 'wlbwellborename',
      basin: 'wlbdiscoveryname',
      country: 'country',
      latitude: 'wlbnsutmdeg',
      longitude: 'wlewutmdeg',
      outcome_label: 'wlbdisconame',
    },
  },
  {
    id: 'nlog_like',
    name: 'NLOG-like (Netherlands)',
    description: 'Best-effort mapping for Dutch NLOG well datasets.',
    disclaimer: PRESET_DISCLAIMER,
    mapping: {
      prospect_id: 'well_id',
      prospect_name: 'well_name',
      basin: 'basin',
      country: 'country',
      latitude: 'y_coord',
      longitude: 'x_coord',
      outcome_label: 'status',
    },
  },
];
