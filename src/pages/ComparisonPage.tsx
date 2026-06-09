import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { useProspectStore } from '../store/useProspectStore';
import { getScoreBreakdown } from '../domain/explainability';
import { scoreProspect } from '../domain/scoring';
import type { Prospect } from '../domain/prospect';

const COLORS = ['#38bdf8', '#f472b6', '#34d399', '#fb923c'];

const pct = (v: number) => `${Math.round(v * 100)}%`;

const priorityClass: Record<string, string> = {
  high: 'bg-emerald-900 text-emerald-300',
  medium: 'bg-sky-900 text-sky-300',
  low: 'bg-slate-700 text-slate-300',
  avoid: 'bg-red-900 text-red-300',
};

function MetricRow({ label, values }: { label: string; values: ReactNode[] }) {
  return (
    <tr className="border-b border-slate-800">
      <td className="py-2 pr-4 text-slate-400 text-sm whitespace-nowrap">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="py-2 px-3 text-sm text-center font-mono">
          {v}
        </td>
      ))}
    </tr>
  );
}

export function ComparisonPage() {
  const { prospects: rawProspects } = useProspectStore();
  const prospects = rawProspects.map((p) =>
    p.geologicalChanceOfSuccess === undefined ? scoreProspect(p) : p,
  );

  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 4
        ? [...prev, id]
        : prev,
    );
  };

  const chosen = useMemo<Prospect[]>(
    () => selected.map((id) => prospects.find((p) => p.id === id)).filter(Boolean) as Prospect[],
    [selected, prospects],
  );

  const radarData = useMemo(
    () =>
      chosen.length > 0
        ? getScoreBreakdown(chosen[0]).components.map(({ label }, idx) => {
            const entry: Record<string, string | number> = { component: label };
            chosen.forEach((p) => {
              const breakdown = getScoreBreakdown(p);
              entry[p.name] = parseFloat((breakdown.components[idx]?.value ?? 0).toFixed(3));
            });
            return entry;
          })
        : [],
    [chosen],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Prospect Comparison</h1>
        <p className="text-slate-400 text-sm mt-1">
          Select up to 4 prospects to compare side-by-side. GCoS components shown on radar chart.
        </p>
      </div>

      {/* Prospect selector */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">
          Select prospects ({selected.length}/4)
        </h2>
        {prospects.length === 0 ? (
          <p className="text-slate-500 text-sm">
            No prospects yet.{' '}
            <Link to="/prospects/new" className="text-sky-400 underline">
              Add one
            </Link>
            .
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {prospects.map((p) => {
              const isChosen = selected.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className={`text-left rounded-lg border p-2 text-xs transition-colors ${
                    isChosen
                      ? 'border-sky-500 bg-sky-950 text-sky-200'
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <div className="font-semibold truncate">{p.name}</div>
                  <div className="text-slate-400 truncate">{p.basin}</div>
                  <div className="mt-1 font-mono text-sky-400">
                    {pct(p.geologicalChanceOfSuccess ?? 0)} GCoS
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {chosen.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          Select at least one prospect above to start comparing.
        </div>
      )}

      {chosen.length > 0 && (
        <>
          {/* Radar chart */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">GCoS Component Radar</h2>
            <ResponsiveContainer width="100%" height={340}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis
                  dataKey="component"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 1]}
                  tickCount={5}
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  tickFormatter={(v: number) => pct(v)}
                />
                {chosen.map((p, i) => (
                  <Radar
                    key={p.id}
                    name={p.name}
                    dataKey={p.name}
                    stroke={COLORS[i]}
                    fill={COLORS[i]}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                ))}
                <Tooltip
                  formatter={(value: number, name: string) => [pct(value), name]}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#cbd5e1' }}
                />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Metrics table */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 overflow-x-auto">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">Side-by-Side Metrics</h2>
            <table className="w-full min-w-max">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 pr-4 text-slate-500 text-xs font-medium w-40">Metric</th>
                  {chosen.map((p, i) => (
                    <th
                      key={p.id}
                      className="py-2 px-3 text-xs font-semibold text-center"
                      style={{ color: COLORS[i] }}
                    >
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <MetricRow label="GCoS" values={chosen.map((p) => pct(p.geologicalChanceOfSuccess ?? 0))} />
                <MetricRow
                  label="Priority"
                  values={chosen.map((p) => (
                    <span
                      key={p.id}
                      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${priorityClass[p.priority ?? 'low'] ?? ''}`}
                    >
                      {p.priority ?? '—'}
                    </span>
                  ))}
                />
                <MetricRow label="Basin" values={chosen.map((p) => p.basin)} />
                <MetricRow label="Play Type" values={chosen.map((p) => p.playType)} />
                <MetricRow label="Source" values={chosen.map((p) => pct(p.sourceScore))} />
                <MetricRow label="Migration" values={chosen.map((p) => pct(p.migrationScore))} />
                <MetricRow label="Reservoir" values={chosen.map((p) => pct(p.reservoirScore))} />
                <MetricRow label="Seal" values={chosen.map((p) => pct(p.sealScore))} />
                <MetricRow label="Trap" values={chosen.map((p) => pct(p.trapScore))} />
                <MetricRow label="Timing" values={chosen.map((p) => pct(p.timingScore))} />
                <MetricRow label="Main Risk" values={chosen.map((p) => p.mainRisk ?? '—')} />
                <MetricRow label="Commercial Score" values={chosen.map((p) => `${p.commercialScore ?? '—'}`)} />
                <MetricRow
                  label="Resource Est."
                  values={chosen.map((p) => (p.resourceEstimate ? `${p.resourceEstimate} MMboe` : '—'))}
                />
                <MetricRow
                  label="Data Confidence"
                  values={chosen.map((p) => (p.dataConfidence != null ? `${p.dataConfidence}%` : '—'))}
                />
              </tbody>
            </table>
          </div>

          {/* Quick actions */}
          <div className="flex gap-3 flex-wrap">
            {chosen.map((p) => (
              <Link
                key={p.id}
                to={`/prospects/${p.id}`}
                className="text-xs text-sky-400 hover:text-sky-300 underline"
              >
                View {p.name} details →
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
