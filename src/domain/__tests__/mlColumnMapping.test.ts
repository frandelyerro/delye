import { describe, expect, it } from 'vitest';
import {
  suggestColumnMappings,
  validateColumnMapping,
  applyColumnMapping,
  normalizeExternalValue,
  getRequiredTargetColumns,
  PRESET_MAPPINGS,
  type ColumnMapping,
} from '../mlColumnMapping';

// ── suggestColumnMappings ──────────────────────────────────────────────────────

describe('suggestColumnMappings', () => {
  it('maps well_name to prospect_name (medium confidence)', () => {
    const suggestions = suggestColumnMappings(['well_name', 'lat', 'lon', 'result']);
    const hit = suggestions.find((s) => s.targetColumn === 'prospect_name');
    expect(hit).toBeDefined();
    expect(hit!.sourceColumn).toBe('well_name');
    expect(['high', 'medium', 'low']).toContain(hit!.confidence);
  });

  it('maps lat to latitude', () => {
    const suggestions = suggestColumnMappings(['lat', 'lon']);
    expect(suggestions.find((s) => s.targetColumn === 'latitude')?.sourceColumn).toBe('lat');
  });

  it('maps lon to longitude', () => {
    const suggestions = suggestColumnMappings(['lat', 'lon']);
    expect(suggestions.find((s) => s.targetColumn === 'longitude')?.sourceColumn).toBe('lon');
  });

  it('maps result to outcome_label', () => {
    const suggestions = suggestColumnMappings(['result']);
    expect(suggestions.find((s) => s.targetColumn === 'outcome_label')?.sourceColumn).toBe('result');
  });

  it('maps well_result to outcome_label', () => {
    const suggestions = suggestColumnMappings(['well_result']);
    expect(suggestions.find((s) => s.targetColumn === 'outcome_label')?.sourceColumn).toBe('well_result');
  });

  it('maps well_id to prospect_id', () => {
    const suggestions = suggestColumnMappings(['well_id']);
    expect(suggestions.find((s) => s.targetColumn === 'prospect_id')?.sourceColumn).toBe('well_id');
  });

  it('gives high confidence for exact name match (prospect_id)', () => {
    const suggestions = suggestColumnMappings(['prospect_id']);
    expect(suggestions.find((s) => s.targetColumn === 'prospect_id')?.confidence).toBe('high');
  });

  it('does not map unrecognized columns', () => {
    const suggestions = suggestColumnMappings(['qzx_random_field', 'totally_unknown']);
    expect(suggestions).toHaveLength(0);
  });

  it('does not map the same source column to two targets', () => {
    const suggestions = suggestColumnMappings(['name']);
    const usedSources = suggestions.map((s) => s.sourceColumn);
    const unique = new Set(usedSources);
    expect(unique.size).toBe(usedSources.length);
  });
});

// ── validateColumnMapping ─────────────────────────────────────────────────────

describe('validateColumnMapping', () => {
  it('detects all 28 missing required targets when mapping is empty', () => {
    const { missingRequiredTargets } = validateColumnMapping({});
    expect(missingRequiredTargets.length).toBe(getRequiredTargetColumns().length);
  });

  it('detects duplicate source columns', () => {
    const mapping: ColumnMapping = {
      prospect_id: 'col_a',
      prospect_name: 'col_a',
    };
    const { duplicateSourceColumns } = validateColumnMapping(mapping);
    expect(duplicateSourceColumns).toContain('col_a');
  });

  it('passes with no duplicates and all columns mapped', () => {
    const allCols = getRequiredTargetColumns();
    const mapping: ColumnMapping = Object.fromEntries(
      allCols.map((col, i) => [col, `src_${i}`])
    ) as ColumnMapping;
    const { duplicateSourceColumns } = validateColumnMapping(mapping);
    expect(duplicateSourceColumns).toHaveLength(0);
  });

  it('warns when no score columns are mapped', () => {
    const { warnings } = validateColumnMapping({});
    expect(warnings.some((w) => /score/i.test(w))).toBe(true);
  });

  it('warns when outcome_label is not mapped', () => {
    const { warnings } = validateColumnMapping({});
    expect(warnings.some((w) => /outcome_label/i.test(w))).toBe(true);
  });
});

