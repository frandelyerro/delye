import { useParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useProspectStore } from '../store/useProspectStore';
import { exportProspectReport } from '../utils/exportReport';

export function ProspectDetailPage() {
  const { id } = useParams();
  const prospect = useProspectStore((s) => s.prospects.find((p) => p.id === id));
  if (!prospect) return <div>Prospect not found.</div>;

  const chartData = [
    { name: 'source', value: prospect.sourceScore },
    { name: 'migration', value: prospect.migrationScore },
    { name: 'reservoir', value: prospect.reservoirScore },
    { name: 'seal', value: prospect.sealScore },
    { name: 'trap', value: prospect.trapScore },
    { name: 'timing', value: prospect.timingScore }
  ];

  return <div className="space-y-4">
    <h2 className="text-2xl font-semibold">{prospect.name}</h2>
    <p className="text-slate-400">Explainable petroleum system scoring</p>
    <div className="grid grid-cols-3 gap-4 text-sm">{[
      ['Basin', prospect.basin], ['Block', prospect.block], ['Play type', prospect.playType],
      ['GCoS', `${Math.round((prospect.geologicalChanceOfSuccess ?? 0) * 100)}%`], ['Commercial score', `${prospect.commercialScore}/100`], ['Resource estimate', `${prospect.resourceEstimate} MMboe`],
      ['Priority', prospect.priority], ['Main risk', prospect.mainRisk], ['Recommendation', prospect.recommendation]
    ].map(([k, v]) => <div key={k as string} className="bg-slate-900 rounded border border-slate-800 p-3"><div className="text-slate-400">{k}</div><div>{v}</div></div>)}</div>

    <div className="bg-slate-900 border border-slate-800 rounded p-4 h-72"><ResponsiveContainer><BarChart data={chartData}><XAxis dataKey="name"/><YAxis domain={[0,1]}/><Tooltip/><Bar dataKey="value" fill="#38bdf8"/></BarChart></ResponsiveContainer></div>
    <div className="bg-slate-900 border border-slate-800 rounded p-4 text-sm">{prospect.explanation}</div>
    <button className="bg-cyan-700 hover:bg-cyan-600 rounded px-4 py-2" onClick={() => exportProspectReport(prospect)}>Export report JSON</button>
  </div>;
}
