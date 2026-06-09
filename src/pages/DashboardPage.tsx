import React from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, Legend } from 'recharts';
import { useProspectStore } from '../store/useProspectStore';
import {
  getProspectivityTier,
  getRecommendedAction,
  getRecommendedActionLabel,
  type ProspectivityTier,
  type RecommendedAction,
} from '../domain/recommendationEngine';
import { getExplorationStage, getExplorationStageLabel } from '../domain/earlyExploration';
import { getEconomicGradeLabel } from '../domain/economics';
import type { EconomicAssessment } from '../domain/economicTypes';
import { exportPortfolioAsCsv, exportPortfolioAsJson } from '../utils/exportReport';
import { getRiskConcentration, getGCoSHistogram, getBasinStats, getBasinDiversityIndex, getDrillSequenceOrder } from '../domain/portfolioIntelligence';

const colors = { high: '#22c55e', medium: '#f59e0b', low: '#ef4444' };

const priorityBadgeClass = {
  high: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200',
  medium: 'border-amber-500/30 bg-amber-500/15 text-amber-200',
  low: 'border-red-500/30 bg-red-500/15 text-red-200'
};

const riskBadgeClass = {
  source: 'border-sky-500/30 bg-sky-500/15 text-sky-200',
  migration: 'border-cyan-500/30 bg-cyan-500/15 text-cyan-200',
  reservoir: 'border-indigo-500/30 bg-indigo-500/15 text-indigo-200',
  seal: 'border-violet-500/30 bg-violet-500/15 text-violet-200',
  trap: 'border-rose-500/30 bg-rose-500/15 text-rose-200',
  timing: 'border-orange-500/30 bg-orange-500/15 text-orange-200'
};

const tierBadgeClass: Record<ProspectivityTier, string> = {
  tier_1: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
  tier_2: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200',
  tier_3: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  tier_4: 'border-slate-600 bg-slate-800/60 text-slate-400',
};

