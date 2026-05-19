import { useState } from 'react';
import { useProspectStore } from '../store/useProspectStore';

export function AdvisorPage() {
  const prospects = useProspectStore((s) => s.prospects);
  const [q, setQ] = useState('');
  const [a, setA] = useState('Ask: What are the top ranked prospects?');
  const ask = () => {
    const top = prospects.slice(0, 3).map((p) => p.name).join(', ');
    const text = q.toLowerCase();
    if (text.includes('top')) return setA(`Top ranked prospects are ${top}.`);
    if (text.includes('best')) return setA(`Best prospect is ${prospects[0].name} due to ${(prospects[0].geologicalChanceOfSuccess! * 100).toFixed(1)}% GCoS and ${prospects[0].commercialScore}/100 commercial score.`);
    if (text.includes('risk')) {
      const riskCounts = prospects.reduce((acc, p) => {
        const key = p.mainRisk ?? 'unknown risk';
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      return setA(`Main portfolio risk distribution: ${JSON.stringify(riskCounts)}.`);
    }
    setA('Mock advisor: ask about top prospects, best prospect, or portfolio risk.');
  };
  return <div className="space-y-4"><h2 className="text-2xl font-semibold">AI Advisor (Mock)</h2><p>Reduce uncertainty before committing exploration capital.</p>
  <div className="bg-slate-900 p-4 rounded border border-slate-800 min-h-32">{a}</div>
  <div className="flex gap-2"><input className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2" value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Ask a question"/><button onClick={ask} className="px-4 py-2 bg-cyan-700 rounded">Send</button></div></div>;
}
