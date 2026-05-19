export type Priority = 'high' | 'medium' | 'low';

export type Prospect = {
  id: string;
  name: string;
  basin: string;
  block: string;
  playType: string;
  latitude: number;
  longitude: number;
  sourceScore: number;
  migrationScore: number;
  reservoirScore: number;
  sealScore: number;
  trapScore: number;
  timingScore: number;
  commercialScore: number;
  resourceEstimate: number;
  geologicalChanceOfSuccess?: number;
  priority?: Priority;
  mainRisk?: string;
  recommendation?: string;
  explanation?: string;
};