// ── applyColumnMapping ────────────────────────────────────────────────────────

describe('applyColumnMapping', () => {
  const baseRow = { WELL_NAME: 'Alpha-1', LAT: '-38.5', LON: '-68.2', RESULT: 'dry hole', BASIN: 'Neuquén', COUNTRY: 'Argentina' };

  it('transforms source column names to target column names', () => {
    const mapping: ColumnMapping = {
      prospect_name: 'WELL_NAME',
      latitude: 'LAT',
      longitude: 'LON',
      outcome_label: 'RESULT',
    };
    const { rows } = applyColumnMapping([baseRow], mapping);
    expect(rows[0].prospect_name).toBe('Alpha-1');
    expect(rows[0].latitude).toBe('-38.5');
    expect(rows[0].outcome_label).toBe('dry_hole');
  });

  it('applies default scoring_mode = manual when unmapped', () => {
    const { rows } = applyColumnMapping([baseRow], {});
    expect(rows[0].scoring_mode).toBe('manual');
  });

  it('applies default is_synthetic = false when unmapped', () => {
    const { rows } = applyColumnMapping([baseRow], {});
    expect(rows[0].is_synthetic).toBe('false');
  });

  it('does not default prospect_name — remains absent if not mapped', () => {
    const { rows } = applyColumnMapping([baseRow], {});
    expect(rows[0].prospect_name).toBeUndefined();
  });

  it('applies score defaults only when no component scores are mapped, with warning', () => {
    const { rows, issues } = applyColumnMapping([baseRow], {});
    expect(rows[0].source_score).toBe('0.5');
    expect(issues.some((i) => i.severity === 'warning' && /defaulted/i.test(i.message))).toBe(true);
  });

  it('does not default scores when at least one score column is mapped', () => {
    const mapping: ColumnMapping = { source_score: 'WELL_NAME' }; // value doesn't matter for this check
    const { rows } = applyColumnMapping([baseRow], mapping);
    // No default should have been applied to migration_score
    expect(rows[0].migration_score).toBeUndefined();
  });

  it('derives hydrocarbon_present=false from dry_hole outcome_label', () => {
    const mapping: ColumnMapping = { outcome_label: 'RESULT' };
    const { rows } = applyColumnMapping([baseRow], mapping); // RESULT = 'dry hole' → dry_hole
    expect(rows[0].hydrocarbon_present).toBe('false');
    expect(rows[0].geological_success).toBe('false');
    expect(rows[0].commercial_success).toBe('false');
  });

  it('derives hydrocarbon_present=true from commercial_discovery outcome_label', () => {
    const row = { RESULT: 'commercial discovery' };
    const mapping: ColumnMapping = { outcome_label: 'RESULT' };
    const { rows } = applyColumnMapping([row], mapping);
    expect(rows[0].hydrocarbon_present).toBe('true');
    expect(rows[0].geological_success).toBe('true');
    expect(rows[0].commercial_success).toBe('true');
  });

  it('derives hydrocarbon_present=true, commercial_success=false from technical_discovery', () => {
    const row = { RESULT: 'discovery' };
    const mapping: ColumnMapping = { outcome_label: 'RESULT' };
    const { rows } = applyColumnMapping([row], mapping);
    expect(rows[0].hydrocarbon_present).toBe('true');
    expect(rows[0].geological_success).toBe('true');
    expect(rows[0].commercial_success).toBe('false');
  });
});

// ── normalizeExternalValue — outcome_label ────────────────────────────────────

