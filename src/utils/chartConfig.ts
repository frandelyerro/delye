// Shared chart styling constants used across Dashboard, Map, Visualizations,
// and Comparison pages — keeps recharts tooltip styling and priority/basin
// color palettes consistent and defined in one place.

export const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 6,
  fontSize: 12,
} as const;

export type Priority = 'high' | 'medium' | 'low';

export const PRIORITY_COLOR: Record<Priority, string> = {
  high: '#22c55e',
  medium: '#f59e0b',
  low: '#ef4444',
};

export const BASIN_PALETTE = [
  '#38bdf8', '#a78bfa', '#34d399', '#f472b6', '#fb923c',
  '#facc15', '#60a5fa', '#f87171', '#4ade80', '#e879f9', '#94a3b8',
];
