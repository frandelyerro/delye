import { Priority } from './prospect';

export const recommendationByPriority: Record<Priority, string> = {
  high: 'Advance to detailed technical evaluation / drilling candidate',
  medium: 'Acquire additional data and reduce key uncertainty',
  low: 'Do not prioritize unless new evidence improves risk profile'
};
