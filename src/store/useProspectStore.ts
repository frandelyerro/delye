import { create } from 'zustand';
import { mockProspects } from '../data/mockProspects';
import { Priority, Prospect } from '../domain/prospect';
import { scoreProspects } from '../domain/scoring';

type Filters = { basin: string; block: string; playType: string; priority: '' | Priority };

type ProspectStore = {
  prospects: Prospect[];
  filters: Filters;
  setFilters: (filters: Partial<Filters>) => void;
  replaceProspects: (prospects: Prospect[]) => void;
  appendProspects: (prospects: Prospect[]) => void;
};

export const useProspectStore = create<ProspectStore>((set) => ({
  prospects: scoreProspects(mockProspects),
  filters: { basin: '', block: '', playType: '', priority: '' },
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  replaceProspects: (prospects) => set({ prospects: scoreProspects(prospects) }),
  appendProspects: (prospects) => set((state) => ({ prospects: scoreProspects([...state.prospects, ...prospects]) }))
}));
