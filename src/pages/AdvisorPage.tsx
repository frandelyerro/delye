import { useState } from 'react';
import { getAdvisorResponse } from '../domain/advisor';
import { useProspectStore } from '../store/useProspectStore';

const examples = [
  'top prospects',
  'best prospect',
  'main risk',
  'high resource high risk',
  'need more data',
  'portfolio summary'
];

type Message = { role: 'advisor' | 'user'; text: string };

export function AdvisorPage() {
  const prospects = useProspectStore((s) => s.prospects);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'advisor', text: 'Ask about portfolio ranking, risk concentration, resource scale, or data gaps. Responses are rule-based for this MVP.' }
  ]);

  const onAsk = () => {
    const trimmed = question.trim();
    if (!trimmed) return;
    const response = getAdvisorResponse(trimmed, prospects);
    setMessages((m) => [...m, { role: 'user', text: trimmed }, { role: 'advisor', text: response }]);
    setQuestion('');
  };

  return <div className="space-y-5">
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <h1 className="text-2xl font-semibold">Portfolio advisor</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
        Rule-based guidance over the current prospect portfolio. Use it to summarize rankings, risks, and follow-up data priorities.
      </p>
    </section>

    <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <h2 className="text-sm font-semibold text-slate-200">Example questions</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {examples.map((example) => (
          <button key={example} onClick={() => setQuestion(example)} className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-700 hover:text-cyan-200">
            {example}
          </button>
        ))}
      </div>
    </section>

    <section className="rounded-lg border border-slate-800 bg-slate-900">
      <div className="h-96 space-y-3 overflow-auto p-4 text-sm">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-3xl rounded-lg border px-4 py-3 leading-6 ${m.role === 'user' ? 'border-cyan-500/30 bg-cyan-500/15 text-cyan-100' : 'border-slate-800 bg-slate-950 text-slate-300'}`}>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{m.role === 'user' ? 'Question' : 'Advisor'}</div>
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-800 p-4">
        <div className="flex gap-2">
          <input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onAsk(); }} className="flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Ask a portfolio question"/>
          <button onClick={onAsk} className="rounded bg-cyan-700 px-4 py-2 text-sm font-medium hover:bg-cyan-600">Send</button>
        </div>
      </div>
    </section>
  </div>;
}
