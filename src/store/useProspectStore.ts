import { create } from 'zustand';
import { mockProspects } from '../data/mockProspects';
import { Prospect } from '../domain/prospect';
import { scoreProspects } from '../domain/scoring';

type Store = {
  prospects: Prospect[];
  importProspects: (rows: Prospect[]) => void;
};

export const useProspectStore = create<Store>((set) => ({
  prospects: scoreProspects(mockProspects),
  importProspects: (rows) => set({ prospects: scoreProspects(rows) })
}));