const actionBadgeClass: Record<RecommendedAction, string> = {
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

const economicGradeBadge: Record<EconomicAssessment['economicGrade'], string> = {
  strong: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200',
  moderate: 'border-cyan-500/30 bg-cyan-500/15 text-cyan-200',
  weak: 'border-amber-500/30 bg-amber-500/15 text-amber-200',
  negative: 'border-red-500/30 bg-red-500/15 text-red-300',
};

export function DashboardPage() {
  const { prospects, filters, setFilters, deleteProspect, resetProspects } = useProspectStore();
  const [scoringModeFilter, setScoringModeFilter] = React.useState<'' | 'manual' | 'evidence_derived'>('');
  const basins = [...new Set(prospects.map((p) => p.basin))];
  const blocks = [...new Set(prospects.map((p) => p.block))];
  const plays = [...new Set(prospects.map((p) => p.playType))];

  const filtered = prospects.filter((p) =>
    (!filters.basin || p.basin === filters.basin) &&
    (!filters.block || p.block === filters.block) &&
    (!filters.playType || p.playType === filters.playType) &&
    (!filters.priority || p.priority === filters.priority) &&
    (!scoringModeFilter || (scoringModeFilter === 'manual' ? (!p.scoringMode || p.scoringMode === 'manual') : p.scoringMode === scoringModeFilter))
  );
  const ranked = [...filtered].sort((a, b) => (b.geologicalChanceOfSuccess ?? 0) - (a.geologicalChanceOfSuccess ?? 0));

  const avg = filtered.length ? filtered.reduce((a, p) => a + (p.geologicalChanceOfSuccess ?? 0), 0) / filtered.length : 0;
  const totals = filtered.reduce((a, p) => a + p.resourceEstimate, 0);
  const top = ranked[0];
  const priorityDist = ['high', 'medium', 'low'].map((k) => ({ name: k, value: filtered.filter((p) => p.priority === k).length }));
  const playTypeDist = [...new Map(
    filtered.map((p) => [p.playType || 'Unknown', 0])
  ).keys()].map((play) => ({
    name: play.length > 18 ? play.slice(0, 16) + '…' : play,
    count: filtered.filter((p) => (p.playType || 'Unknown') === play).length,
    avgGcos: Math.round(filtered.filter((p) => (p.playType || 'Unknown') === play)
      .reduce((s, p) => s + (p.geologicalChanceOfSuccess ?? 0), 0) /
      Math.max(filtered.filter((p) => (p.playType || 'Unknown') === play).length, 1) * 100),
  })).sort((a, b) => b.count - a.count).slice(0, 8);
  const kpis = [
    ['Portfolio', filtered.length, 'filtered prospects'],
    ['Average GCoS', `${Math.round(avg * 100)}%`, 'geological chance of success'],
    ['Unrisked resources', `${totals} MMboe`, 'current filtered portfolio'],
    ['Top prospect', top?.name ?? '-', top ? `${Math.round((top.geologicalChanceOfSuccess ?? 0) * 100)}% GCoS` : 'no active match']
  ];

  const gcosHistogram = getGCoSHistogram(filtered);
  const basinStats = getBasinStats(filtered);
  const riskConcentration = getRiskConcentration(filtered);
  const basinDiversity = getBasinDiversityIndex(filtered);
  const drillSequence = getDrillSequenceOrder(filtered, 5);

  return <div className="space-y-6">
    <section className="border border-slate-800 bg-slate-900 rounded-lg p-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">PetroTarget AI</h1>
          <p className="mt-1 text-sm text-slate-400">Decision intelligence for petroleum exploration</p>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
          <p className="max-w-xl text-sm leading-6 text-slate-300">
            Rank exploration opportunities by explainable petroleum system risk, commercial strength, and resource scale.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/prospects/new" className="inline-flex rounded bg-cyan-700 px-4 py-2 text-sm font-medium hover:bg-cyan-600">New Prospect</Link>
            <button className="rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800" onClick={() => exportPortfolioAsCsv(filtered)} type="button">Export CSV</button>
            <button className="rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800" onClick={() => exportPortfolioAsJson(filtered)} type="button">Export JSON</button>
            <button className="rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800" onClick={() => resetProspects()} type="button">Reset to sample data</button>
          </div>
        </div>
      </div>
    </section>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {kpis.map(([label, value, detail]) => (
        <div key={label} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
          <div className="mt-3 text-2xl font-semibold text-slate-50">{value}</div>
          <div className="mt-1 text-xs text-slate-400">{detail}</div>
        </div>
      ))}
    </section>

    <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-200">Portfolio filters</h2>
        <span className="text-xs text-slate-500">{ranked.length} ranked results</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <select className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={filters.basin} onChange={(e) => setFilters({ basin: e.target.value })}><option value="">All basins</option>{basins.map((v) => <option key={v}>{v}</option>)}</select>
        <select className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={filters.block} onChange={(e) => setFilters({ block: e.target.value })}><option value="">All blocks</option>{blocks.map((v) => <option key={v}>{v}</option>)}</select>
        <select className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={filters.playType} onChange={(e) => setFilters({ playType: e.target.value })}><option value="">All play types</option>{plays.map((v) => <option key={v}>{v}</option>)}</select>
        <select className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={filters.priority} onChange={(e) => setFilters({ priority: e.target.value as '' | 'high' | 'medium' | 'low' })}><option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
        <select className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={scoringModeFilter} onChange={(e) => setScoringModeFilter(e.target.value as '' | 'manual' | 'evidence_derived')}><option value="">All scoring modes</option><option value="manual">Manual</option><option value="evidence_derived">Evidence-derived</option></select>
      </div>
    </section>

    <section className="grid gap-4 xl:grid-cols-[300px_1fr_1fr]">
      <div className="h-64 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-200">Priority mix</h2>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={priorityDist} dataKey="value" nameKey="name" outerRadius={82}>
              {priorityDist.map((entry) => <Cell key={entry.name} fill={colors[entry.name as keyof typeof colors]} />)}
            </Pie>
            <Tooltip/>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="h-64 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Play-type breakdown</h2>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={playTypeDist} layout="vertical" margin={{ left: 4, right: 24, top: 0, bottom: 8 }}>
            <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={96} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: number, name: string) => [v, name === 'count' ? 'prospects' : 'avg GCoS %']}
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 12 }}
            />
            <Bar dataKey="count" name="count" fill="#38bdf8" fillOpacity={0.8} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900 xl:col-span-3">
        {/* Portfolio Analytics Row */}
        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1.6fr]">
          {/* GCoS Distribution Histogram */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-200">GCoS distribution</h2>
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-500">No prospects to display.</p>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gcosHistogram} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#64748b', fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={44}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={24}
                    />
                    <Tooltip
                      formatter={(v: number) => [v, 'prospects']}
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 12 }}
                    />
                    <Bar dataKey="count" name="count" radius={[3, 3, 0, 0]}>
                      {gcosHistogram.map((bucket) => {
                        const fill = bucket.min >= 0.3 ? '#22c55e' : bucket.min >= 0.15 ? '#f59e0b' : '#ef4444';
                        return <Cell key={bucket.label} fill={fill} fillOpacity={0.85} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Basin Risk Heatmap Table */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-200">Basin heatmap</h2>
            {basinStats.length === 0 ? (
              <p className="text-xs text-slate-500">No basin data available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-800">
                      <th className="py-2 pr-3">Basin</th>
                      <th className="py-2 pr-3 text-right">Prospects</th>
                      <th className="py-2 pr-3 text-right">Avg GCoS</th>
                      <th className="py-2 pr-3 text-right">Drill Candidates</th>
                      <th className="py-2 text-right">Avg Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {basinStats.map((row) => {
                      const gcosCls = row.avgGCoS >= 30 ? 'text-emerald-300' : row.avgGCoS >= 15 ? 'text-amber-300' : 'text-red-300';
                      const dcCls = row.avgDataConfidence >= 70 ? 'text-emerald-300' : row.avgDataConfidence >= 45 ? 'text-amber-300' : 'text-slate-400';
                      return (
                        <tr key={row.basin} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                          <td className="py-2 pr-3 font-medium text-slate-200">{row.basin}</td>
                          <td className="py-2 pr-3 text-right text-slate-300">{row.count}</td>
                          <td className={`py-2 pr-3 text-right font-semibold ${gcosCls}`}>{row.avgGCoS}%</td>
                          <td className="py-2 pr-3 text-right text-slate-300">{row.drillCandidates}</td>
                          <td className={`py-2 text-right ${dcCls}`}>{row.avgDataConfidence}/100</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>

    {/* Portfolio Intelligence — Risk Concentration · Basin Diversity · Drill Sequence */}
    <section className="grid gap-4 lg:grid-cols-3">
      <div className={`rounded-lg border p-4 ${riskConcentration.concentrated ? 'border-amber-800/60 bg-amber-950/20' : 'border-slate-800 bg-slate-900'}`}>
        <h2 className="mb-2 text-sm font-semibold text-slate-200">Risk Concentration</h2>
        {riskConcentration.concentrated ? (
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-amber-400">&#9888;</span>
            <div>
              <p className="text-xs font-semibold capitalize text-amber-300">{riskConcentration.dominantRisk} risk dominant</p>
              <p className="mt-1 text-xs text-amber-200/80">
                {riskConcentration.dominantPct}% of prospects ({riskConcentration.dominantCount}/{riskConcentration.total}) share the same primary risk. A single play failure could impact the majority of the portfolio.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            {riskConcentration.total > 0
              ? `Risk well-distributed — ${riskConcentration.dominantRisk} leads at ${riskConcentration.dominantPct}%, below 50% threshold.`
              : 'No prospects in current filter.'}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-200">Basin Diversity</h2>
        <div className="flex items-end gap-3">
          <span className={`text-4xl font-bold ${basinDiversity.diversityScore >= 60 ? 'text-emerald-300' : basinDiversity.diversityScore >= 35 ? 'text-amber-300' : 'text-red-300'}`}>
            {basinDiversity.diversityScore}
          </span>
          <span className="mb-1 text-xs text-slate-400">/ 100</span>
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800">
          <div
            className={`h-1.5 rounded-full ${basinDiversity.diversityScore >= 60 ? 'bg-emerald-500' : basinDiversity.diversityScore >= 35 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${basinDiversity.diversityScore}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {basinDiversity.basinCount} basin{basinDiversity.basinCount !== 1 ? 's' : ''} · HHI {basinDiversity.hhi.toFixed(2)}
        </p>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-200">Drill Sequence (Top 5)</h2>
        {drillSequence.length === 0 ? (
          <p className="text-xs text-slate-500">No prospects in current filter.</p>
        ) : (
          <ol className="space-y-1.5">
            {drillSequence.map((e) => (
              <li key={e.prospectId} className="flex items-center gap-2">
                <span className="w-4 text-xs font-bold text-slate-500">#{e.rank}</span>
                <span className="flex-1 truncate text-xs font-medium text-slate-200">{e.prospectName}</span>
                <span className="text-xs text-slate-400">{e.gcos}%</span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs font-semibold text-cyan-300">{e.compositeScore}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-2 text-xs text-slate-500">Score = 50% GCoS + 30% commercial + 20% confidence</p>
      </div>
    </section>

    <section className="rounded-lg border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-200">Prospect ranking</h2>
      </div>
        {ranked.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[2100px] text-sm">
              <thead className="bg-slate-950/70">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Prospect Name</th>
                  <th className="px-4 py-3">Basin</th>
                  <th className="px-4 py-3">Block</th>
                  <th className="px-4 py-3">Play Type</th>
                  <th className="px-4 py-3">GCoS %</th>
                  <th className="px-4 py-3">Commercial Score</th>
                  <th className="px-4 py-3">Resource Estimate MMboe</th>
                  <th className="px-4 py-3">Simple EMV ($M)</th>
                  <th className="px-4 py-3">Econ Grade</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Main Risk</th>
                  <th className="px-4 py-3">Data Confidence</th>
                  <th className="px-4 py-3">Scoring Mode</th>
                  <th className="px-4 py-3">Prospectivity Tier</th>
                  <th className="px-4 py-3">Recommended Action</th>
                  <th className="px-4 py-3">Exploration Stage</th>
                  <th className="px-4 py-3">Recommendation</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((p, index) => (
                  <tr key={p.id} className="border-t border-slate-800 align-top hover:bg-slate-800/35">
                    <td className="px-4 py-4 font-semibold text-slate-300">#{index + 1}</td>
                    <td className="px-4 py-4"><Link to={`/prospects/${p.id}`} className="font-medium text-cyan-300 hover:text-cyan-200">{p.name}</Link></td>
                    <td className="px-4 py-4 text-slate-300">{p.basin}</td>
                    <td className="px-4 py-4 text-slate-300">{p.block}</td>
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
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${economicGradeBadge[p.economicAssessment.economicGrade]}`}>
                          {getEconomicGradeLabel(p.economicAssessment.economicGrade)}
                        </span>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${priorityBadgeClass[p.priority ?? 'low']}`}>{p.priority}</span></td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${riskBadgeClass[p.mainRisk ?? 'timing']}`}>{p.mainRisk}</span></td>
                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-200">
                        {p.dataConfidence ?? 0}/100
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {p.scoringMode === 'evidence_derived'
                        ? <Link to={`/prospects/${p.id}`} className="inline-flex rounded-full border border-cyan-700 bg-cyan-950 px-2.5 py-1 text-xs font-medium text-cyan-300 hover:bg-cyan-900">Evidence-derived</Link>
                        : <span className="inline-flex rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-400">Manual</span>
                      }
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${tierBadgeClass[getProspectivityTier(p)]}`}>
                        T{getProspectivityTier(p).split('_')[1]}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${actionBadgeClass[getRecommendedAction(p)]}`}>
                        {getRecommendedActionLabel(getRecommendedAction(p))}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs text-slate-400">{getExplorationStageLabel(getExplorationStage(p))}</span>
                    </td>
                    <td className="px-4 py-4"><div className="max-w-[280px] whitespace-normal leading-6 text-slate-300">{p.recommendation}</div></td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link to={`/prospects/${p.id}`} className="rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800">View</Link>
                        <Link to={`/prospects/${p.id}/edit`} className="rounded border border-cyan-800 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-950">Edit</Link>
                        <button
                          className="rounded border border-red-800 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-950"
                          onClick={() => {
                            if (window.confirm(`Delete ${p.name}?`)) deleteProspect(p.id);
                          }}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-sm text-slate-300">No prospects match the current filters.</div>
        )}
    </section>
  </div>;
}
