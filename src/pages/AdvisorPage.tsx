import { useState } from 'react';
import { getAdvisorResponse } from '../domain/advisor';
import { useProspectStore } from '../store/useProspectStore';

export function AdvisorPage() {
  const prospects = useProspectStore((s) => s.prospects);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<string[]>(['Try: top prospects, best prospect, main risk, high resource high risk, need more data, portfolio summary']);

  const onAsk = () => {
    const response = getAdvisorResponse(question, prospects);
    setMessages((m) => [...m, `Q: ${question}`, `A: ${response}`]);
    setQuestion('');
  };

  return <div className="space-y-4"><h2 className="text-2xl font-semibold">Advisor</h2>
    <div className="bg-slate-900 border border-slate-800 rounded p-4 h-96 overflow-auto text-sm space-y-2">{messages.map((m, i) => <div key={i}>{m}</div>)}</div>
    <div className="flex gap-2"><input value={question} onChange={(e) => setQuestion(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2" placeholder="Ask a portfolio question"/><button onClick={onAsk} className="bg-cyan-700 hover:bg-cyan-600 rounded px-4 py-2">Send</button></div>
  </div>;
}
