import type { ProspectivityTier, RecommendedAction } from '../domain/recommendationEngine';
import type { EconomicAssessment } from '../domain/economicTypes';
import type { EvidenceConfidence } from '../domain/evidence';

// Priority badge styles (used: DashboardPage, ProspectDetailPage)
export const priorityBadgeClass = {
  high: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200',
  medium: 'border-amber-500/30 bg-amber-500/15 text-amber-200',
  low: 'border-red-500/30 bg-red-500/15 text-red-200'
};

// Risk component badge styles (used: DashboardPage, ProspectDetailPage, TargetingPage)
export const riskBadgeClass: Record<string, string> = {
  source: 'border-sky-500/30 bg-sky-500/15 text-sky-200',
  migration: 'border-cyan-500/30 bg-cyan-500/15 text-cyan-200',
  reservoir: 'border-indigo-500/30 bg-indigo-500/15 text-indigo-200',
  seal: 'border-violet-500/30 bg-violet-500/15 text-violet-200',
  trap: 'border-rose-500/30 bg-rose-500/15 text-rose-200',
  timing: 'border-orange-500/30 bg-orange-500/15 text-orange-200'
};

// Prospectivity tier badge styles
export const tierBadgeClass: Record<ProspectivityTier, string> = {
  tier_1: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
  tier_2: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200',
  tier_3: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  tier_4: 'border-slate-600 bg-slate-800/60 text-slate-400',
};

// Recommended action badge styles
export const actionBadgeClass: Record<RecommendedAction, string> = {
  drill_candidate: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
  appraisal_candidate: 'border-teal-500/40 bg-teal-500/15 text-teal-200',
  acquire_additional_seismic: 'border-sky-500/40 bg-sky-500/15 text-sky-200',
  validate_reservoir_quality: 'border-indigo-500/40 bg-indigo-500/15 text-indigo-200',
  validate_seal_continuity: 'border-violet-500/40 bg-violet-500/15 text-violet-200',
  improve_timing_model: 'border-orange-500/40 bg-orange-500/15 text-orange-200',
  acreage_review: 'border-cyan-700/40 bg-cyan-900/30 text-cyan-300',
  farm_in_candidate: 'border-blue-500/40 bg-blue-500/15 text-blue-200',
  watchlist: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  do_not_prioritize: 'border-red-500/40 bg-red-500/15 text-red-300',
};

// Economic grade badge styles
export const economicGradeBadge: Record<EconomicAssessment['economicGrade'], string> = {
  strong: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
  moderate: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200',
  weak: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  negative: 'border-red-500/40 bg-red-500/15 text-red-300',
};

// Decision signal badge styles
export const decisionSignalBadge: Record<EconomicAssessment['decisionSignal'], string> = {
  drill_if_budget_available: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
  de_risk_before_investment: 'border-sky-500/40 bg-sky-500/15 text-sky-200',
  consider_farm_in: 'border-blue-500/40 bg-blue-500/15 text-blue-200',
  investigate_further: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  do_not_invest: 'border-red-500/40 bg-red-500/15 text-red-300',
};

// Data confidence badge styles (used: ProspectDetailPage)
export const confidenceBadgeClass: Record<EvidenceConfidence, string> = {
  high: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200',
  medium: 'border-amber-500/30 bg-amber-500/15 text-amber-200',
  low: 'border-red-500/30 bg-red-500/15 text-red-200',
  unknown: 'border-slate-600 bg-slate-800 text-slate-400'
};
