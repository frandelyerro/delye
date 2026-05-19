import Papa from 'papaparse';
import { Prospect, ProspectInput, validateProspect } from '../domain/prospect';

const requiredColumns: (keyof ProspectInput)[] = [
  'name', 'basin', 'block', 'playType', 'latitude', 'longitude', 'sourceScore', 'migrationScore', 'reservoirScore', 'sealScore', 'trapScore', 'timingScore', 'commercialScore', 'resourceEstimate'
];

const numericFields: Array<keyof ProspectInput> = [
  'latitude', 'longitude', 'sourceScore', 'migrationScore', 'reservoirScore', 'sealScore', 'trapScore', 'timingScore', 'commercialScore', 'resourceEstimate'
];

export const getRequiredColumns = () => requiredColumns;

export const normalizeProspectRow = (row: Record<string, unknown>, index: number, source: 'csv' | 'json'): Prospect => {
  const normalized: Record<string, unknown> = { ...row };

  if (!normalized.id || String(normalized.id).trim() === '') {
    normalized.id = `${source}-${index + 1}`;
  }

  numericFields.forEach((field) => {
    normalized[field] = Number(normalized[field]);
  });

  const prospect = normalized as Prospect;
  const errors = validateProspect(prospect);
  if (errors.length) {
    throw new Error(`Row ${index + 1} (${String(prospect.name ?? prospect.id ?? 'unknown')}) invalid: ${errors.join(', ')}`);
  }

  return prospect;
};

export const parseCsvProspects = (text: string): Prospect[] => {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim()
  });

  if (parsed.errors.length) {
    throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
  }

  const headers = parsed.meta.fields ?? [];
  for (const col of requiredColumns) {
    if (!headers.includes(col)) throw new Error(`Missing required column: ${col}`);
  }

  return parsed.data.map((row, index) => normalizeProspectRow(row, index, 'csv'));
};

export const parseJsonProspects = (text: string): Prospect[] => {
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) throw new Error('JSON must be an array of prospects');

  return parsed.map((row, index) => {
    if (typeof row !== 'object' || row === null) {
      throw new Error(`Row ${index + 1} invalid: row must be an object`);
    }
    return normalizeProspectRow(row as Record<string, unknown>, index, 'json');
  });
};
