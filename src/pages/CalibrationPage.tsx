import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useProspectStore } from '../store/useProspectStore';
import {
  getOutcomeStats,
  getOutcomeCalibration,
  getBasinOutcomeStats,
  getPlayTypeOutcomeStats,
  type GroupOutcomeStats,
} from '../domain/portfolioIntelligence';
import { CHART_TOOLTIP_STYLE } from '../utils/chartConfig';

const deltaBadge = (actual: number, predicted: number, drilled: number) => {
  if (drilled < 5) return <span className="text-slate-500 text-xs">n&lt;5</span>;
  const delta = actual - predicted;
  if (delta < -10) return <span className="text-amber-400 text-xs font-medium">optimistic ({delta}%)</span>;
  if (delta > 10) return <span className="text-sky-400 text-xs font-medium">conservative (+{delta}%)</span>;
  return <span className="text-emerald-400 text-xs font-medium">calibrated ({delta >= 0 ? '+' : ''}{delta}%)</span>;
};

function GroupStatsTable({ title, rows }: { title: string; rows: GroupOutcomeStats[] }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">No drilled outcomes in this grouping yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-slate-950/70">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Group</th>
                <th className="px-4 py-3">Drilled</th>
                <th className="px-4 py-3">Geological</th>
                <th className="px-4 py-3">Commercial</th>
                <th className="px-4 py-3">Avg Pre-drill GCoS</th>
                <th className="px-4 py-3">Calibration</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.group} className="border-t border-slate-800 hover:bg-slate-800/35">
                  <td className="px-4 py-3 font-medium text-slate-200">{r.group}</td>
                  <td className="px-4 py-3 text-slate-300">{r.drilled}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {r.geologicalSuccessRate}% ({r.geologicalSuccesses}/{r.drilled})
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {r.commercialSuccessRate}% ({r.commercialSuccesses}/{r.drilled})
                  </td>
                  <td className="px-4 py-3 text-slate-300">{r.avgPredrillGcos}%</td>
                  <td className="px-4 py-3">{deltaBadge(r.geologicalSuccessRate, r.avgPredrillGcos, r.drilled)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function CalibrationPage() {
  const { prospects } = useProspectStore();

  const stats = useMemo(() => getOutcomeStats(prospects), [prospects]);
  const calibration = useMemo(
    () => getOutcomeCalibration(prospects).filter((b) => b.drilled > 0),
    [prospects],
  );
  const byBasin = useMemo(() => getBasinOutcomeStats(prospects), [prospects]);
  const byPlay = useMemo(() => getPlayTypeOutcomeStats(prospects), [prospects]);

  const chartData = calibration.map((b) => ({
    bucket: b.label,
    'Actual success %': b.actualSuccessRate,
    'Calibrated would be %': b.expectedSuccessRate,
    drilled: b.drilled,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Outcome Calibration</h1>
        <p className="text-slate-400 text-sm mt-1">
          Compares pre-drill expert GCoS against observed drilling outcomes (Rose &amp; Associates lookback
          methodology). A calibrated portfolio succeeds at roughly the rate its GCoS predicted.
        </p>
      </div>

      {stats.totalDrilled === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-8 text-center">
          <p className="text-slate-300 font-medium">No drilled outcomes recorded yet.</p>
          <p className="text-slate-500 text-sm mt-2">
            Calibration needs prospects with a recorded drilling outcome. Label them in bulk on the{' '}
            <Link to="/outcomes" className="text-sky-400 underline">
              Outcome Labeling
            </Link>{' '}
            page, or per prospect via the Historical Outcome section in the Edit Prospect form.
          </p>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Drilled</p>
              <p className="mt-1 text-2xl font-bold text-slate-100">{stats.totalDrilled}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Geological Success</p>
              <p className="mt-1 text-2xl font-bold text-emerald-400">{stats.geologicalSuccessRate}%</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Commercial Success</p>
              <p className="mt-1 text-2xl font-bold text-sky-400">{stats.commercialSuccessRate}%</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Resource Discovered</p>
              <p className="mt-1 text-2xl font-bold text-slate-100">
                {Math.round(stats.totalResourceDiscoveredMMboe)} <span className="text-sm font-normal text-slate-500">MMboe</span>
              </p>
            </div>
          </div>

          {/* Calibration chart */}
          <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-sm font-semibold text-slate-200 mb-1">Actual vs Predicted Success by GCoS Bucket</h2>
            <p className="text-xs text-slate-500 mb-4">
              Each bar pair is a pre-drill GCoS range. Buckets with fewer than 5 wells are statistically noisy —
              treat them as indicative only.
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid stroke="#1e293b" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={{ color: '#cbd5e1' }}
                  formatter={(value: number, name: string) => [`${value}%`, name]}
                />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                <Bar dataKey="Actual success %" fill="#38bdf8" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Calibrated would be %" fill="#475569" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <GroupStatsTable title="Success Rates by Basin" rows={byBasin} />
          <GroupStatsTable title="Success Rates by Play Type" rows={byPlay} />

          <p className="text-xs text-slate-600">
            Methodology: geological success = commercial + technical discoveries. &ldquo;Calibration&rdquo; compares the
            observed geological success rate to the average pre-drill GCoS of the same wells; a gap larger than
            ±10% with 5+ wells suggests systematic over- or under-risking. Ask the Advisor &ldquo;gcos
            calibration&rdquo; or &ldquo;success rate by basin&rdquo; for a narrative summary.
          </p>
        </>
      )}
    </div>
  );
}
