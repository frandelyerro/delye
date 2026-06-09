import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SensitivityResult } from '../../domain/sensitivityAnalysis';

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const deltaPct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}pp`;

type Props = { result: SensitivityResult };

type TooltipPayload = { name: string; value: number; payload: { label: string } };

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as { label: string; upsideDelta: number; downsideDelta: number };
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs">
      <p className="font-semibold text-slate-200 mb-1">{row.label}</p>
      <p className="text-emerald-400">Upside (+10pp): {deltaPct(row.upsideDelta)} GCoS</p>
      <p className="text-red-400">Downside (−10pp): {deltaPct(row.downsideDelta)} GCoS</p>
    </div>
  );
}

export function TornadoChart({ result }: Props) {
  const { factors, baselineGCoS } = result;
  const maxAbs = Math.max(...factors.map((f) => f.absMaxDelta), 0.001);

  const data = factors.map((f) => ({
    ...f,
    upside: f.upsideDelta,
    downside: f.downsideDelta,
  }));

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Baseline GCoS: <span className="text-sky-400 font-mono">{pct(baselineGCoS)}</span>
        {' '}— each bar shows change in GCoS when that component shifts ±10 percentage points.
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis
            type="number"
            domain={[-maxAbs * 1.15, maxAbs * 1.15]}
            tickFormatter={(v: number) => deltaPct(v)}
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={70}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.05)' }} />
          <ReferenceLine x={0} stroke="#334155" strokeWidth={1} />
          <Bar dataKey="upside" name="Upside" radius={[0, 3, 3, 0]}>
            {data.map((_, i) => <Cell key={i} fill="#10b981" fillOpacity={0.85} />)}
          </Bar>
          <Bar dataKey="downside" name="Downside" radius={[0, 3, 3, 0]}>
            {data.map((_, i) => <Cell key={i} fill="#ef4444" fillOpacity={0.85} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
