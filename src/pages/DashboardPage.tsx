import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useProspectStore } from '../store/useProspectStore';

export function DashboardPage() {
  const prospects = useProspectStore((s) => s.prospects);
  const top = prospects[0];
  const avg = prospects.reduce((a, p) => a + (p.geologicalChanceOfSuccess ?? 0), 0) / prospects.length;
  const priorityData = ['high', 'medium', 'low'].map((p) => ({ priority: p, count: prospects.filter((x) => x.priority === p).length }));
  return <div className="space-y-6">
    <h2 className="text-2xl font-semibold">Rank prospects by geological and commercial attractiveness</h2>
    <div className="grid grid-cols-4 gap-4">{[
      ['Prospects', prospects.length],
      ['Avg GCoS', `${Math.round(avg * 100)}%`],
      ['Top Prospect', top?.name ?? '-'],
      ['Total MMboe', prospects.reduce((a, p) => a + p.resourceEstimate, 0)]
    ].map(([k, v]) => <div key={k as string} className="bg-slate-900 rounded p-4 border border-slate-800"><div className="text-slate-400 text-sm">{k}</div><div className="text-xl font-bold">{v}</div></div>)}</div>
    <div className="bg-slate-900 rounded p-4 border border-slate-800 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={priorityData}><XAxis dataKey="priority"/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="count" fill="#38bdf8"/></BarChart></ResponsiveContainer></div>
    <table className="w-full text-sm"><thead><tr className="text-left text-slate-400"><th>Name</th><th>Basin</th><th>GCoS</th><th>Comm.</th><th>Priority</th><th></th></tr></thead><tbody>{prospects.map((p)=><tr key={p.id} className="border-t border-slate-800"><td>{p.name}</td><td>{p.basin}</td><td>{Math.round((p.geologicalChanceOfSuccess??0)*100)}%</td><td>{p.commercialScore}</td><td>{p.priority}</td><td><Link className="text-cyan-400" to={`/prospects/${p.id}`}>View</Link></td></tr>)}</tbody></table>
  </div>;
}
