import React from 'react';
import { Link } from 'react-router-dom';
import { useProspectStore } from '../store/useProspectStore';
import {
  getPortfolioRecommendations,
  getProspectivityTier,
  getRecommendedAction,
  getRecommendedActionLabel,
  getTierLabel,
  type ProspectivityTier,
  type RecommendedAction,
  type TargetingRecommendation,
} from '../domain/recommendationEngine';
import { getExplorationStage, getExplorationStageLabel } from '../domain/earlyExploration';
import { getPortfolioSummary } from '../domain/portfolioIntelligence';
import { getDecisionSignalLabel } from '../domain/economics';
import type { EconomicAssessment } from '../domain/economicTypes';
import { exportPortfolioReportJson, exportPortfolioReportMarkdown } from '../utils/exportReport';

const tierBadge: Record<ProspectivityTier, string> = {
  tier_1: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
  tier_2: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200',
  tier_3: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  tier_4: 'border-slate-600 bg-slate-800/60 text-slate-400',
};

const tierShortLabel: Record<ProspectivityTier, string> = {
  tier_1: 'T1', tier_2: 'T2', tier_3: 'T3', tier_4: 'T4',
};

const actionBadge: Record<RecommendedAction, string> = {
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

const decisionSignalBadge: Record<EconomicAssessment['decisionSignal'], string> = {
  drill_if_budget_available: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
  de_risk_before_investment: 'border-sky-500/40 bg-sky-500/15 text-sky-200',
  consider_farm_in: 'border-blue-500/40 bg-blue-500/15 text-blue-200',
  investigate_further: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  do_not_invest: 'border-red-500/40 bg-red-500/15 text-red-300',
};

const riskBadge: Record<string, string> = {
  source: 'border-sky-500/30 bg-sky-500/15 text-sky-200',
  migration: 'border-cyan-500/30 bg-cyan-500/15 text-cyan-200',
  reservoir: 'border-indigo-500/30 bg-indigo-500/15 text-indigo-200',
  seal: 'border-violet-500/30 bg-violet-500/15 text-violet-200',
  trap: 'border-rose-500/30 bg-rose-500/15 text-rose-200',
  timing: 'border-orange-500/30 bg-orange-500/15 text-orange-200',
};

const bucketConfig: Array<{ label: string; actions: RecommendedAction[]; colorClass: string }> = [
  { label: 'Drill Candidates', actions: ['drill_candidate'], colorClass: 'border-emerald-700 bg-emerald-950/30' },
  { label: 'Appraisal Candidates', actions: ['appraisal_candidate'], colorClass: 'border-teal-700 bg-teal-950/30' },
  {
    label: 'De-risk Before Drill',
    actions: ['acquire_additional_seismic', 'validate_reservoir_quality', 'validate_seal_continuity', 'improve_timing_model'],
    colorClass: 'border-sky-700 bg-sky-950/30'
  },
  { label: 'Farm-in / Acreage Review', actions: ['farm_in_candidate', 'acreage_review'], colorClass: 'border-blue-700 bg-blue-950/30' },
  { label: 'Watchlist', actions: ['watchlist'], colorClass: 'border-amber-700 bg-amber-950/30' },
  { label: 'Do Not Prioritize', actions: ['do_not_prioritize'], colorClass: 'border-red-800 bg-red-950/20' },
];

export function TargetingPage() {
  const { prospects } = useProspectStore();
  const [basinFilter, setBasinFilter] = React.useState('');
  const [playTypeFilter, setPlayTypeFilter] = React.useState('');
  const [scoringModeFilter, setScoringModeFilter] = React.useState('');
  const [tierFilter, setTierFilter] = React.useState('');
  const [actionFilter, setActionFilter] = React.useState('');

  const allRecs = getPortfolioRecommendations(prospects);
  const summary = getPortfolioSummary(prospects);

  const basins = [...new Set(prospects.map((p) => p.basin))].sort();
  const playTypes = [...new Set(prospects.map((p) => p.playType))].sort();

  const filtered: TargetingRecommendation[] = allRecs.filter((r) => {
    const p = prospects.find((x) => x.id === r.prospectId);
    if (!p) return false;
    if (basinFilter && p.basin !== basinFilter) return false;
    if (playTypeFilter && p.playType !== playTypeFilter) return false;
    if (scoringModeFilter) {
      const mode = p.scoringMode ?? 'manual';
      if (scoringModeFilter === 'manual' && mode !== 'manual') return false;
      if (scoringModeFilter === 'evidence_derived' && mode !== 'evidence_derived') return false;
    }
    if (tierFilter && r.tier !== tierFilter) return false;
    if (actionFilter && r.action !== actionFilter) return false;
    return true;
  });

  const totalRiskedResources = prospects.reduce((acc, p) => acc + (p.economicAssessment?.riskedResourceMMboe ?? 0), 0);
  const positiveEMVCount = prospects.filter((p) => (p.economicAssessment?.simpleEMVUsdMM ?? 0) > 0).length;

  const kpis = [
    { label: 'Total Prospects', value: summary.totalProspects, sub: 'in portfolio' },
    { label: 'Tier 1 Targets', value: summary.tier1Count, sub: 'high prospectivity' },
    { label: 'Drill Candidates', value: summary.drillCandidateCount, sub: 'ready for FID' },
    { label: 'Avg. Data Confidence', value: `${summary.averageDataConfidence}/100`, sub: 'input quality' },
    { label: 'Main Portfolio Risk', value: summary.portfolioMainRisk.charAt(0).toUpperCase() + summary.portfolioMainRisk.slice(1), sub: 'most common risk factor' },
    { label: 'Risked Resources', value: `${totalRiskedResources.toFixed(1)} MMboe`, sub: 'portfolio total' },
    { label: 'Positive EMV', value: positiveEMVCount, sub: 'prospects' },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Petroleum AI Targeting Workbench</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              AI-assisted petroleum targeting for prospect ranking, uncertainty reduction and exploration decision support.
              Recommendations are rule-based heuristics and do not replace technical human interpretation.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              className="rounded bg-cyan-700 px-4 py-2 text-sm font-medium hover:bg-cyan-600"
              onClick={() => exportPortfolioReportJson(prospects)}
              type="button"
            >
              Export Portfolio JSON
            </button>
            <button
              className="rounded border border-cyan-700 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-950"
              onClick={() => exportPortfolioReportMarkdown(prospects)}
              type="button"
            >
              Export Portfolio Markdown
            </button>
          </div>
        </div>
      </section>

      {/* Portfolio Overview */}
      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-7">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{k.label}</div>
            <div className="mt-3 text-2xl font-semibold text-slate-50">{k.value}</div>
            <div className="mt-1 text-xs text-slate-400">{k.sub}</div>
          </div>
        ))}
      </section>

      {/* Tier breakdown row */}
      <section className="grid gap-3 md:grid-cols-4">
        {(['tier_1', 'tier_2', 'tier_3', 'tier_4'] as ProspectivityTier[]).map((tier) => {
          const count = [summary.tier1Count, summary.tier2Count, summary.tier3Count, summary.tier4Count][
            parseInt(tier.split('_')[1]) - 1
          ];
          return (
            <div key={tier} className={`rounded-lg border p-3 ${tierBadge[tier]}`}>
              <div className="text-xs font-semibold uppercase tracking-wide">{getTierLabel(tier)}</div>
              <div className="mt-2 text-xl font-bold">{count} prospect{count !== 1 ? 's' : ''}</div>
            </div>
          );
        })}
      </section>

      {/* Filters */}
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Filters — {filtered.length} results</h2>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <select className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={basinFilter} onChange={(e) => setBasinFilter(e.target.value)}>
            <option value="">All basins</option>
            {basins.map((b) => <option key={b}>{b}</option>)}
          </select>
          <select className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={playTypeFilter} onChange={(e) => setPlayTypeFilter(e.target.value)}>
            <option value="">All play types</option>
            {playTypes.map((p) => <option key={p}>{p}</option>)}
          </select>
          <select className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={scoringModeFilter} onChange={(e) => setScoringModeFilter(e.target.value)}>
            <option value="">All scoring modes</option>
            <option value="manual">Manual</option>
            <option value="evidence_derived">Evidence-derived</option>
          </select>
          <select className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
            <option value="">All tiers</option>
            <option value="tier_1">Tier 1</option>
            <option value="tier_2">Tier 2</option>
            <option value="tier_3">Tier 3</option>
            <option value="tier_4">Tier 4</option>
          </select>
          <select className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="">All actions</option>
            <option value="drill_candidate">Drill Candidate</option>
            <option value="appraisal_candidate">Appraisal Candidate</option>
            <option value="acquire_additional_seismic">Acquire Seismic</option>
            <option value="validate_reservoir_quality">Validate Reservoir</option>
            <option value="validate_seal_continuity">Validate Seal</option>
            <option value="improve_timing_model">Improve Timing Model</option>
            <option value="farm_in_candidate">Farm-in Candidate</option>
            <option value="acreage_review">Acreage Review</option>
            <option value="watchlist">Watchlist</option>
            <option value="do_not_prioritize">Do Not Prioritize</option>
          </select>
        </div>
      </section>

      {/* Targeting table */}
      <section className="rounded-lg border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-200">Targeting Recommendations</h2>
        </div>
        {filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1700px] text-sm">
              <thead className="bg-slate-950/70">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Prospect</th>
                  <th className="px-4 py-3">Basin</th>
                  <th className="px-4 py-3">Play Type</th>
                  <th className="px-4 py-3">GCoS %</th>
                  <th className="px-4 py-3">Comm.</th>
                  <th className="px-4 py-3">Resources MMboe</th>
                  <th className="px-4 py-3">Simple EMV ($M)</th>
                  <th className="px-4 py-3">Decision Signal</th>
                  <th className="px-4 py-3">Data Conf.</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Recommended Action</th>
                  <th className="px-4 py-3">Main Risk</th>
                  <th className="px-4 py-3">Next Best Step</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((rec, i) => {
                  const p = prospects.find((x) => x.id === rec.prospectId);
                  if (!p) return null;
                  return (
                    <tr key={rec.prospectId} className="border-t border-slate-800 align-top hover:bg-slate-800/35">
                      <td className="px-4 py-4 font-semibold text-slate-300">#{i + 1}</td>
                      <td className="px-4 py-4">
                        <Link to={`/prospects/${p.id}`} className="font-medium text-cyan-300 hover:text-cyan-200">{p.name}</Link>
                      </td>
                      <td className="px-4 py-4 text-slate-300">{p.basin}</td>
                      <td className="px-4 py-4 text-slate-300">{p.playType}</td>
                      <td className="px-4 py-4 font-semibold text-slate-100">{Math.round((p.geologicalChanceOfSuccess ?? 0) * 100)}%</td>
                      <td className="px-4 py-4 text-slate-300">{p.commercialScore}</td>
                      <td className="px-4 py-4 text-slate-300">{p.resourceEstimate}</td>
                      <td className="px-4 py-4">
                        {p.economicAssessment ? (
                          <span className={`font-semibold ${p.economicAssessment.simpleEMVUsdMM >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                            ${p.economicAssessment.simpleEMVUsdMM.toFixed(0)}M
                          </span>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-4">
                        {p.economicAssessment ? (
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${decisionSignalBadge[p.economicAssessment.decisionSignal]}`}>
                            {getDecisionSignalLabel(p.economicAssessment.decisionSignal)}
                          </span>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                          (p.dataConfidence ?? 0) >= 70
                            ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200'
                            : (p.dataConfidence ?? 0) >= 50
                            ? 'border-amber-500/30 bg-amber-500/15 text-amber-200'
                            : 'border-red-500/30 bg-red-500/15 text-red-200'
                        }`}>
                          {p.dataConfidence ?? 0}/100
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${tierBadge[rec.tier]}`}>
                          {tierShortLabel[rec.tier]}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${actionBadge[rec.action]}`}>
                          {getRecommendedActionLabel(rec.action)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${riskBadge[p.mainRisk ?? 'timing']}`}>
                          {p.mainRisk}
                        </span>
                      </td>
                      <td className="px-4 py-4 max-w-[220px] whitespace-normal text-xs leading-5 text-slate-400">{rec.nextBestStep}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-6 text-sm text-slate-400">No prospects match the current filters.</p>
        )}
      </section>

      {/* Decision buckets */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Decision Buckets</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {bucketConfig.map((bucket) => {
            const bucketRecs = filtered.filter((r) => bucket.actions.includes(r.action));
            return (
              <div key={bucket.label} className={`rounded-lg border p-4 ${bucket.colorClass}`}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200">{bucket.label}</h3>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-300">{bucketRecs.length}</span>
                </div>
                {bucketRecs.length ? (
                  <ul className="space-y-1.5">
                    {bucketRecs.map((r) => {
                      const p = prospects.find((x) => x.id === r.prospectId);
                      return (
                        <li key={r.prospectId} className="flex items-center justify-between gap-2 text-xs">
                          <Link to={`/prospects/${r.prospectId}`} className="font-medium text-slate-200 hover:text-cyan-300">{r.prospectName}</Link>
                          <span className="shrink-0 text-slate-500">{p ? `${Math.round((p.geologicalChanceOfSuccess ?? 0) * 100)}% GCoS` : ''}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500">No prospects in this bucket.</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Portfolio Advisor Summary */}
      {summary.keyRecommendations.length > 0 && (
        <section className="rounded-lg border border-cyan-900 bg-slate-900 p-5">
          <h2 className="mb-1 text-sm font-semibold text-cyan-200">Portfolio Advisor Summary</h2>
          <p className="mb-4 text-xs text-slate-400">Rule-based executive recommendations. Not a substitute for technical judgement.</p>
          <ul className="space-y-2">
            {summary.keyRecommendations.map((rec, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-300">
                <span className="mt-0.5 shrink-0 font-bold text-cyan-500">{i + 1}.</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
