import { create } from 'zustand';
import { mockProspects } from '../data/mockProspects';
import { Priority, Prospect, validateProspect } from '../domain/prospect';
import { scoreProspect, scoreProspects } from '../domain/scoring';
import { getProspectRepository } from '../services/prospectRepository';
import type { ProspectOutcome } from '../domain/outcomes';

type Filters = { basin: string; block: string; playType: string; priority: '' | Priority };
const STORAGE_KEY = 'petrotarget-ai:prospects';

type ProspectStore = {
  prospects: Prospect[];
  filters: Filters;
  setFilters: (filters: Partial<Filters>) => void;
  replaceProspects: (prospects: Prospect[]) => void;
  appendProspects: (prospects: Prospect[]) => void;
  createProspect: (prospect: Prospect) => void;
  updateProspect: (id: string, prospect: Prospect) => void;
  batchUpdateOutcomes: (updates: { id: string; outcome: ProspectOutcome }[]) => void;
  deleteProspect: (id: string) => void;
  resetProspects: () => void;
  loadFromStorage: () => void;
  persistToStorage: () => void;
  loadFromRepository: () => Promise<void>;
  saveToRepository: () => Promise<{ saved: number; errors: string[] }>;
  importProspects: (prospects: Prospect[]) => { imported: number; skippedDuplicates: number };
};

const canUseStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const sampleProspects = () => scoreProspects(mockProspects);

const validateOrThrow = (prospect: Prospect) => {
  const errors = validateProspect(prospect);
  if (errors.length) {
    throw new Error(errors.join('; '));
  }
};

const readStoredProspects = (): Prospect[] | null => {
  if (!canUseStorage()) return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  const parsed = JSON.parse(stored);
  return Array.isArray(parsed) ? scoreProspects(parsed as Prospect[]) : null;
};

const writeStoredProspects = (prospects: Prospect[]) => {
  if (canUseStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prospects));
  }
};

const removeStoredProspects = () => {
  if (canUseStorage()) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
};

const initialProspects = () => {
  try {
    return readStoredProspects() ?? sampleProspects();
  } catch {
    return sampleProspects();
  }
};

export const useProspectStore = create<ProspectStore>((set) => ({
  prospects: initialProspects(),
  filters: { basin: '', block: '', playType: '', priority: '' },
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  replaceProspects: (prospects) => {
    const scoredProspects = scoreProspects(prospects);
    writeStoredProspects(scoredProspects);
    set({ prospects: scoredProspects });
  },
  appendProspects: (prospects) => set((state) => {
    const scoredProspects = scoreProspects([...state.prospects, ...prospects]);
    writeStoredProspects(scoredProspects);
    return { prospects: scoredProspects };
  }),
  createProspect: (prospect) => {
    validateOrThrow(prospect);
    set((state) => {
      if (state.prospects.some((p) => p.id === prospect.id)) {
        throw new Error(`Prospect id "${prospect.id}" already exists`);
      }
      const scoredProspects = scoreProspects([...state.prospects, scoreProspect(prospect)]);
      writeStoredProspects(scoredProspects);
      return { prospects: scoredProspects };
    });
  },
  updateProspect: (id, prospect) => {
    validateOrThrow({ ...prospect, id });
    set((state) => {
      if (!state.prospects.some((p) => p.id === id)) {
        throw new Error(`Prospect id "${id}" was not found`);
      }
      const scoredProspects = scoreProspects(state.prospects.map((p) => p.id === id ? scoreProspect({ ...prospect, id }) : p));
      writeStoredProspects(scoredProspects);
      return { prospects: scoredProspects };
    });
  },
  batchUpdateOutcomes: (updates) => set((state) => {
    const outcomeById = new Map(updates.map((u) => [u.id, u.outcome]));
    const scoredProspects = scoreProspects(
      state.prospects.map((p) => (outcomeById.has(p.id) ? scoreProspect({ ...p, outcome: outcomeById.get(p.id) }) : p)),
    );
    writeStoredProspects(scoredProspects);
    return { prospects: scoredProspects };
  }),
  deleteProspect: (id) => set((state) => {
    const scoredProspects = scoreProspects(state.prospects.filter((p) => p.id !== id));
    writeStoredProspects(scoredProspects);
    return { prospects: scoredProspects };
  }),
  resetProspects: () => {
    const scoredProspects = sampleProspects();
    removeStoredProspects();
    set({ prospects: scoredProspects });
  },
  loadFromStorage: () => set({ prospects: readStoredProspects() ?? sampleProspects() }),
  persistToStorage: () => set((state) => {
    writeStoredProspects(state.prospects);
    return {};
  }),

  loadFromRepository: async () => {
    try {
      const repo = getProspectRepository();
      const prospects = await repo.listProspects();
      writeStoredProspects(prospects);
      set({ prospects });
    } catch (e) {
      console.error('[PetroTarget] loadFromRepository failed:', (e as Error).message);
    }
  },

  saveToRepository: async () => {
    const result = { saved: 0, errors: [] as string[] };
    const repo = getProspectRepository();
    const { prospects } = useProspectStore.getState();
    for (const prospect of prospects) {
      try {
        await repo.updateProspect(prospect.id, prospect);
        result.saved++;
      } catch (e) {
        result.errors.push(`${prospect.name}: ${(e as Error).message}`);
      }
    }
    return result;
  },

  importProspects: (incoming) => {
    const { prospects: current } = useProspectStore.getState();
    const existingIds = new Set(current.map((p) => p.id));
    let imported = 0;
    let skippedDuplicates = 0;
    const newProspects: Prospect[] = [];
    for (const p of incoming) {
      if (existingIds.has(p.id)) {
        skippedDuplicates++;
      } else {
        newProspects.push(scoreProspect(p));
        imported++;
      }
    }
    if (newProspects.length > 0) {
      const merged = scoreProspects([...current, ...newProspects]);
      writeStoredProspects(merged);
      set({ prospects: merged });
    }
    return { imported, skippedDuplicates };
  },
}));
