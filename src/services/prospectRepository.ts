import { mockProspects } from '../data/mockProspects';
import type { Prospect } from '../domain/prospect';
import type { ProspectEvidence, ScoringMode, TargetPhase } from '../domain/evidence';
import type { EconomicAssumptions } from '../domain/economicTypes';
import type { ProspectOutcome } from '../domain/outcomes';
import { scoreProspect, scoreProspects } from '../domain/scoring';
import { isSupabaseConfigured, supabase } from './supabaseClient';

const STORAGE_KEY = 'petrotarget-ai:prospects';

// ── Repository interface ───────────────────────────────────────────────────────

export interface ProspectRepository {
  listProspects(): Promise<Prospect[]>;
  createProspect(input: Prospect): Promise<Prospect>;
  updateProspect(id: string, input: Prospect): Promise<Prospect>;
  deleteProspect(id: string): Promise<void>;
}

// ── DB row type (Supabase snake_case schema) ──────────────────────────────────

export type DbProspectRow = {
  id: string;
  name: string;
  basin: string;
  block: string;
  play_type: string;
  latitude: number;
  longitude: number;
  resource_estimate: number;
  commercial_score: number;
  source_score: number;
  migration_score: number;
  reservoir_score: number;
  seal_score: number;
  trap_score: number;
  timing_score: number;
  scoring_mode: string;
  target_phase?: string | null;
  evidence?: unknown | null;
  economic_assumptions?: unknown | null;
  outcome?: unknown | null;
  owner_id?: string | null;
  project_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

// ── Mapping helpers (exported for testing) ────────────────────────────────────

export const prospectToRow = (prospect: Prospect): Omit<DbProspectRow, 'created_at' | 'updated_at'> => ({
  id: prospect.id,
  name: prospect.name,
  basin: prospect.basin,
  block: prospect.block,
  play_type: prospect.playType,
  latitude: prospect.latitude,
  longitude: prospect.longitude,
  resource_estimate: prospect.resourceEstimate,
  commercial_score: prospect.commercialScore,
  source_score: prospect.sourceScore,
  migration_score: prospect.migrationScore,
  reservoir_score: prospect.reservoirScore,
  seal_score: prospect.sealScore,
  trap_score: prospect.trapScore,
  timing_score: prospect.timingScore,
  scoring_mode: prospect.scoringMode ?? 'manual',
  target_phase: prospect.targetPhase ?? null,
  evidence: prospect.evidence ?? null,
  economic_assumptions: prospect.economicAssumptions ?? null,
  outcome: prospect.outcome ?? null,
  owner_id: null,
  project_id: null,
});

export const rowToProspect = (row: DbProspectRow): Prospect => {
  const base: Prospect = {
    id: row.id,
    name: row.name,
    basin: row.basin,
    block: row.block ?? '',
    playType: row.play_type,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    resourceEstimate: Number(row.resource_estimate),
    commercialScore: Number(row.commercial_score),
    sourceScore: Number(row.source_score),
    migrationScore: Number(row.migration_score),
    reservoirScore: Number(row.reservoir_score),
    sealScore: Number(row.seal_score),
    trapScore: Number(row.trap_score),
    timingScore: Number(row.timing_score),
    scoringMode: (row.scoring_mode as ScoringMode) ?? 'manual',
    targetPhase: (row.target_phase as TargetPhase) ?? undefined,
    evidence: (row.evidence as ProspectEvidence) ?? undefined,
    economicAssumptions: (row.economic_assumptions as EconomicAssumptions) ?? undefined,
    outcome: (row.outcome as ProspectOutcome) ?? undefined,
  };
  // Regenerate all derived fields (GCoS, priority, dataConfidence, geoscienceAssessment, economicAssessment)
  return scoreProspect(base);
};

// ── Local (localStorage) repository ──────────────────────────────────────────

const canUseStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const readLocal = (): Prospect[] => {
  if (!canUseStorage()) return scoreProspects(mockProspects);
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return scoreProspects(mockProspects);
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? scoreProspects(parsed as Prospect[]) : scoreProspects(mockProspects);
  } catch {
    return scoreProspects(mockProspects);
  }
};

const writeLocal = (prospects: Prospect[]) => {
  if (canUseStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prospects));
  }
};

export const localProspectRepository: ProspectRepository = {
  async listProspects() {
    return readLocal();
  },
  async createProspect(input) {
    const current = readLocal();
    const scored = scoreProspect(input);
    writeLocal(scoreProspects([...current, scored]));
    return scored;
  },
  async updateProspect(id, input) {
    const current = readLocal();
    const scored = scoreProspect({ ...input, id });
    writeLocal(scoreProspects(current.map((p) => p.id === id ? scored : p)));
    return scored;
  },
  async deleteProspect(id) {
    const current = readLocal();
    writeLocal(scoreProspects(current.filter((p) => p.id !== id)));
  },
};

// ── Supabase repository ───────────────────────────────────────────────────────

const PROSPECTS_TABLE = 'prospects';

export const supabaseProspectRepository: ProspectRepository = {
  async listProspects() {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase.from(PROSPECTS_TABLE).select('*').order('created_at', { ascending: false });
    if (error) throw new Error(`Supabase listProspects error: ${error.message}`);
    return (data as DbProspectRow[]).map(rowToProspect);
  },

  async createProspect(input) {
    if (!supabase) throw new Error('Supabase is not configured.');
    const row = prospectToRow(input);
    const { data, error } = await supabase.from(PROSPECTS_TABLE).insert(row).select().single();
    if (error) throw new Error(`Supabase createProspect error: ${error.message}`);
    return rowToProspect(data as DbProspectRow);
  },

  async updateProspect(id, input) {
    if (!supabase) throw new Error('Supabase is not configured.');
    const row = prospectToRow({ ...input, id });
    const { data, error } = await supabase.from(PROSPECTS_TABLE).upsert({ ...row, updated_at: new Date().toISOString() }).select().single();
    if (error) throw new Error(`Supabase updateProspect error: ${error.message}`);
    return rowToProspect(data as DbProspectRow);
  },

  async deleteProspect(id) {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error } = await supabase.from(PROSPECTS_TABLE).delete().eq('id', id);
    if (error) throw new Error(`Supabase deleteProspect error: ${error.message}`);
  },
};

// ── Factory ───────────────────────────────────────────────────────────────────

export const getProspectRepository = (): ProspectRepository =>
  isSupabaseConfigured ? supabaseProspectRepository : localProspectRepository;
