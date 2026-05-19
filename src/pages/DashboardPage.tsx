import { Link } from 'react-router-dom';
import { PieChart, Pie, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import { useProspectStore } from '../store/useProspectStore';

const colors = { high: '#22c55e', medium: '#f59e0b', low: '#ef4444' };

export function DashboardPage() {
  const { prospects, filters, setFilters } = useProspectStore();
  const basins = [...new Set(prospects.map((p) => p.basin))];
  const blocks = [...new Set(prospects.map((p) => p.block))];
  const plays = [...new Set(prospects.map((p) => p.playType))];

  const filtered = prospects.filter((p) =>
    (!filters.basin || p.basin === filters.basin) &&
    (!filters.block || p.block === filters.block) &&
    (!filters.playType || p.playType === filters.playType) &&
    (!filters.priority || p.priority === filters.priority)
  );
  const ranked = [...filtered].sort((a, b) => (b.geologicalChanceOfSuccess ?? 0) - (a.geologicalChanceOfSuccess ?? 0));

  const avg = filtered.length ? filtered.reduce((a, p) => a + (p.geologicalChanceOfSuccess ?? 0), 0) / filtered.length : 0;
  const totals = filtered.reduce((a, p) => a + p.resourceEstimate, 0);
  const top = ranked[0];
  const priorityDist = ['high', 'medium', 'low'].map((k) => ({ name: k, value: filtered.filter((p) => p.priority === k).length }));

  return <div className="space-y-6">
    <h2 className="text-2xl font-semibold">Rank prospects by geological and commercial attractiveness</h2>
    <div className="grid grid-cols-4 gap-4">{[
      ['Total prospects', filtered.length],
      ['Average GCoS', `${Math.round(avg * 100)}%`],
      ['Total unrisked resources', `${totals} MMboe`],
      ['Top ranked prospect', top?.name ?? '-']
    ].map(([k, v]) => <div key={k as string} className="bg-slate-900 border border-slate-800 rounded-lg p-4"><div className="text-xs text-slate-400">{k}</div><div className="text-lg mt-1">{v}</div></div>)}</div>

    <div className="grid grid-cols-4 gap-3">
      <select className="bg-slate-900 border border-slate-700 rounded p-2" value={filters.basin} onChange={(e) => setFilters({ basin: e.target.value })}><option value="">All basins</option>{basins.map((v) => <option key={v}>{v}</option>)}</select>
      <select className="bg-slate-900 border border-slate-700 rounded p-2" value={filters.block} onChange={(e) => setFilters({ block: e.target.value })}><option value="">All blocks</option>{blocks.map((v) => <option key={v}>{v}</option>)}</select>
      <select className="bg-slate-900 border border-slate-700 rounded p-2" value={filters.playType} onChange={(e) => setFilters({ playType: e.target.value })}><option value="">All play types</option>{plays.map((v) => <option key={v}>{v}</option>)}</select>
      <select className="bg-slate-900 border border-slate-700 rounded p-2" value={filters.priority} onChange={(e) => setFilters({ priority: e.target.value as '' | 'high' | 'medium' | 'low' })}><option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
    </div>

    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 h-56"><ResponsiveContainer><PieChart><Pie data={priorityDist} dataKey="value" nameKey="name" outerRadius={80}>{priorityDist.map((entry) => <Cell key={entry.name} fill={colors[entry.name as keyof typeof colors]} />)}</Pie><Tooltip/></PieChart></ResponsiveContainer></div>

    {ranked.length ? (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="text-slate-400 text-left">
              <th className="py-2 pr-3">Rank</th>
              <th className="py-2 pr-3">Prospect Name</th>
              <th className="py-2 pr-3">Basin</th>
              <th className="py-2 pr-3">Block</th>
              <th className="py-2 pr-3">Play Type</th>
              <th className="py-2 pr-3">GCoS %</th>
              <th className="py-2 pr-3">Commercial Score</th>
              <th className="py-2 pr-3">Resource Estimate MMboe</th>
              <th className="py-2 pr-3">Priority</th>
              <th className="py-2 pr-3">Main Risk</th>
              <th className="py-2 pr-3">Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((p, index) => (
              <tr key={p.id} className="border-t border-slate-800 align-top">
                <td className="py-3 pr-3 text-slate-300">{index + 1}</td>
                <td className="py-3 pr-3"><Link to={`/prospects/${p.id}`} className="text-cyan-400">{p.name}</Link></td>
                <td className="py-3 pr-3">{p.basin}</td>
                <td className="py-3 pr-3">{p.block}</td>
                <td className="py-3 pr-3">{p.playType}</td>
                <td className="py-3 pr-3">{Math.round((p.geologicalChanceOfSuccess ?? 0) * 100)}%</td>
                <td className="py-3 pr-3">{p.commercialScore}</td>
                <td className="py-3 pr-3">{p.resourceEstimate}</td>
                <td className="py-3 pr-3"><span className={`px-2 py-0.5 rounded text-xs ${p.priority === 'high' ? 'bg-green-700' : p.priority === 'medium' ? 'bg-amber-700' : 'bg-red-700'}`}>{p.priority}</span></td>
                <td className="py-3 pr-3 capitalize">{p.mainRisk}</td>
                <td className="py-3 pr-3 max-w-xs">{p.recommendation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-sm text-slate-300">No prospects match the current filters.</div>
    )}
  </div>;
}
