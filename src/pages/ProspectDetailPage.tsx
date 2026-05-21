import { Link, useNavigate, useParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useProspectStore } from '../store/useProspectStore';
import { exportProspectReport } from '../utils/exportReport';

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

export function ProspectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const prospect = useProspectStore((s) => s.prospects.find((p) => p.id === id));
  const deleteProspect = useProspectStore((s) => s.deleteProspect);
  if (!prospect) return <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">Prospect not found.</div>;

  const chartData = [
    { name: 'source', value: prospect.sourceScore },
    { name: 'migration', value: prospect.migrationScore },
    { name: 'reservoir', value: prospect.reservoirScore },
    { name: 'seal', value: prospect.sealScore },
    { name: 'trap', value: prospect.trapScore },
    { name: 'timing', value: prospect.timingScore }
  ];
  const primaryMetrics = [
    ['GCoS', `${Math.round((prospect.geologicalChanceOfSuccess ?? 0) * 100)}%`],
    ['Commercial Score', `${prospect.commercialScore}/100`],
    ['Resource Estimate', `${prospect.resourceEstimate} MMboe`],
    ['Priority', prospect.priority],
    ['Main Risk', prospect.mainRisk]
  ];

  return <div className="space-y-6">
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Technical prospect file</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{prospect.name}</h1>
          <p className="mt-2 text-sm text-slate-400">{prospect.basin} / {prospect.block} / {prospect.playType}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/prospects/${prospect.id}/edit`} className="inline-flex rounded border border-cyan-800 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-950">Edit prospect</Link>
          <button
            className="rounded border border-red-800 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-950"
            onClick={() => {
              if (window.confirm(`Delete ${prospect.name}?`)) {
                deleteProspect(prospect.id);
                navigate('/');
              }
            }}
            type="button"
          >
            Delete prospect
          </button>
          <button className="rounded bg-cyan-700 px-4 py-2 text-sm font-medium hover:bg-cyan-600" onClick={() => exportProspectReport(prospect)}>Export report JSON</button>
        </div>
      </div>
    </section>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {primaryMetrics.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
          {label === 'Priority' ? (
            <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-sm font-medium capitalize ${priorityBadgeClass[prospect.priority ?? 'low']}`}>{value}</span>
          ) : label === 'Main Risk' ? (
            <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-sm font-medium capitalize ${riskBadgeClass[prospect.mainRisk ?? 'timing']}`}>{value}</span>
          ) : (
            <div className="mt-3 text-2xl font-semibold text-slate-50">{value}</div>
          )}
        </div>
      ))}
    </section>

    <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-lg font-semibold">Overview</h2>
      <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        {[
          ['Basin', prospect.basin],
          ['Block', prospect.block],
          ['Play Type', prospect.playType],
          ['Latitude', prospect.latitude],
          ['Longitude', prospect.longitude],
          ['Resource Class', 'Unrisked estimate']
        ].map(([label, value]) => (
          <div key={label} className="rounded border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
            <div className="mt-1 text-slate-200">{value}</div>
          </div>
        ))}
      </div>
    </section>

    <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Petroleum System Components</h2>
        <span className="text-xs text-slate-500">Scores normalized 0-1</span>
      </div>
      <div className="h-80">
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <XAxis dataKey="name"/>
            <YAxis domain={[0, 1]}/>
            <Tooltip/>
            <Bar dataKey="value" fill="#38bdf8"/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>

    <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">Risk & Recommendation</h2>
        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Main Risk</div>
            <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-medium capitalize ${riskBadgeClass[prospect.mainRisk ?? 'timing']}`}>{prospect.mainRisk}</span>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Recommendation</div>
            <p className="mt-2 leading-6 text-slate-200">{prospect.recommendation}</p>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">AI Explanation</h2>
        <p className="mt-4 text-sm leading-7 text-slate-300">{prospect.explanation}</p>
      </div>
    </section>
  </div>;
}
