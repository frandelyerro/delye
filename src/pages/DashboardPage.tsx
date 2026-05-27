import React from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import { useProspectStore } from '../store/useProspectStore';

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
  const kpis = [
    ['Portfolio', filtered.length, 'filtered prospects'],
    ['Average GCoS', `${Math.round(avg * 100)}%`, 'geological chance of success'],
    ['Unrisked resources', `${totals} MMboe`, 'current filtered portfolio'],
    ['Top prospect', top?.name ?? '-', top ? `${Math.round((top.geologicalChanceOfSuccess ?? 0) * 100)}% GCoS` : 'no active match']
  ];

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

    <section className="grid gap-4 xl:grid-cols-[320px_1fr]">
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

      <div className="rounded-lg border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-200">Prospect ranking</h2>
        </div>
        {ranked.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1440px] text-sm">
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
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Main Risk</th>
                  <th className="px-4 py-3">Data Confidence</th>
                  <th className="px-4 py-3">Scoring Mode</th>
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
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${priorityBadgeClass[p.priority ?? 'low']}`}>{p.priority}</span></td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${riskBadgeClass[p.mainRisk ?? 'timing']}`}>{p.mainRisk}</span></td>
                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-200">
                        {p.dataConfidence ?? 0}/100
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {p.scoringMode === 'evidence_derived'
                        ? <span className="inline-flex rounded-full border border-cyan-700 bg-cyan-950 px-2.5 py-1 text-xs font-medium text-cyan-300">Evidence-derived</span>
                        : <span className="inline-flex rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-400">Manual</span>
                      }
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
      </div>
    </section>
  </div>;
}