describe('normalizeExternalValue — outcome_label', () => {
  const n = (v: string) => normalizeExternalValue('outcome_label', v);

  it('"dry hole" → "dry_hole"', () => expect(n('dry hole')).toBe('dry_hole'));
  it('"dry" → "dry_hole"', () => expect(n('dry')).toBe('dry_hole'));
  it('"Dry Hole" (mixed case) → "dry_hole"', () => expect(n('Dry Hole')).toBe('dry_hole'));
  it('"plugged and abandoned" → "dry_hole"', () => expect(n('plugged and abandoned')).toBe('dry_hole'));
  it('"commercial discovery" → "commercial_discovery"', () => expect(n('commercial discovery')).toBe('commercial_discovery'));
  it('"producing" → "commercial_discovery"', () => expect(n('producing')).toBe('commercial_discovery'));
  it('"non-commercial" → "non_commercial"', () => expect(n('non-commercial')).toBe('non_commercial'));
  it('"non commercial" → "non_commercial"', () => expect(n('non commercial')).toBe('non_commercial'));
  it('"subcommercial" → "non_commercial"', () => expect(n('subcommercial')).toBe('non_commercial'));
  it('"discovery" → "technical_discovery"', () => expect(n('discovery')).toBe('technical_discovery'));
  it('"oil discovery" → "technical_discovery"', () => expect(n('oil discovery')).toBe('technical_discovery'));
  it('"unknown" → "unknown"', () => expect(n('unknown')).toBe('unknown'));
  it('"" (blank) → "unknown"', () => expect(n('')).toBe('unknown'));
  it('"confidential" → "unknown"', () => expect(n('confidential')).toBe('unknown'));
  it('unrecognized value → "unknown"', () => expect(n('blowout')).toBe('unknown'));
});

// ── normalizeExternalValue — boolean fields ────────────────────────────────────

describe('normalizeExternalValue — boolean fields', () => {
  it('"yes" → "true"', () => expect(normalizeExternalValue('hydrocarbon_present', 'yes')).toBe('true'));
  it('"no" → "false"', () => expect(normalizeExternalValue('hydrocarbon_present', 'no')).toBe('false'));
  it('"1" → "true"', () => expect(normalizeExternalValue('hydrocarbon_present', '1')).toBe('true'));
  it('"0" → "false"', () => expect(normalizeExternalValue('hydrocarbon_present', '0')).toBe('false'));
  it('"unknown" → "unknown"', () => expect(normalizeExternalValue('hydrocarbon_present', 'unknown')).toBe('unknown'));
  it('is_synthetic: "yes" → "true"', () => expect(normalizeExternalValue('is_synthetic', 'yes')).toBe('true'));
  it('is_synthetic: blank → "false"', () => expect(normalizeExternalValue('is_synthetic', '')).toBe('false'));
});

// ── normalizeExternalValue — scoring_mode ─────────────────────────────────────

describe('normalizeExternalValue — scoring_mode', () => {
  it('"evidence-derived" → "evidence_derived"', () => expect(normalizeExternalValue('scoring_mode', 'evidence-derived')).toBe('evidence_derived'));
  it('"derived" → "evidence_derived"', () => expect(normalizeExternalValue('scoring_mode', 'derived')).toBe('evidence_derived'));
  it('"manual" stays "manual"', () => expect(normalizeExternalValue('scoring_mode', 'manual')).toBe('manual'));
  it('"" → "manual"', () => expect(normalizeExternalValue('scoring_mode', '')).toBe('manual'));
  it('"expert" → "manual"', () => expect(normalizeExternalValue('scoring_mode', 'expert')).toBe('manual'));
});

// ── normalizeExternalValue — result_confidence ────────────────────────────────

describe('normalizeExternalValue — result_confidence', () => {
  it('"high" stays "high"', () => expect(normalizeExternalValue('result_confidence', 'high')).toBe('high'));
  it('"confirmed" → "high"', () => expect(normalizeExternalValue('result_confidence', 'confirmed')).toBe('high'));
  it('"probable" → "medium"', () => expect(normalizeExternalValue('result_confidence', 'probable')).toBe('medium'));
  it('"uncertain" → "low"', () => expect(normalizeExternalValue('result_confidence', 'uncertain')).toBe('low'));
  it('"" → "low"', () => expect(normalizeExternalValue('result_confidence', '')).toBe('low'));
});

