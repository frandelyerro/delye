import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import { useProspectStore } from '../store/useProspectStore';
import { exportProspectReport } from '../utils/exportReport';

export function ProspectDetailPage() {
  const { id } = useParams();
  const prospect = useProspectStore((s) => s.prospects.find((p) => p.id === id));
  const radar = useMemo(() => prospect ? [
    ['source', prospect.sourceScore],['migration', prospect.migrationScore],['reservoir', prospect.reservoirScore],['seal', prospect.sealScore],['trap', prospect.trapScore],['timing', prospect.timingScore]
  ].map(([k,v])=>({k,v})):[], [prospect]);
  if (!prospect) return <div>Prospect not found</div>;
  return <div className="space-y-4"><h2 className="text-2xl font-semibold">{prospect.name}</h2><p className="text-slate-300">Explainable AI-assisted petroleum system scoring.</p>
  <div className="grid grid-cols-3 gap-4"> <div className="bg-slate-900 p-4 rounded border border-slate-800">GCoS: {Math.round((prospect.geologicalChanceOfSuccess??0)*100)}%</div><div className="bg-slate-900 p-4 rounded border border-slate-800">Main Risk: {prospect.mainRisk}</div><div className="bg-slate-900 p-4 rounded border border-slate-800">Resource: {prospect.resourceEstimate} MMboe</div></div>
  <div className="bg-slate-900 rounded p-4 border border-slate-800 h-80"><ResponsiveContainer width="100%" height="100%"><RadarChart data={radar}><PolarGrid /><PolarAngleAxis dataKey="k"/><PolarRadiusAxis domain={[0,1]}/><Radar dataKey="v" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.35}/></RadarChart></ResponsiveContainer></div>
  <p>{prospect.explanation}</p><p className="text-amber-300">Recommendation: {prospect.recommendation}</p>
  <button className="px-4 py-2 bg-cyan-700 rounded" onClick={()=>exportProspectReport(prospect)}>Export JSON report</button></div>;
}
