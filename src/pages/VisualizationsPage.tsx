import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, AreaChart, Area, CartesianGrid,
} from 'recharts';
import { useProspectStore } from '../store/useProspectStore';
import { componentMap, componentNames, componentLabels } from '../domain/explainability';

const COMPONENT_COLOR: Record<string, string> = {
  Source: '#38bdf8',
  Migration: '#a78bfa',
  Reservoir: '#34d399',
  Seal: '#f472b6',
  Trap: '#fb923c',
  Timing: '#facc15',
};

const CONFIDENCE_COLOR: Record<'high' | 'medium' | 'low', string> = {
  high: '#34d399',
  medium: '#f59e0b',
  low: '#ef4444',
};

const confidenceTier = (dataConfidence: number | undefined): 'high' | 'medium' | 'low' => {
  const dc = dataConfidence ?? 0;
  if (dc >= 70) return 'high';
  if (dc >= 40) return 'medium';
  return 'low';
};

export function VisualizationsPage() {
  const { prospects } = useProspectStore();

  // Section A: 2D geological risk cross-section (top 10 by GCoS, stacked component scores)
  const crossSectionData = React.useMemo(() => {
    return [...prospects]
      .sort((a, b) => (b.geologicalChanceOfSuccess ?? 0) - (a.geologicalChanceOfSuccess ?? 0))
      .slice(0, 10)
      .map((p) => {
        const row: Record<string, string | number> = { name: p.name };
        componentNames.forEach((key) => {
          row[componentLabels[key]] = Math.round(Number(p[componentMap[key]]) * 100);
        });
        return row;
      });
  }, [prospects]);

  // Section B: 3D risk-resource-confidence bubble (GCoS vs commercial score, bubble = resource, color = data confidence)
  const bubbleByConfidence = React.useMemo(() => {
    const tiers: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];
    return tiers.map((tier) => ({
      tier,
      data: prospects
        .filter((p) => confidenceTier(p.dataConfidence) === tier)
        .map((p) => ({
          x: Math.round((p.geologicalChanceOfSuccess ?? 0) * 100),
          y: p.commercialScore ?? 0,
          z: p.resourceEstimate,
          name: p.name,
        })),
    })).filter((g) => g.data.length > 0);
  }, [prospects]);

  // Section C: portfolio resource forecast (cumulative risked vs unrisked resource, ranked by GCoS)
  const forecastData = React.useMemo(() => {
    const ranked = [...prospects].sort((a, b) => (b.geologicalChanceOfSuccess ?? 0) - (a.geologicalChanceOfSuccess ?? 0));
    let cumRisked = 0;
    let cumUnrisked = 0;
    return ranked.map((p, i) => {
      const gcos = p.geologicalChanceOfSuccess ?? 0;
      const unrisked = p.economicAssessment?.unriskedResourceMMboe ?? p.resourceEstimate;
      const risked = p.economicAssessment?.riskedResourceMMboe ?? p.resourceEstimate * gcos;
      cumUnrisked += unrisked;
      cumRisked += risked;
      return {
        rank: i + 1,
        name: p.name,
        cumulativeUnrisked: Math.round(cumUnrisked * 10) / 10,
        cumulativeRisked: Math.round(cumRisked * 10) / 10,
      };
    });
  }, [prospects]);

  if (prospects.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h1 className="mb-2 text-lg font-semibold text-slate-100">Visualizations</h1>
        <p className="text-sm text-slate-400">No prospects available. Add prospects to see geological risk, resource and forecast visualizations.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <h1 className="text-lg font-semibold text-slate-100">Visualizations</h1>
        <p className="mt-1 text-sm text-slate-400">
          2D and 3D views of portfolio geological risk, risk-resource-confidence trade-offs, and cumulative resource forecasts.
        </p>
      </section>

      {/* Section A: 2D Geological Risk Cross-Section */}
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-200">2D Geological Risk Cross-Section</h2>
        <p className="mb-3 text-xs text-slate-500">
          Top 10 prospects by GCoS. Each bar is a stratigraphic-style stack of the 6 chance-of-success components (% probability each).
        </p>
        <ResponsiveContainer width="100%" height={Math.max(260, crossSectionData.length * 34)}>
          <BarChart data={crossSectionData} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" width={140} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 12 }}
              formatter={(value: number, name: string) => [`${value}%`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            {Object.values(componentLabels).map((label) => (
              <Bar key={label} dataKey={label} stackId="risk" fill={COMPONENT_COLOR[label]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Section B: 3D Risk-Resource-Confidence Bubble */}
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-200">3D Risk-Resource-Confidence Bubble</h2>
        <p className="mb-3 text-xs text-slate-500">
          GCoS (%) vs commercial score, bubble size = resource estimate (MMboe). Color = data confidence tier.
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 20, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis type="number" dataKey="x" name="GCoS" unit="%" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} label={{ value: 'GCoS (%)', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 10 }} />
            <YAxis type="number" dataKey="y" name="Commercial Score" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} label={{ value: 'Commercial Score', angle: -90, position: 'insideLeft', offset: 12, fill: '#64748b', fontSize: 10 }} />
            <ZAxis type="number" dataKey="z" range={[40, 300]} name="Resource (MMboe)" />
            <Tooltip
              cursor={{ strokeDasharray: '3 3', stroke: '#334155' }}
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 12 }}
              formatter={(value, name) => [value, name]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ''}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            {bubbleByConfidence.map((g) => (
              <Scatter key={g.tier} name={`${g.tier[0].toUpperCase()}${g.tier.slice(1)} confidence`} data={g.data} fill={CONFIDENCE_COLOR[g.tier]} fillOpacity={0.75} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </section>

      {/* Section C: Portfolio Resource Forecast */}
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-200">Portfolio Resource Forecast</h2>
        <p className="mb-3 text-xs text-slate-500">
          Cumulative resource (MMboe) as prospects are added in GCoS-ranked order. This is a deterministic running total
          of unrisked vs GCoS-risked volumes per prospect, not a probabilistic P10/P50/P90 distribution.
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={forecastData} margin={{ top: 8, right: 16, bottom: 20, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="rank" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} label={{ value: 'Prospect rank (by GCoS)', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 10 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} label={{ value: 'Cumulative MMboe', angle: -90, position: 'insideLeft', offset: 12, fill: '#64748b', fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 12 }}
              labelFormatter={(rank) => `Prospect rank ${rank}`}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Area type="monotone" dataKey="cumulativeUnrisked" name="Cumulative unrisked (MMboe)" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.15} />
            <Area type="monotone" dataKey="cumulativeRisked" name="Cumulative risked (MMboe)" stroke="#34d399" fill="#34d399" fillOpacity={0.25} />
          </AreaChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
