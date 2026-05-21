import { create } from 'zustand';
import { mockProspects } from '../data/mockProspects';
import { Priority, Prospect, validateProspect } from '../domain/prospect';
import { scoreProspect, scoreProspects } from '../domain/scoring';

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
  deleteProspect: (id: string) => void;
  resetProspects: () => void;
  loadFromStorage: () => void;
  persistToStorage: () => void;
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
  })
}));