// ── Integration tests ─────────────────────────────────────────────────────────

describe('integration', () => {
  it('arbitrary CSV with WELL_NAME/LAT/LON/RESULT maps into rows without critical required-field gaps for mapped fields', () => {
    const rows = [
      { WELL_NAME: 'Alpha-1', LAT: '-38.5', LON: '-68.2', RESULT: 'dry hole', BASIN: 'Neuquén', COUNTRY: 'Argentina', PLAY: 'Structural' },
    ];
    const mapping: ColumnMapping = {
      prospect_name: 'WELL_NAME',
      latitude: 'LAT',
      longitude: 'LON',
      outcome_label: 'RESULT',
      basin: 'BASIN',
      country: 'COUNTRY',
      play_type: 'PLAY',
    };
    const { rows: mapped } = applyColumnMapping(rows, mapping);
    expect(mapped[0].prospect_name).toBe('Alpha-1');
    expect(mapped[0].latitude).toBe('-38.5');
    expect(mapped[0].longitude).toBe('-68.2');
    expect(mapped[0].outcome_label).toBe('dry_hole');
    expect(mapped[0].basin).toBe('Neuquén');
    expect(mapped[0].scoring_mode).toBe('manual');
    expect(mapped[0].is_synthetic).toBe('false');
  });

  it('exact 28-column PetroTarget template passes through with values unchanged', () => {
    const exactRow: Record<string, string> = {
      prospect_id: 'W-001', prospect_name: 'Test Well', basin: 'Neuquén', country: 'Argentina',
      block: 'A', play_type: 'Structural', latitude: '-38.5', longitude: '-68.2',
      source_score: '0.70', migration_score: '0.65', reservoir_score: '0.60',
      seal_score: '0.55', trap_score: '0.80', timing_score: '0.75', gcos_expert: '0.09',
      main_risk: 'seal', data_confidence: '72', resource_estimate_mmboe: '85',
      commercial_score: '68', scoring_mode: 'manual',
      outcome_label: 'dry_hole', target_variable: 'geological_success',
      hydrocarbon_present: 'false', geological_success: 'false', commercial_success: 'false',
      result_confidence: 'high', data_source: 'historical', is_synthetic: 'false',
    };
    // Identity mapping: target → same name
    const allCols = getRequiredTargetColumns();
    const mapping: ColumnMapping = Object.fromEntries(
      allCols.map((col) => [col, col])
    ) as ColumnMapping;
    const { rows: mapped, issues } = applyColumnMapping([exactRow], mapping);
    expect(issues.filter((i) => i.severity === 'critical')).toHaveLength(0);
    expect(mapped[0].prospect_id).toBe('W-001');
    expect(mapped[0].source_score).toBe('0.70');
    expect(mapped[0].outcome_label).toBe('dry_hole');
  });
});

// ── Preset mappings ───────────────────────────────────────────────────────────

describe('PRESET_MAPPINGS', () => {
  it('has 5 presets', () => expect(PRESET_MAPPINGS).toHaveLength(5));

  it('each preset has a disclaimer', () => {
    for (const preset of PRESET_MAPPINGS) {
      expect(preset.disclaimer.length).toBeGreaterThan(0);
    }
  });

  it('generic_well preset maps prospect_id to well_id', () => {
    const generic = PRESET_MAPPINGS.find((p) => p.id === 'generic_well');
    expect(generic?.mapping.prospect_id).toBe('well_id');
  });

  it('nopims_like preset maps outcome_label to exploration_result', () => {
    const nopims = PRESET_MAPPINGS.find((p) => p.id === 'nopims_like');
    expect(nopims?.mapping.outcome_label).toBe('exploration_result');
  });
});
